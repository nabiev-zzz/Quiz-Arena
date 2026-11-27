import { describe, expect, it, jest, beforeEach } from '@jest/globals';
import { deflateRawSync } from 'node:zlib';
import { getPlanEntitlements } from '../subscriptions/plan-entitlements';
import { LearningService } from './learning.service';
import { DocumentExtractionService } from './document-quiz/document-extraction.service';

function makePdf(text = ''): Buffer {
  const sentences = text.match(/[^.!?]+[.!?]?/g)?.map((value) => value.trim()).filter(Boolean) || [];
  const stream = sentences.length
    ? 'BT /F1 12 Tf 72 720 Td ' + sentences.map((sentence, index) => {
      const escaped = sentence.replace(/\\/g, '\\\\').replace(/\(/g, '\\(').replace(/\)/g, '\\)');
      return `${index ? '0 -20 Td ' : ''}(${escaped}) Tj`;
    }).join(' ') + ' ET'
    : '';
  const objects = [
    '<< /Type /Catalog /Pages 2 0 R >>',
    '<< /Type /Pages /Kids [3 0 R] /Count 1 >>',
    '<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Resources << /Font << /F1 4 0 R >> >> /Contents 5 0 R >>',
    '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>',
    `<< /Length ${Buffer.byteLength(stream)} >>\nstream\n${stream}\nendstream`,
  ];
  const chunks: Buffer[] = [Buffer.from('%PDF-1.4\n')];
  const offsets = [0];
  let position = chunks[0].length;
  objects.forEach((object, index) => {
    offsets.push(position);
    const chunk = Buffer.from(`${index + 1} 0 obj\n${object}\nendobj\n`);
    chunks.push(chunk);
    position += chunk.length;
  });
  const xrefOffset = position;
  const xref = ['xref', `0 ${objects.length + 1}`, '0000000000 65535 f ', ...offsets.slice(1).map((offset) => `${String(offset).padStart(10, '0')} 00000 n `)].join('\n');
  const trailer = `\ntrailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xrefOffset}\n%%EOF`;
  chunks.push(Buffer.from(`${xref}${trailer}`));
  return Buffer.concat(chunks);
}

function makeDocx(text: string): Buffer {
  const fileName = Buffer.from('word/document.xml');
  const xml = Buffer.from('<w:document xmlns:w="urn:w"><w:body><w:p><w:r><w:t>' + text + '</w:t></w:r></w:p></w:body></w:document>');
  const compressed = deflateRawSync(xml);

  const local = Buffer.alloc(30);
  local.writeUInt32LE(0x04034b50, 0);
  local.writeUInt16LE(20, 4);
  local.writeUInt16LE(8, 8);
  local.writeUInt32LE(compressed.length, 18);
  local.writeUInt32LE(xml.length, 22);
  local.writeUInt16LE(fileName.length, 26);
  const localBlock = Buffer.concat([local, fileName, compressed]);

  const central = Buffer.alloc(46);
  central.writeUInt32LE(0x02014b50, 0);
  central.writeUInt16LE(20, 4);
  central.writeUInt16LE(20, 6);
  central.writeUInt16LE(8, 10);
  central.writeUInt32LE(compressed.length, 20);
  central.writeUInt32LE(xml.length, 24);
  central.writeUInt16LE(fileName.length, 28);
  central.writeUInt32LE(0, 42);
  const centralBlock = Buffer.concat([central, fileName]);

  const end = Buffer.alloc(22);
  end.writeUInt32LE(0x06054b50, 0);
  end.writeUInt16LE(1, 8);
  end.writeUInt16LE(1, 10);
  end.writeUInt32LE(centralBlock.length, 12);
  end.writeUInt32LE(localBlock.length, 16);

  return Buffer.concat([localBlock, centralBlock, end]);
}

