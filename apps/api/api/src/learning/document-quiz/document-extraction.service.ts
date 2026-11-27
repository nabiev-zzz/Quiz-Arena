import { BadRequestException, Injectable, Logger } from '@nestjs/common';
import { inflateRawSync } from 'node:zlib';

export const MAX_DOCUMENT_BYTES = 20 * 1024 * 1024;
export const MIN_DOCUMENT_TEXT_LENGTH = 80;
export type SupportedDocumentExtension = 'pdf' | 'docx' | 'pptx' | 'txt' | 'md' | 'csv' | 'png' | 'jpg' | 'jpeg';
export interface ExtractedDocument { text: string; extension: SupportedDocumentExtension; needsVision: boolean; mimeType: string; }

const MIME_BY_EXTENSION: Record<SupportedDocumentExtension, string[]> = {
  pdf: ['application/pdf'],
  docx: ['application/vnd.openxmlformats-officedocument.wordprocessingml.document', 'application/zip'],
  pptx: ['application/vnd.openxmlformats-officedocument.presentationml.presentation', 'application/zip'],
  txt: ['text/plain'], md: ['text/markdown', 'text/x-markdown', 'text/plain'], csv: ['text/csv', 'text/plain'],
  png: ['image/png'], jpg: ['image/jpeg'], jpeg: ['image/jpeg'],
};

@Injectable()
export class DocumentExtractionService {
  private readonly logger = new Logger(DocumentExtractionService.name);

  validate(file: { buffer: Buffer; originalname: string; mimetype: string; size?: number }): { safeName: string; extension: SupportedDocumentExtension } {
    if (!file?.buffer || !Buffer.isBuffer(file.buffer) || file.buffer.length === 0) throw new BadRequestException('Fayl bo‘sh. Iltimos, matn mavjud hujjatni tanlang.');
    if (file.buffer.length > MAX_DOCUMENT_BYTES) throw new BadRequestException('Fayl hajmi 20 MB dan oshmasligi kerak.');
    const safeName = sanitizeDocumentFileName(file.originalname);
    const extension = safeName.toLowerCase().split('.').pop() as SupportedDocumentExtension;
    if (!Object.prototype.hasOwnProperty.call(MIME_BY_EXTENSION, extension)) throw new BadRequestException('Bu fayl formati qo‘llab-quvvatlanmaydi. PDF, DOCX, PPTX, TXT, MD, PNG yoki JPG yuboring.');
    const mime = String(file.mimetype || '').split(';')[0].trim().toLowerCase();
    if (mime && mime !== 'application/octet-stream' && !MIME_BY_EXTENSION[extension].includes(mime)) throw new BadRequestException('Fayl turi va kengaytmasi mos kelmayapti. Faylni qayta tanlang.');
    this.validateSignature(file.buffer, extension);
    return { safeName, extension };
  }

  async extract(file: { buffer: Buffer; originalname: string; mimetype: string; size?: number }): Promise<ExtractedDocument> {
    const { extension } = this.validate(file);
    const mimeType = MIME_BY_EXTENSION[extension][0];
    try {
      if (extension === 'pdf') {
        const text = cleanDocumentText(await this.extractPdf(file.buffer));
        return { text, extension, needsVision: text.length < MIN_DOCUMENT_TEXT_LENGTH, mimeType: 'application/pdf' };
      }
      if (extension === 'docx' || extension === 'pptx') {
        const entries = this.readZipEntries(file.buffer);
        const text = extension === 'docx' ? this.extractDocx(entries) : this.extractPptx(entries);
        return this.textResult(text, extension, mimeType);
      }
      if (extension === 'png' || extension === 'jpg' || extension === 'jpeg') return { text: '', extension, needsVision: true, mimeType };
      const text = file.buffer.toString('utf8');
      if (text.includes('\u0000') || text.includes('\ufffd')) throw new BadRequestException('Matnli fayl kodlanishi buzilgan. UTF-8 formatida qayta saqlang.');
      return this.textResult(text, extension, mimeType);
    } catch (error) {
      if (error instanceof BadRequestException) throw error;
      this.logger.warn(`Document extraction failed; type=${extension}; bytes=${file.buffer.length}; reason=${error instanceof Error ? error.name : 'unknown'}`);
      const message = error instanceof Error ? error.message.toLowerCase() : '';
      if (message.includes('password') || message.includes('encrypt')) throw new BadRequestException('Bu hujjat parol bilan himoyalangan. Parolsiz nusxasini yuklang.');
      throw new BadRequestException('Hujjat buzilgan yoki o‘qib bo‘lmadi. Faylni qayta saqlab, yana yuboring.');
    }
  }

