import { BadRequestException } from '@nestjs/common';
import { DocumentExtractionService, cleanDocumentText, MAX_DOCUMENT_BYTES } from './document-extraction.service';

function makeZip(entries: Record<string, string>): Buffer {
  const localBlocks: Buffer[] = []; const centralBlocks: Buffer[] = []; let offset = 0;
  for (const [name, value] of Object.entries(entries)) {
    const fileName = Buffer.from(name); const data = Buffer.from(value);
    const local = Buffer.alloc(30); local.writeUInt32LE(0x04034b50,0); local.writeUInt16LE(20,4); local.writeUInt32LE(data.length,18); local.writeUInt32LE(data.length,22); local.writeUInt16LE(fileName.length,26);
    localBlocks.push(local,fileName,data);
    const central = Buffer.alloc(46); central.writeUInt32LE(0x02014b50,0); central.writeUInt16LE(20,4); central.writeUInt16LE(20,6); central.writeUInt32LE(data.length,20); central.writeUInt32LE(data.length,24); central.writeUInt16LE(fileName.length,28); central.writeUInt32LE(offset,42);
    centralBlocks.push(central,fileName); offset += local.length + fileName.length + data.length;
  }
  const centralBytes = Buffer.concat(centralBlocks); const end = Buffer.alloc(22); end.writeUInt32LE(0x06054b50,0); end.writeUInt16LE(Object.keys(entries).length,8); end.writeUInt16LE(Object.keys(entries).length,10); end.writeUInt32LE(centralBytes.length,12); end.writeUInt32LE(offset,16);
  return Buffer.concat([...localBlocks,centralBytes,end]);
}

function makePdf(text = ''): Buffer {
  const escaped = text.replace(/\\/g,'\\\\').replace(/\(/g,'\\(').replace(/\)/g,'\\)');
  const stream = text ? `BT /F1 12 Tf 72 720 Td (${escaped}) Tj ET` : '';
  const objects = ['<< /Type /Catalog /Pages 2 0 R >>','<< /Type /Pages /Kids [3 0 R] /Count 1 >>','<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Resources << /Font << /F1 4 0 R >> >> /Contents 5 0 R >>','<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>',`<< /Length ${Buffer.byteLength(stream)} >>\nstream\n${stream}\nendstream`];
  const chunks: Buffer[]=[Buffer.from('%PDF-1.4\n')]; const offsets=[0]; let position=chunks[0].length;
  objects.forEach((object,index)=>{offsets.push(position);const block=Buffer.from(`${index+1} 0 obj\n${object}\nendobj\n`);chunks.push(block);position+=block.length;});
  const xrefOffset=position; const xref=['xref',`0 ${objects.length+1}`,'0000000000 65535 f ',...offsets.slice(1).map((offset)=>`${String(offset).padStart(10,'0')} 00000 n `)].join('\n');
  chunks.push(Buffer.from(`${xref}\ntrailer\n<< /Size ${objects.length+1} /Root 1 0 R >>\nstartxref\n${xrefOffset}\n%%EOF`)); return Buffer.concat(chunks);
}