describe('LearningService document quiz generation', () => {
  const attemptsRepository = { find: jest.fn() };
  const aiService = {
    extractDocumentTextWithVision: jest.fn(),
    generateDocumentQuestions: jest.fn(),
  };
  const featureUsageService = { consume: jest.fn(), refund: jest.fn() };
  const subscriptionsService = { current: jest.fn() };
  const aiQueue = { enqueue: jest.fn() };
  const questionCache = { getDocumentText: jest.fn(), setDocumentText: jest.fn(), get: jest.fn(), set: jest.fn() };
  const extraction = new DocumentExtractionService();
  const service = new LearningService(
    attemptsRepository as never, {} as never, {} as never, {} as never,
    aiService as never, featureUsageService as never, subscriptionsService as never,
    questionCache as never, undefined, aiQueue as never, extraction,
  );
  const sourceText = 'Ta’lim jarayonida bilimlarni takrorlash orqali mustahkamlash muhim. O‘quvchilar mavzuni tahlil qilib, sabab va natijalarni tushunadilar. Ushbu material bilimlarni amaliy mashqlar yordamida rivojlantirishni tushuntiradi.';

  const makeQuestions = (count: number, prefix = 'Savol') => Array.from({ length: count }, (_, index) => ({
    question: `${prefix} ${index + 1}: ${['atom', 'energiya', 'hujayra', 'tabiat', 'molekula', 'modda', 'harorat', 'o‘simlik', 'suv', 'yorug‘lik'][index % 10]} mavzusining asosiy belgisi nima?`,
    options: [`Takrorlash orqali ${index}`, `Boshqa usul ${index}`, `Tasodifan ${index}`, `Umuman emas ${index}`],
    correctIndex: 0,
    explanation: 'Manbada bilimlarni takrorlash orqali mustahkamlash muhimligi ta’kidlangan.',
    difficulty: 'medium' as const,
  }));

  beforeEach(() => {
    jest.clearAllMocks();
    questionCache.getDocumentText.mockResolvedValue(null);
    questionCache.setDocumentText.mockResolvedValue(undefined);
    questionCache.get.mockResolvedValue(null);
    questionCache.set.mockResolvedValue(undefined);
    attemptsRepository.find.mockResolvedValue([]);
    subscriptionsService.current.mockResolvedValue({ tier: 'premium_pro', entitlements: getPlanEntitlements('premium_pro_monthly') });
    aiQueue.enqueue.mockResolvedValue({ status: 'queued', jobId: 'ai-job-1', message: 'Test tayyorlanmoqda' });
    featureUsageService.consume.mockResolvedValue({ allowed: true, featureKey: 'documentQuiz', tier: 'premium_pro', period: 'monthly', limit: 30, used: 1, remaining: 29 });
    aiService.extractDocumentTextWithVision.mockResolvedValue(sourceText);
    aiService.generateDocumentQuestions.mockImplementation(async (input: { count: number; language: string }) => ({ title: 'Ta’lim', language: input.language, questions: makeQuestions(input.count, `Savol-${aiService.generateDocumentQuestions.mock.calls.length}`) }));
  });

  it('extracts text, chunks it and generates the exact requested structured question count', async () => {
    const result = await service.createDocumentQuiz('user-1', {
      buffer: Buffer.from(sourceText), originalname: 'lesson.txt', mimetype: 'text/plain', size: Buffer.byteLength(sourceText),
    }, { count: '5', difficulty: 'medium', language: 'uz' }, { topicId: 'doc-5', _quotaReceipt: { allowed: true } }) as any;
    expect(result.questionCount).toBe(5);
    expect(result.questions).toHaveLength(5);
    expect(result.questions.every((item: any) => item.options.length === 4)).toBe(true);
    expect(aiService.generateDocumentQuestions).toHaveBeenCalledTimes(1);
    expect(featureUsageService.consume).not.toHaveBeenCalled();
  });

  it('caches extracted text by file hash for a short time and reuses it for different quiz settings', async () => {
    const file = { buffer: Buffer.from(sourceText), originalname: 'cached.txt', mimetype: 'text/plain', size: Buffer.byteLength(sourceText) };
    const first = await service.createDocumentQuiz('user-1', file, { count: '5' }, { topicId: 'doc-cache-1', _quotaReceipt: true }) as any;
    expect(first.questionCount).toBe(5);
    expect(questionCache.setDocumentText).toHaveBeenCalledWith(expect.stringMatching(/^[a-f0-9]{64}$/), sourceText);
    questionCache.getDocumentText.mockResolvedValue(sourceText);
    const extractSpy = jest.spyOn(extraction, 'extract');
    const second = await service.createDocumentQuiz('user-1', file, { count: '5', difficulty: 'hard' }, { topicId: 'doc-cache-2', _quotaReceipt: true }) as any;
    expect(second.questionCount).toBe(5);
    expect(extractSpy).not.toHaveBeenCalled();
    extractSpy.mockRestore();
  });

  it('splits long documents and distributes requested questions across chunks', async () => {
    const longText = Array.from({ length: 100 }, (_, index) => `Bo‘lim ${index}. ${sourceText}`).join('\n\n');
    const result = await service.createDocumentQuiz('user-1', {
      buffer: Buffer.from(longText), originalname: 'long.txt', mimetype: 'text/plain', size: Buffer.byteLength(longText),
    }, { count: '10' }, { topicId: 'doc-long', _quotaReceipt: true }) as any;
    expect(result.questionCount).toBe(10);
    expect(aiService.generateDocumentQuestions.mock.calls.length).toBeGreaterThan(1);
  });

  it('uses Gemini vision OCR for image scans and keeps the detected document language', async () => {
    const png = Buffer.from([137,80,78,71,13,10,26,10,1,2,3]);
    const result = await service.createDocumentQuiz('user-1', {
      buffer: png, originalname: 'scan.png', mimetype: 'image/png', size: png.length,
    }, { count: '5', language: 'auto' }, { topicId: 'doc-image', _quotaReceipt: true }) as any;
    expect(aiService.extractDocumentTextWithVision).toHaveBeenCalledWith(png, 'image/png');
    expect(result.language).toBe('uz');
  });

  it('detects Uzbek Cyrillic separately from Russian', async () => {
    aiService.extractDocumentTextWithVision.mockResolvedValue('Таълим жараёнида ўқувчилар билимни такрорлаш орқали мустаҳкамлайди. Бу усул мавзуни тушунишга ёрдам беради.');
    const png = Buffer.from([137,80,78,71,13,10,26,10,1,2,3]);
    const result = await service.createDocumentQuiz('user-1', { buffer: png, originalname: 'uzbek-cyrillic.png', mimetype: 'image/png', size: png.length }, { count: '5', language: 'auto' }, { topicId: 'doc-uz-cyrillic', _quotaReceipt: true }) as any;
    expect(result.language).toBe('uz');
  });

  it.each([
    ['ru', 'Образовательный материал содержит важные сведения для проверки знаний и понимания темы.'],
    ['en', 'Educational material contains important facts for checking knowledge and understanding the topic.'],
  ])('detects %s language for scanned documents', async (expected, text) => {
    aiService.extractDocumentTextWithVision.mockResolvedValue(text);
    const png = Buffer.from([137,80,78,71,13,10,26,10,1,2,3]);
    const result = await service.createDocumentQuiz('user-1', { buffer: png, originalname: 'language.png', mimetype: 'image/png', size: png.length }, { count: '5', language: 'auto' }, { topicId: `doc-${expected}`, _quotaReceipt: true }) as any;
    expect(result.language).toBe(expected);
  });

  it('uses OCR fallback for a scanned PDF without a text layer', async () => {
    const buffer = makePdf();
    expect(extraction.validate({ buffer, originalname: 'scan.pdf', mimetype: 'application/pdf' }).extension).toBe('pdf');
    const result = await service.createDocumentQuiz('user-1', {
      buffer, originalname: 'scan.pdf', mimetype: 'application/pdf', size: buffer.length,
    }, { count: '5', language: 'uz' }, { topicId: 'doc-scanned', _quotaReceipt: true }) as any;
    expect(aiService.extractDocumentTextWithVision).toHaveBeenCalledWith(buffer, 'application/pdf');
    expect(result.questionCount).toBe(5);
  });

  it('rejects unsupported files before consuming quota', async () => {
    await expect(service.createDocumentQuiz('user-1', {
      buffer: Buffer.from('content'), originalname: 'lesson.exe', mimetype: 'application/octet-stream', size: 7,
    }, { count: '5' })).rejects.toThrow('qo‘llab-quvvatlanmaydi');
    expect(featureUsageService.consume).not.toHaveBeenCalled();
  });

  it('queues file bytes with a stable content hash and does not call AI in the request handler', async () => {
    const buffer = Buffer.from(sourceText);
    const result = await service.createDocumentQuiz('user-1', {
      buffer, originalname: 'queued.txt', mimetype: 'text/plain', size: buffer.length,
    }, { count: '10', language: 'auto' }) as any;
    expect(result.status).toBe('queued');
    expect(aiQueue.enqueue).toHaveBeenCalledWith(expect.objectContaining({ jobType: 'document_quiz', fileBuffer: buffer, idempotencyKey: expect.stringMatching(/^document:/) }));
    expect(aiService.generateDocumentQuestions).not.toHaveBeenCalled();
  });

  it('does not accept an invalid question count or exceed the active plan file limit', async () => {
    await expect(service.createDocumentQuiz('user-1', { buffer: Buffer.from(sourceText), originalname: 'x.txt', mimetype: 'text/plain', size: 100 }, { count: '0' })).rejects.toThrow('Savollar soni');
    subscriptionsService.current.mockResolvedValue({ tier: 'free', entitlements: getPlanEntitlements(null) });
    const large = Buffer.alloc(6 * 1024 * 1024, 65);
    await expect(service.createDocumentQuiz('user-1', { buffer: large, originalname: 'x.txt', mimetype: 'text/plain', size: large.length }, { count: '5' })).rejects.toThrow('5 MB');
    expect(featureUsageService.consume).not.toHaveBeenCalled();
  });

  it('fails gracefully when AI cannot produce a complete source-grounded quiz', async () => {
    aiService.generateDocumentQuestions.mockRejectedValue(new Error('AI unavailable'));
    await expect(service.createDocumentQuiz('user-1', { buffer: Buffer.from(sourceText), originalname: 'lesson.txt', mimetype: 'text/plain', size: Buffer.byteLength(sourceText) }, { count: '5' }, { topicId: 'doc-error', _quotaReceipt: true })).rejects.toThrow();
  });
});