  private textResult(value: string, extension: SupportedDocumentExtension, mimeType: string): ExtractedDocument {
    const text = cleanDocumentText(value);
    if (text.length < MIN_DOCUMENT_TEXT_LENGTH) throw new BadRequestException('Hujjatda test yaratish uchun yetarli o‘qiladigan matn topilmadi. Boshqa fayl yoki aniqroq skan yuboring.');
    return { text, extension, needsVision: false, mimeType };
  }

  private validateSignature(buffer: Buffer, extension: SupportedDocumentExtension) {
    const valid = extension === 'pdf' ? buffer.subarray(0, 5).toString('ascii') === '%PDF-'
      : extension === 'png' ? buffer.subarray(0, 8).equals(Buffer.from([137,80,78,71,13,10,26,10]))
      : extension === 'jpg' || extension === 'jpeg' ? buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff
      : extension === 'docx' || extension === 'pptx' ? buffer[0] === 0x50 && buffer[1] === 0x4b : true;
    if (!valid && (extension === 'docx' || extension === 'pptx') && buffer.subarray(0, 4).equals(Buffer.from([0xd0,0xcf,0x11,0xe0]))) throw new BadRequestException('Bu Office hujjati parol bilan himoyalangan yoki shifrlangan. Parolsiz nusxasini yuklang.');
    if (!valid) throw new BadRequestException('Fayl kengaytmasi uning haqiqiy formatiga mos emas yoki fayl buzilgan.');
  }

  private async extractPdf(buffer: Buffer): Promise<string> {
    const pdfjs = await import('pdfjs-dist/legacy/build/pdf.mjs');
    const task = pdfjs.getDocument({ data: new Uint8Array(buffer), useSystemFonts: true, disableFontFace: true, stopAtErrors: true });
    try {
      const doc = await task.promise;
      if (doc.numPages > 500) throw new BadRequestException('PDF hujjat 500 sahifadan oshmasligi kerak.');
      const pages: string[] = []; let length = 0;
      for (let pageNo = 1; pageNo <= doc.numPages && length < 120_000; pageNo += 1) {
        const page = await doc.getPage(pageNo); const content = await page.getTextContent();
        const line = content.items.map((item) => ('str' in item && typeof item.str === 'string' ? item.str : '')).filter(Boolean).join(' ');
        if (line) { const piece = line.slice(0, 120_000 - length); pages.push(piece); length += piece.length; }
      }
      return pages.join('\n');
    } finally { await task.destroy(); }
  }


  private readZipEntries(buffer: Buffer): Map<string, Buffer> {
    const eocd = buffer.lastIndexOf(Buffer.from([0x50,0x4b,0x05,0x06]));
    if (eocd < 0 || eocd + 22 > buffer.length) throw new BadRequestException('Office hujjatining ZIP tuzilmasi noto‘g‘ri.');
    const count = buffer.readUInt16LE(eocd + 10);
    let cursor = buffer.readUInt32LE(eocd + 16);
    if (count > 10_000 || cursor >= buffer.length) throw new BadRequestException('Office hujjati ichki tuzilmasi xavfsiz chegaradan oshdi.');
    const entries = new Map<string, Buffer>(); let expanded = 0;
    for (let index = 0; index < count; index += 1) {
      if (cursor + 46 > buffer.length || buffer.readUInt32LE(cursor) !== 0x02014b50) throw new BadRequestException('Office hujjatining ZIP katalogi buzilgan.');
      const flags = buffer.readUInt16LE(cursor + 8); const method = buffer.readUInt16LE(cursor + 10);
      const compressedSize = buffer.readUInt32LE(cursor + 20); const uncompressedSize = buffer.readUInt32LE(cursor + 24);
      const nameLength = buffer.readUInt16LE(cursor + 28); const extraLength = buffer.readUInt16LE(cursor + 30); const commentLength = buffer.readUInt16LE(cursor + 32);
      const localOffset = buffer.readUInt32LE(cursor + 42);
      const name = buffer.toString('utf8', cursor + 46, cursor + 46 + nameLength);
      if ((flags & 1) !== 0) throw new BadRequestException('Bu Office hujjati parol bilan himoyalangan. Parolsiz nusxasini yuklang.');
      expanded += uncompressedSize;
      if (expanded > 150 * 1024 * 1024 || (compressedSize > 0 && uncompressedSize / compressedSize > 250)) throw new BadRequestException('Office hujjatining ichki hajmi xavfsiz chegaradan oshdi.');
      if (localOffset + 30 > buffer.length || buffer.readUInt32LE(localOffset) !== 0x04034b50) throw new BadRequestException('Office hujjatining ichki fayli buzilgan.');
      const localName = buffer.readUInt16LE(localOffset + 26); const localExtra = buffer.readUInt16LE(localOffset + 28);
      const dataStart = localOffset + 30 + localName + localExtra; const dataEnd = dataStart + compressedSize;
      if (dataEnd > buffer.length) throw new BadRequestException('Office hujjati to‘liq yuklanmagan.');
      if (name.endsWith('.xml')) {
        const compressed = buffer.subarray(dataStart, dataEnd);
        const data = method === 0 ? Buffer.from(compressed) : method === 8 ? inflateRawSync(compressed, { maxOutputLength: 20 * 1024 * 1024 }) : null;
        if (!data) throw new BadRequestException('Office hujjatining siqish formati qo‘llab-quvvatlanmaydi.');
        if (data.length !== uncompressedSize) throw new BadRequestException('Office hujjatining ichki XML fayli buzilgan.');
        entries.set(name, data);
      }
      cursor += 46 + nameLength + extraLength + commentLength;
    }
    return entries;
  }