describe('DocumentExtractionService', () => {
  const service = new DocumentExtractionService();
  const meaningful = 'Ta’lim jarayonida bilimlarni mustahkamlash muhim hisoblanadi. Ushbu matn test yaratish uchun yetarli mazmunli ma’lumot beradi. O‘quvchilar mavzuni tahlil qilib, sabab va natijalarni tushunadilar.';

  it('extracts UTF-8 TXT, Markdown and CSV', async () => {
    for (const [name,mime,content] of [['sample.txt','text/plain',meaningful],['sample.md','text/markdown',`# Mavzu\n\n${meaningful}`],['sample.csv','text/csv',`topic,detail\n${meaningful},value`]]) {
      const result=await service.extract({buffer:Buffer.from(content),originalname:name,mimetype:mime}); expect(result.text.length).toBeGreaterThan(80);
    }
  });

  it('extracts DOCX paragraphs and PPTX slide text', async () => {
    const docx=makeZip({'word/document.xml':`<w:document xmlns:w="x"><w:body><w:p><w:r><w:t>${meaningful}</w:t></w:r></w:p></w:body></w:document>`});
    const doc=await service.extract({buffer:docx,originalname:'lesson.docx',mimetype:'application/vnd.openxmlformats-officedocument.wordprocessingml.document'});
    expect(doc.text).toContain('bilimlarni mustahkamlash');
    const pptx=makeZip({'ppt/slides/slide1.xml':`<p:sld xmlns:a="x"><a:t>${meaningful}</a:t></p:sld>`,'ppt/slides/slide2.xml':'<p:sld xmlns:a="x"><a:t>Ikkinchi slayd mazmuni</a:t></p:sld>'});
    const slides=await service.extract({buffer:pptx,originalname:'lesson.pptx',mimetype:'application/vnd.openxmlformats-officedocument.presentationml.presentation'});
    expect(slides.text).toContain('Ikkinchi slayd');
  });

  it('extracts searchable PDFs and flags scanned PDFs for OCR', async () => {
    const searchable=await service.extract({buffer:makePdf('Learning science supports knowledge and memory through repeated practice and clear explanations.'),originalname:'normal.pdf',mimetype:'application/pdf'});
    expect(searchable.needsVision).toBe(false); expect(searchable.text).toContain('Learning science');
    const scanned=await service.extract({buffer:makePdf(),originalname:'scan.pdf',mimetype:'application/pdf'}); expect(scanned.needsVision).toBe(true);
  });

  it('flags PNG/JPG for OCR', async () => {
    const png=Buffer.from([137,80,78,71,13,10,26,10,1,2,3]); const result=await service.extract({buffer:png,originalname:'scan.png',mimetype:'image/png'});
    expect(result.needsVision).toBe(true); expect(result.text).toBe('');
  });

  it('rejects empty, unsupported, oversized, mismatched and corrupted files', async () => {
    await expect(service.extract({buffer:Buffer.alloc(0),originalname:'empty.txt',mimetype:'text/plain'})).rejects.toThrow(BadRequestException);
    await expect(service.extract({buffer:Buffer.from('hello'),originalname:'book.exe',mimetype:'application/octet-stream'})).rejects.toThrow(/qo‘llab-quvvatlanmaydi/i);
    await expect(service.extract({buffer:Buffer.alloc(MAX_DOCUMENT_BYTES+1),originalname:'huge.txt',mimetype:'text/plain'})).rejects.toThrow(/20 MB/i);
    await expect(service.extract({buffer:Buffer.from(meaningful),originalname:'wrong.pdf',mimetype:'text/plain'})).rejects.toThrow(/mos kelmayapti/i);
    await expect(service.extract({buffer:Buffer.from('not a pdf'),originalname:'broken.pdf',mimetype:'application/pdf'})).rejects.toThrow(/haqiqiy formatiga/i);
  });

  it('recognizes encrypted Office files and rejects too little text', async () => {
    const encrypted=Buffer.from([0xd0,0xcf,0x11,0xe0,0xa1,0xb1,0x1a,0xe1]);
    await expect(service.extract({buffer:encrypted,originalname:'locked.docx',mimetype:'application/vnd.openxmlformats-officedocument.wordprocessingml.document'})).rejects.toThrow(/parol bilan himoyalangan/i);
    await expect(service.extract({buffer:Buffer.from('short'),originalname:'short.txt',mimetype:'text/plain'})).rejects.toThrow(/yetarli o‘qiladigan matn/i);
  });

  it('cleans repeated page headers, page numbers and broken hyphenation', () => {
    const cleaned=cleanDocumentText('AURORA COURSE\n1\nBilim mustahkamlan-\nganda natija bo‘ladi.\nAURORA COURSE\n2\nAURORA COURSE');
    expect(cleaned).not.toContain('AURORA COURSE'); expect(cleaned).not.toMatch(/^1$/m); expect(cleaned).toContain('mustahkamlanganda');
  });
});