describe('LearningService shared Redis question cache', () => {
  it('returns a cached question pool without opening a database transaction or calling AI', async () => {
    const cachedQuestions = Array.from({ length: 20 }, (_, index) => ({
      id: 'cached-' + index,
      subjectId: 'algebra',
      topicId: 'equations',
      question: 'Cached question ' + index,
      options: ['A', 'B', 'C', 'D'],
      correctAnswer: index % 4,
      explanation: 'Cached explanation',
      difficulty: 'medium',
    }));
    const cache = { get: jest.fn().mockResolvedValue(cachedQuestions), set: jest.fn() };
    const topicsRepository = {
      findOne: jest.fn().mockResolvedValue({
        subjectId: 'algebra',
        topicId: 'equations',
        subjectName: 'Algebra',
        topicName: 'Tenglamalar',
        description: 'Tenglamalar',
        isActive: true,
      }),
    };
    const dataSource = { transaction: jest.fn() };
    const ai = { generateQuestions: jest.fn() };
    const cachedService = new LearningService(
      {} as never,
      topicsRepository as never,
      {} as never,
      dataSource as never,
      ai as never,
      {} as never,
      {} as never,
      cache as never,
    );

    const result = await cachedService.getTopicQuestions({
      subjectId: 'algebra',
      topicId: 'equations',
      count: 10,
      difficulty: 'medium',
      language: 'uz',
    }) as any;

    expect(result.questions).toHaveLength(10);
    expect(result.source).toBe('database');
    expect(cache.get).toHaveBeenCalledTimes(1);
    expect(dataSource.transaction).not.toHaveBeenCalled();
    expect(ai.generateQuestions).not.toHaveBeenCalled();
  });
});