  private extractDocx(entries: Map<string, Buffer>): string {
    const xml = entries.get('word/document.xml');
    if (!xml) throw new BadRequestException('DOCX hujjatidan matn topilmadi yoki fayl buzilgan.');
    const value = xml.toString('utf8').replace(/<w:tab[^>]*\/>/g, ' ').replace(/<w:br[^>]*\/>/g, '\n').replace(/<\/w:p>/g, '\n').replace(/<[^>]+>/g, ' ');
    return decodeXml(value);
  }

  private extractPptx(entries: Map<string, Buffer>): string {
    const slides = [...entries.entries()].filter(([name]) => /^ppt\/slides\/slide\d+\.xml$/i.test(name));
    slides.sort((a,b) => Number(a[0].match(/slide(\d+)/i)?.[1] || 0) - Number(b[0].match(/slide(\d+)/i)?.[1] || 0));
    return slides.map(([name, data]) => {
      const xml = data.toString('utf8');
      const texts = [...xml.matchAll(/<a:t[^>]*>([\s\S]*?)<\/a:t>/g)].map((match) => decodeXml(match[1]));
      return `${name}\n${texts.join(' ')}`;
    }).join('\n');
  }
}

function decodeXml(value: string): string {
  return value.replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&apos;/g, "'")
    .replace(/&#(x[0-9a-f]+|\d+);/gi, (_match, code) => { const n = code[0].toLowerCase() === 'x' ? parseInt(code.slice(1), 16) : Number(code); return Number.isInteger(n) && n >= 0 && n <= 0x10ffff ? String.fromCodePoint(n) : ''; });
}

export function cleanDocumentText(input: string): string {
  const normalized = String(input || '').replace(/\r\n?/g, '\n').replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f]/g, '');
  const lines = normalized.split('\n').map((line) => line.replace(/[\t\f\v ]+/g, ' ').trim());
  const counts = new Map<string, number>();
  for (const line of lines) if (line.length > 3) counts.set(line.toLocaleLowerCase(), (counts.get(line.toLocaleLowerCase()) || 0) + 1);
  const filtered = lines.filter((line) => { if (!line) return true; const lower = line.toLocaleLowerCase(); if ((counts.get(lower) || 0) >= 3) return false; if (/^(page\s+)?\d+(\s*\/\s*\d+)?$/i.test(line)) return false; return true; });
  return filtered.join('\n').replace(/([A-Za-zА-Яа-яЁёЎўҚқҒғҲҳ])[-‐]\n([A-Za-zА-Яа-яЁёЎўҚқҒғҲҳ])/g, '$1$2').replace(/[ \t]+\n/g, '\n').replace(/\n{3,}/g, '\n\n').replace(/[ \t]{2,}/g, ' ').trim().slice(0, 120_000);
}

export function sanitizeDocumentFileName(value: string): string {
  const safe = Array.from(String(value || 'document')).filter((character) => character.charCodeAt(0) >= 32 && !'\\/:*?"<>|'.includes(character)).join('').trim().slice(0, 120);
  return safe || 'document';
}

