import * as FileSystem from 'expo-file-system/legacy';
import * as Print from 'expo-print';
import * as Sharing from 'expo-sharing';
import { Platform } from 'react-native';
import type { LearningHistoryItem } from './learningService';

export type TestExportFormat = 'pdf' | 'docx' | 'txt' | 'html' | 'csv' | 'json' | 'md' | 'pptx';

export const TEST_EXPORT_FORMATS: Array<{ value: TestExportFormat; label: string }> = [
  { value: 'pdf', label: 'PDF' },
  { value: 'docx', label: 'DOCX' },
  { value: 'txt', label: 'TXT' },
  { value: 'html', label: 'HTML' },
  { value: 'csv', label: 'CSV' },
  { value: 'json', label: 'JSON' },
  { value: 'md', label: 'MD' },
  { value: 'pptx', label: 'PPTX' },
];

type ExportAttempt = Pick<LearningHistoryItem,
  'id' | 'subjectName' | 'topicName' | 'totalQuestions' | 'correctAnswers' | 'accuracy' | 'completedAt' | 'review'
>;

const escapeHtml = (value: unknown) => String(value ?? '')
  .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
  .replace(/"/g, '&quot;').replace(/'/g, '&#39;');

const escapeXml = (value: unknown) => String(value ?? '')
  .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
  .replace(/"/g, '&quot;').replace(/'/g, '&apos;');

const safeFileName = (value: string) => value
  .normalize('NFKD')
  .replace(/[^\p{L}\p{N}._-]+/gu, '-')
  .replace(/^-+|-+$/g, '')
  .slice(0, 64) || 'quiz-arena-test';

const answerLabel = (index: unknown) =>
  Number.isInteger(index) && Number(index) >= 0 ? String.fromCharCode(65 + Number(index)) : '—';

const completedAt = (value: string | Date) => {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? String(value) : date.toISOString();
};

function buildHtml(attempt: ExportAttempt): string {
  const rows = (attempt.review || []).map((item, index) => {
    const options = Array.isArray(item.options) ? item.options : [];
    return `
      <section class="question">
        <h2>${index + 1}. ${escapeHtml(item.question)}</h2>
        <ol type="A">${options.map((option, optionIndex) =>
          `<li class="${optionIndex === item.correctAnswer ? 'correct' : ''}">${escapeHtml(option)}</li>`
        ).join('')}</ol>
        <p><strong>Tanlangan javob:</strong> ${escapeHtml(answerLabel(item.selectedAnswer))}</p>
        <p><strong>To‘g‘ri javob:</strong> ${escapeHtml(answerLabel(item.correctAnswer))}</p>
        <p><strong>Izoh:</strong> ${escapeHtml(item.explanation || '')}</p>
        ${item.aiExplanation ? `<p><strong>AI tahlili:</strong> ${escapeHtml(item.aiExplanation)}</p>` : ''}
      </section>`;
  }).join('');

  return `<!doctype html>
<html lang="uz"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>${escapeHtml(attempt.topicName)} · QUIZ ARENA</title>
<style>
@page{size:A4;margin:18mm}*{box-sizing:border-box}body{font-family:Arial,"DejaVu Sans",sans-serif;color:#211b35;line-height:1.55;font-size:11pt}
header{padding:22px;background:#21133f;color:#fff;border-radius:14px}header small{color:#d9cff7;letter-spacing:2px;font-weight:bold}
h1{font-size:22pt;margin:8px 0}header p{margin:3px 0;color:#eee8ff}.summary{display:flex;gap:10px;margin:16px 0}
.metric{background:#f3efff;padding:10px 14px;border-radius:9px;flex:1}.metric strong{display:block;font-size:17pt;color:#5637a5}
.question{break-inside:avoid;border:1px solid #e5def2;border-radius:12px;padding:14px;margin:12px 0}
.question h2{font-size:13pt;margin:0 0 8px}.question li{padding:3px}.correct{font-weight:bold;color:#16845d}
p{margin:6px 0}.footer{margin-top:22px;color:#817991;font-size:9pt}
</style></head><body>
<header><small>QUIZ ARENA · TEST EKSPORTI</small><h1>${escapeHtml(attempt.topicName)}</h1>
<p>${escapeHtml(attempt.subjectName)}</p><p>Sana: ${escapeHtml(completedAt(attempt.completedAt))}</p></header>
<div class="summary"><div class="metric"><strong>${attempt.correctAnswers}/${attempt.totalQuestions}</strong>To‘g‘ri javob</div>
<div class="metric"><strong>${Number(attempt.accuracy).toFixed(1)}%</strong>Aniqlik</div></div>
${rows || '<p>Bu test uchun savollar tahlili saqlanmagan.</p>'}
<div class="footer">Test ma’lumotlari saqlangan natijadan o‘zgartirilmasdan eksport qilindi.</div>
</body></html>`;
}

function buildText(attempt: ExportAttempt): string {
  const lines = [
    'QUIZ ARENA — TEST NATIJASI',
    attempt.topicName,
    attempt.subjectName,
    `Sana: ${completedAt(attempt.completedAt)}`,
    `Natija: ${attempt.correctAnswers}/${attempt.totalQuestions} (${Number(attempt.accuracy).toFixed(1)}%)`,
    '',
  ];
  (attempt.review || []).forEach((item, index) => {
    lines.push(`${index + 1}. ${item.question}`);
    (Array.isArray(item.options) ? item.options : []).forEach((option, optionIndex) => {
      lines.push(`  ${answerLabel(optionIndex)}. ${option}`);
    });
    lines.push(`  Tanlangan javob: ${answerLabel(item.selectedAnswer)}`);
    lines.push(`  To‘g‘ri javob: ${answerLabel(item.correctAnswer)}`);
    lines.push(`  Izoh: ${item.explanation || ''}`);
    if (item.aiExplanation) lines.push(`  AI tahlili: ${item.aiExplanation}`);
    lines.push('');
  });
  return lines.join('\n');
}

function csvCell(value: unknown): string {
  let text = String(value ?? '');
  // Neutralize spreadsheet formula execution while retaining the original value in JSON/other formats.
  if (/^[\u0000-\u0020]*[=+\-@]/.test(text)) text = "'" + text;
  return '"' + text.replace(/"/g, '""') + '"';
}

function buildCsv(attempt: ExportAttempt): string {
  const optionCount = Math.max(4, ...(attempt.review || []).map((item) => Array.isArray(item.options) ? item.options.length : 0));
  const optionHeaders = Array.from({ length: optionCount }, (_, index) => `option_${answerLabel(index)}`);
  const header = ['question_number', 'question', ...optionHeaders, 'selected_answer', 'correct_answer', 'explanation', 'ai_explanation'];
  const rows = (attempt.review || []).map((item, index) => {
    const options = Array.isArray(item.options) ? item.options : [];
    return [
      index + 1, item.question, ...Array.from({ length: optionCount }, (_, optionIndex) => options[optionIndex] ?? ''),
      answerLabel(item.selectedAnswer), answerLabel(item.correctAnswer), item.explanation || '', item.aiExplanation || '',
    ].map(csvCell).join(',');
  });
  return '\uFEFF' + [header.map(csvCell).join(','), ...rows].join('\r\n');
}

function buildMarkdown(attempt: ExportAttempt): string {
  const lines = [
    `# ${attempt.topicName}`,
    '',
    `- **Fan:** ${attempt.subjectName}`,
    `- **Sana:** ${completedAt(attempt.completedAt)}`,
    `- **Natija:** ${attempt.correctAnswers}/${attempt.totalQuestions}`,
    `- **Aniqlik:** ${Number(attempt.accuracy).toFixed(1)}%`,
    '',
  ];
  (attempt.review || []).forEach((item, index) => {
    lines.push(`## ${index + 1}. ${item.question}`, '');
    (Array.isArray(item.options) ? item.options : []).forEach((option, optionIndex) => {
      lines.push(`- ${answerLabel(optionIndex)}. ${option}`);
    });
    lines.push('', `- Tanlangan javob: ${answerLabel(item.selectedAnswer)}`, `- To‘g‘ri javob: ${answerLabel(item.correctAnswer)}`, '');
    if (item.explanation) lines.push(`**Izoh:** ${item.explanation}`, '');
    if (item.aiExplanation) lines.push(`**AI tahlili:** ${item.aiExplanation}`, '');
  });
  return lines.join('\n');
}

const utf8 = (value: string) => new TextEncoder().encode(value);
const concatBytes = (parts: Uint8Array[]) => {
  const size = parts.reduce((sum, part) => sum + part.length, 0);
  const result = new Uint8Array(size);
  let offset = 0;
  parts.forEach((part) => { result.set(part, offset); offset += part.length; });
  return result;
};
const u16 = (value: number) => new Uint8Array([value & 255, (value >>> 8) & 255]);
const u32 = (value: number) => new Uint8Array([value & 255, (value >>> 8) & 255, (value >>> 16) & 255, (value >>> 24) & 255]);

function crc32(bytes: Uint8Array): number {
  let crc = 0xffffffff;
  for (const byte of bytes) {
    crc ^= byte;
    for (let bit = 0; bit < 8; bit += 1) crc = (crc >>> 1) ^ ((crc & 1) ? 0xedb88320 : 0);
  }
  return (crc ^ 0xffffffff) >>> 0;
}

function zipStore(files: Array<{ name: string; content: string }>): Uint8Array {
  const local: Uint8Array[] = [];
  const central: Uint8Array[] = [];
  let offset = 0;
  for (const file of files) {
    const name = utf8(file.name);
    const data = utf8(file.content);
    const crc = crc32(data);
    const header = concatBytes([
      u32(0x04034b50), u16(20), u16(0x0800), u16(0), u16(0), u16(0),
      u32(crc), u32(data.length), u32(data.length), u16(name.length), u16(0), name,
    ]);
    local.push(header, data);
    const directory = concatBytes([
      u32(0x02014b50), u16(20), u16(20), u16(0x0800), u16(0), u16(0), u16(0),
      u32(crc), u32(data.length), u32(data.length), u16(name.length), u16(0), u16(0),
      u16(0), u16(0), u32(0), u32(offset), name,
    ]);
    central.push(directory);
    offset += header.length + data.length;
  }
  const centralBytes = concatBytes(central);
  const localBytes = concatBytes(local);
  const end = concatBytes([
    u32(0x06054b50), u16(0), u16(0), u16(files.length), u16(files.length),
    u32(centralBytes.length), u32(localBytes.length), u16(0),
  ]);
  return concatBytes([localBytes, centralBytes, end]);
}

const toBase64 = (bytes: Uint8Array) => {
  const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';
  let result = '';
  for (let index = 0; index < bytes.length; index += 3) {
    const a = bytes[index], b = bytes[index + 1], c = bytes[index + 2];
    result += alphabet[a >> 2];
    result += alphabet[((a & 3) << 4) | ((b ?? 0) >> 4)];
    result += index + 1 < bytes.length ? alphabet[((b & 15) << 2) | ((c ?? 0) >> 6)] : '=';
    result += index + 2 < bytes.length ? alphabet[(c ?? 0) & 63] : '=';
  }
  return result;
};

function docxFiles(attempt: ExportAttempt) {
  const paragraphs = [
    `<w:p><w:r><w:rPr><w:b/><w:sz w:val="32"/></w:rPr><w:t xml:space="preserve">${escapeXml(attempt.topicName)}</w:t></w:r></w:p>`,
    `<w:p><w:r><w:t xml:space="preserve">${escapeXml(attempt.subjectName)} · ${escapeXml(completedAt(attempt.completedAt))}</w:t></w:r></w:p>`,
    `<w:p><w:r><w:t>Natija: ${attempt.correctAnswers}/${attempt.totalQuestions} · ${Number(attempt.accuracy).toFixed(1)}%</w:t></w:r></w:p>`,
    ...(attempt.review || []).flatMap((item, index) => [
      `<w:p><w:r><w:rPr><w:b/></w:rPr><w:t xml:space="preserve">${index + 1}. ${escapeXml(item.question)}</w:t></w:r></w:p>`,
      ...(Array.isArray(item.options) ? item.options : []).map((option, optionIndex) =>
        `<w:p><w:r><w:t xml:space="preserve">${answerLabel(optionIndex)}. ${escapeXml(option)}</w:t></w:r></w:p>`),
      `<w:p><w:r><w:t xml:space="preserve">Tanlangan javob: ${answerLabel(item.selectedAnswer)} · To‘g‘ri javob: ${answerLabel(item.correctAnswer)}</w:t></w:r></w:p>`,
      `<w:p><w:r><w:t xml:space="preserve">Izoh: ${escapeXml(item.explanation || '')}</w:t></w:r></w:p>`,
      ...(item.aiExplanation ? [`<w:p><w:r><w:t xml:space="preserve">AI tahlili: ${escapeXml(item.aiExplanation)}</w:t></w:r></w:p>`] : []),
      '<w:p/>',
    ]),
  ].join('');
  return [
    { name: '[Content_Types].xml', content: '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/></Types>' },
    { name: '_rels/.rels', content: '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/></Relationships>' },
    { name: 'word/document.xml', content: `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:body>${paragraphs}<w:sectPr><w:pgSz w:w="11906" w:h="16838"/><w:pgMar w:top="1134" w:right="1134" w:bottom="1134" w:left="1134"/></w:sectPr></w:body></w:document>` },
  ];
}

function pptxFiles(attempt: ExportAttempt) {
  const allSlides = [
    { title: attempt.topicName, body: [attempt.subjectName, `Natija: ${attempt.correctAnswers}/${attempt.totalQuestions} · ${Number(attempt.accuracy).toFixed(1)}%`, completedAt(attempt.completedAt)] },
    ...(attempt.review || []).map((item, index) => ({
      title: `Savol ${index + 1}: ${item.question}`,
      body: [
        ...(Array.isArray(item.options) ? item.options : []).map((option, optionIndex) => `${answerLabel(optionIndex)}. ${option}`),
        `Tanlangan javob: ${answerLabel(item.selectedAnswer)}`,
        `To‘g‘ri javob: ${answerLabel(item.correctAnswer)}`,
        `Izoh: ${item.explanation || ''}`,
        ...(item.aiExplanation ? [`AI tahlili: ${item.aiExplanation}`] : []),
      ],
    })),
  ];
  const files: Array<{ name: string; content: string }> = [];
  const slideIds = allSlides.map((_, index) => `<p:sldId id="${256 + index}" r:id="rId${index + 2}"/>`).join('');
  files.push(
    { name: '[Content_Types].xml', content: `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/ppt/presentation.xml" ContentType="application/vnd.openxmlformats-officedocument.presentationml.presentation.main+xml"/><Override PartName="/ppt/slideMasters/slideMaster1.xml" ContentType="application/vnd.openxmlformats-officedocument.presentationml.slideMaster+xml"/><Override PartName="/ppt/slideLayouts/slideLayout1.xml" ContentType="application/vnd.openxmlformats-officedocument.presentationml.slideLayout+xml"/><Override PartName="/ppt/theme/theme1.xml" ContentType="application/vnd.openxmlformats-officedocument.theme+xml"/>${allSlides.map((_, i) => `<Override PartName="/ppt/slides/slide${i + 1}.xml" ContentType="application/vnd.openxmlformats-officedocument.presentationml.slide+xml"/>`).join('')}</Types>` },
    { name: '_rels/.rels', content: '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="ppt/presentation.xml"/></Relationships>' },
    { name: 'ppt/presentation.xml', content: `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><p:presentation xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships" xmlns:p="http://schemas.openxmlformats.org/presentationml/2006/main"><p:sldMasterIdLst><p:sldMasterId id="2147483648" r:id="rId1"/></p:sldMasterIdLst><p:sldIdLst>${slideIds}</p:sldIdLst><p:sldSz cx="12192000" cy="6858000" type="wide"/><p:notesSz cx="6858000" cy="9144000"/></p:presentation>` },
    { name: 'ppt/_rels/presentation.xml.rels', content: `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/slideMaster" Target="slideMasters/slideMaster1.xml"/>${allSlides.map((_, i) => `<Relationship Id="rId${i + 2}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/slide" Target="slides/slide${i + 1}.xml"/>`).join('')}</Relationships>` },
    { name: 'ppt/slideMasters/slideMaster1.xml', content: '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><p:sldMaster xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships" xmlns:p="http://schemas.openxmlformats.org/presentationml/2006/main"><p:cSld><p:spTree><p:nvGrpSpPr><p:cNvPr id="1" name=""/><p:cNvGrpSpPr/><p:nvPr/></p:nvGrpSpPr><p:grpSpPr><a:xfrm><a:off x="0" y="0"/><a:ext cx="0" cy="0"/><a:chOff x="0" y="0"/><a:chExt cx="0" cy="0"/></a:xfrm></p:grpSpPr></p:spTree></p:cSld><p:clrMap accent1="5637A5" accent2="159B68" accent3="F2C14E" accent4="DC4C64" accent5="7A6AA8" accent6="A58BE8" bg1="lt1" bg2="lt2" tx1="dk1" tx2="dk2" hlink="hlink" folHlink="folHlink"/><p:sldLayoutIdLst><p:sldLayoutId id="1" r:id="rId1"/></p:sldLayoutIdLst></p:sldMaster>' },
    { name: 'ppt/slideMasters/_rels/slideMaster1.xml.rels', content: '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/slideLayout" Target="../slideLayouts/slideLayout1.xml"/><Relationship Id="rId2" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/theme" Target="../theme/theme1.xml"/></Relationships>' },
    { name: 'ppt/slideLayouts/slideLayout1.xml', content: '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><p:sldLayout xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships" xmlns:p="http://schemas.openxmlformats.org/presentationml/2006/main" type="blank" preserve="1"><p:cSld name="Blank"><p:spTree><p:nvGrpSpPr><p:cNvPr id="1" name=""/><p:cNvGrpSpPr/><p:nvPr/></p:nvGrpSpPr><p:grpSpPr><a:xfrm><a:off x="0" y="0"/><a:ext cx="0" cy="0"/><a:chOff x="0" y="0"/><a:chExt cx="0" cy="0"/></a:xfrm></p:grpSpPr></p:spTree></p:cSld><p:clrMapOvr><a:masterClrMapping/></p:clrMapOvr></p:sldLayout>' },
    { name: 'ppt/slideLayouts/_rels/slideLayout1.xml.rels', content: '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/slideMaster" Target="../slideMasters/slideMaster1.xml"/></Relationships>' },
    { name: 'ppt/theme/theme1.xml', content: '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><a:theme xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" name="Quiz Arena"><a:themeElements><a:clrScheme name="Quiz Arena"><a:dk1><a:srgbClr val="21133F"/></a:dk1><a:lt1><a:srgbClr val="FFFFFF"/></a:lt1><a:dk2><a:srgbClr val="5637A5"/></a:dk2><a:lt2><a:srgbClr val="F4F0FF"/></a:lt2><a:accent1><a:srgbClr val="6653D8"/></a:accent1><a:accent2><a:srgbClr val="159B68"/></a:accent2><a:accent3><a:srgbClr val="F2C14E"/></a:accent3><a:accent4><a:srgbClr val="DC4C64"/></a:accent4><a:accent5><a:srgbClr val="7A6AA8"/></a:accent5><a:accent6><a:srgbClr val="A58BE8"/></a:accent6><a:hlink><a:srgbClr val="0000FF"/></a:hlink><a:folHlink><a:srgbClr val="800080"/></a:folHlink></a:clrScheme><a:fontScheme name="Quiz Arena"><a:majorFont><a:latin typeface="Arial"/><a:ea typeface="Arial"/><a:cs typeface="Arial"/></a:majorFont><a:minorFont><a:latin typeface="Arial"/><a:ea typeface="Arial"/><a:cs typeface="Arial"/></a:minorFont></a:fontScheme><a:fmtScheme name="Quiz Arena"><a:fillStyleLst/><a:lnStyleLst/><a:effectStyleLst/><a:bgFillStyleLst/></a:fmtScheme></a:themeElements></a:theme>' },
  );
  allSlides.forEach((slide, index) => {
    const shape = (id: number, name: string, text: string, y: number, height: number, size: number, bold: boolean) =>
      `<p:sp><p:nvSpPr><p:cNvPr id="${id}" name="${escapeXml(name)}"/><p:cNvSpPr/><p:nvPr/></p:nvSpPr><p:spPr><a:xfrm><a:off x="650000" y="${y}"/><a:ext cx="10800000" cy="${height}"/></a:xfrm><a:prstGeom prst="rect"><a:avLst/></a:prstGeom><a:noFill/><a:ln><a:noFill/></a:ln></p:spPr><p:txBody><a:bodyPr wrap="square" anchor="ctr"/><a:lstStyle/><a:p><a:pPr/><a:r><a:rPr lang="uz-UZ" sz="${size}" b="${bold ? 1 : 0}"><a:solidFill><a:srgbClr val="${bold ? '5637A5' : '211B35'}"/></a:solidFill><a:latin typeface="Arial"/></a:rPr><a:t xml:space="preserve">${escapeXml(text)}</a:t></a:r><a:endParaRPr lang="uz-UZ"/></a:p></p:txBody></p:sp>`;
    const bodyGap = Math.min(560000, Math.floor(4_600_000 / Math.max(1, slide.body.length)));
    const bodyFontSize = slide.body.length > 8 ? 1350 : 1750;
    const bodyShapes = slide.body.map((line, lineIndex) => shape(lineIndex + 3, `Line ${lineIndex + 1}`, line, 1550000 + lineIndex * bodyGap, Math.max(280000, bodyGap - 40000), bodyFontSize, false)).join('');
    const slideXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><p:sld xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships" xmlns:p="http://schemas.openxmlformats.org/presentationml/2006/main"><p:cSld><p:bg><p:bgPr><a:solidFill><a:srgbClr val="FFFFFF"/></a:solidFill><a:effectLst/></p:bgPr></p:bg><p:spTree><p:nvGrpSpPr><p:cNvPr id="1" name=""/><p:cNvGrpSpPr/><p:nvPr/></p:nvGrpSpPr><p:grpSpPr><a:xfrm><a:off x="0" y="0"/><a:ext cx="0" cy="0"/><a:chOff x="0" y="0"/><a:chExt cx="0" cy="0"/></a:xfrm></p:grpSpPr>${shape(2, 'Title', slide.title, 650000, 900000, 2700, true)}${bodyShapes}</p:spTree></p:cSld><p:clrMapOvr><a:masterClrMapping/></p:clrMapOvr></p:sld>`;
    files.push({ name: `ppt/slides/slide${index + 1}.xml`, content: slideXml });
    files.push({ name: `ppt/slides/_rels/slide${index + 1}.xml.rels`, content: '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/slideLayout" Target="../slideLayouts/slideLayout1.xml"/></Relationships>' });
  });
  return files;
}

function fromBase64(value: string): Uint8Array {
  const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';
  const clean = value.replace(/[^A-Za-z0-9+/=]/g, '');
  const output: number[] = [];
  for (let index = 0; index < clean.length; index += 4) {
    const a = alphabet.indexOf(clean[index]);
    const b = alphabet.indexOf(clean[index + 1]);
    const c = alphabet.indexOf(clean[index + 2]);
    const d = alphabet.indexOf(clean[index + 3]);
    output.push((a << 2) | (b >> 4));
    if (clean[index + 2] !== '=') output.push(((b & 15) << 4) | (c >> 2));
    if (clean[index + 3] !== '=') output.push(((c & 3) << 6) | d);
  }
  return new Uint8Array(output);
}

async function writeAndShare(name: string, extension: string, mimeType: string, content: string, encoding: 'utf8' | 'base64' = 'utf8') {
  if (Platform.OS === 'web') {
    const bytes = encoding === 'base64' ? fromBase64(content) : utf8(content);
    const blob = new Blob([bytes], { type: mimeType });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = `${name}.${extension}`;
    anchor.style.display = 'none';
    document.body.appendChild(anchor);
    anchor.click();
    document.body.removeChild(anchor);
    window.setTimeout(() => URL.revokeObjectURL(url), 1000);
    return;
  }
  const directory = FileSystem.cacheDirectory;
  if (!directory) throw new Error('Fayl saqlash joyi topilmadi.');
  const uri = directory + name + '.' + extension;
  await FileSystem.writeAsStringAsync(uri, content, { encoding });
  if (!(await Sharing.isAvailableAsync())) throw new Error('Bu qurilmada fayl ulashish imkoniyati mavjud emas.');
  await Sharing.shareAsync(uri, { mimeType, dialogTitle: 'Testni eksport qilish', UTI: extension });
}

export async function exportLearningAttempt(attempt: ExportAttempt, format: TestExportFormat): Promise<void> {
  if (!attempt || !Array.isArray(attempt.review)) throw new Error('Test savollari eksport uchun topilmadi.');
  if (!attempt.review.length) throw new Error('Bu testning savollar tahlili tarixda saqlanmagan. Faqat natija mavjud bo‘lgani uchun to‘liq eksport qilib bo‘lmaydi.');
  if (attempt.review.length && attempt.review.length !== attempt.totalQuestions) {
    throw new Error('Saqlangan savollar soni test natijasiga mos kelmaydi. Fayl eksport qilinmadi.');
  }
  const baseName = safeFileName(attempt.topicName || 'quiz-arena-test');
  if (format === 'pdf') {
    const html = buildHtml(attempt);
    if (Platform.OS === 'web') {
      await Print.printAsync({ html });
      return;
    }
    const file = await Print.printToFileAsync({ html, width: 595, height: 842 });
    if (!(await Sharing.isAvailableAsync())) throw new Error('Bu qurilmada PDF ulashish imkoniyati mavjud emas.');
    await Sharing.shareAsync(file.uri, { mimeType: 'application/pdf', dialogTitle: 'Testni PDF sifatida eksport qilish', UTI: 'com.adobe.pdf' });
    return;
  }
  if (format === 'html') return writeAndShare(baseName, 'html', 'text/html', buildHtml(attempt));
  if (format === 'txt') return writeAndShare(baseName, 'txt', 'text/plain', buildText(attempt));
  if (format === 'csv') return writeAndShare(baseName, 'csv', 'text/csv', buildCsv(attempt));
  if (format === 'json') return writeAndShare(baseName, 'json', 'application/json', JSON.stringify(attempt, null, 2));
  if (format === 'md') return writeAndShare(baseName, 'md', 'text/markdown', buildMarkdown(attempt));
  const bytes = zipStore(format === 'docx' ? docxFiles(attempt) : pptxFiles(attempt));
  return writeAndShare(
    baseName,
    format,
    format === 'docx'
      ? 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
      : 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
    toBase64(bytes),
    'base64',
  );
}
