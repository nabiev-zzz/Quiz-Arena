import { describe, expect, it, jest, beforeEach } from '@jest/globals';
import { deflateRawSync } from 'node:zlib';
import { getPlanEntitlements } from '../subscriptions/plan-entitlements';
import { LearningService } from './learning.service';

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
    generateQuestions: jest.fn(),
    generateQuestionsFromPdf: jest.fn(),
  };
  const featureUsageService = {
    consume: jest.fn(),
    refund: jest.fn(),
  };
  const subscriptionsService = {
    current: jest.fn(),
  };
  const service = new LearningService(
    attemptsRepository as never,
    {} as never,
    {} as never,
    {} as never,
    aiService as never,
    featureUsageService as never,
    subscriptionsService as never,
  );

  beforeEach(() => {
    jest.clearAllMocks();
    attemptsRepository.find.mockResolvedValue([]);
    subscriptionsService.current.mockResolvedValue({
      tier: 'premium_pro',
      entitlements: getPlanEntitlements('premium_pro_monthly'),
    });
    featureUsageService.consume.mockResolvedValue({
      allowed: true, featureKey: 'documentQuiz', tier: 'premium_pro', period: 'monthly',
      limit: 30, used: 1, remaining: 29,
    });
    aiService.generateQuestions.mockResolvedValue([{
      id: 'document-q1', subjectId: 'document', topicId: 'document-1',
      question: 'Savol?', options: ['A', 'B', 'C', 'D'],
      correctAnswer: 0, explanation: 'Izoh', difficulty: 'medium',
    }]);
    aiService.generateQuestionsFromPdf.mockResolvedValue([{
      id: 'document-pdf-q1', subjectId: 'document', topicId: 'document-1',
      question: 'PDF savoli?', options: ['A', 'B', 'C', 'D'],
      correctAnswer: 1, explanation: 'PDF izohi', difficulty: 'medium',
    }]);
  });

  it('creates a quiz from a plain text document and consumes the server quota', async () => {
    const result = await service.createDocumentQuiz('user-1', {
      buffer: Buffer.from('Ushbu hujjat test yaratish uchun yetarli bo‘lgan matnni o‘z ichiga oladi.'),
      originalname: 'lesson.txt', mimetype: 'text/plain', size: 80,
    }, { count: '1', difficulty: 'medium', language: 'uz' });

    expect(result.questionCount).toBe(1);
    expect(result.sourceFileName).toBe('lesson.txt');
    expect(featureUsageService.consume).toHaveBeenCalledWith('user-1', 'documentQuiz');
    expect(aiService.generateQuestions).toHaveBeenCalledTimes(1);
  });

  it('generates large document quizzes in validated batches of 25', async () => {
    const batch = Array.from({ length: 25 }, (_, index) => ({
      id: 'batch-q' + index, subjectId: 'document', topicId: 'batch-topic',
      question: 'Question ' + index, options: ['A', 'B', 'C', 'D'],
      correctAnswer: 0, explanation: 'Explanation', difficulty: 'medium' as const,
    }));
    aiService.generateQuestions.mockResolvedValue(batch);
    const result = await service.createDocumentQuiz('user-1', {
      buffer: Buffer.from('This document contains enough educational text for a fifty question quiz generation test.'),
      originalname: 'long-lesson.txt', mimetype: 'text/plain', size: 90,
    }, { count: '50' });

    expect(aiService.generateQuestions).toHaveBeenCalledTimes(2);
    expect(result.questionCount).toBe(50);
    expect(new Set(result.questions.map((question) => question.id)).size).toBe(50);
  });
  it('extracts text from a DOCX document before generating questions', async () => {
    const buffer = makeDocx('DOCX_TEST_TEXT: This document explains fractions, numerator, denominator and equivalent values for students.');
    await service.createDocumentQuiz('user-1', {
      buffer, originalname: 'lesson.docx',
      mimetype: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      size: buffer.length,
    }, { count: '1' });

    expect(aiService.generateQuestions).toHaveBeenCalledWith(expect.objectContaining({
      topicDescription: expect.stringContaining('DOCX_TEST_TEXT'),
    }));
  });

  it('sends valid PDF bytes to the Gemini PDF generation path', async () => {
    const result = await service.createDocumentQuiz('user-1', {
      buffer: Buffer.from('%PDF-1.4 fake test pdf content'),
      originalname: 'lesson.pdf', mimetype: 'application/pdf', size: 30,
    }, { count: '1' });

    expect(result.questionCount).toBe(1);
    expect(aiService.generateQuestionsFromPdf).toHaveBeenCalledTimes(1);
    expect(aiService.generateQuestions).not.toHaveBeenCalled();
  });

  it('rejects unsupported formats before consuming quota', async () => {
    await expect(service.createDocumentQuiz('user-1', {
      buffer: Buffer.from('content'), originalname: 'lesson.exe',
      mimetype: 'application/octet-stream', size: 7,
    }, { count: '1' })).rejects.toThrow('Faqat PDF, DOCX, TXT, MD va CSV');
    expect(featureUsageService.consume).not.toHaveBeenCalled();
  });

  it('uses a deterministic source-grounded fallback when AI is unavailable for text documents', async () => {
    aiService.generateQuestions.mockRejectedValue(new Error('AI unavailable'));
    const sourceText = [
      'Photosynthesis converts sunlight into chemical energy inside green plant cells during normal growth.',
      'Mitochondria produce energy through cellular respiration inside eukaryotic organisms.',
      'Gravity attracts objects toward one another according to mass and distance.',
      'Evaporation changes liquid water into vapor when temperature increases.',
      'Condensation transforms water vapor into liquid droplets under cooler conditions.',
    ].join(' ');

    const result = await service.createDocumentQuiz('user-1', {
      buffer: Buffer.from(sourceText),
      originalname: 'science.txt', mimetype: 'text/plain', size: sourceText.length,
    }, { count: '3', difficulty: 'medium', language: 'en' });

    expect(result.source).toBe('rule-based');
    expect(result.questionCount).toBe(3);
    expect(result.questions.every((question) => question.options.length === 4)).toBe(true);
    expect(result.questions.every((question) => question.explanation.length > 0)).toBe(true);
    expect(featureUsageService.refund).not.toHaveBeenCalled();
  });

  it('refunds quota when AI fails and the text is insufficient for deterministic fallback', async () => {
    aiService.generateQuestions.mockRejectedValue(new Error('AI unavailable'));
    await expect(service.createDocumentQuiz('user-1', {
      buffer: Buffer.from('Ushbu hujjat test yaratish uchun yetarli bo‘lgan matnni o‘z ichiga oladi.'),
      originalname: 'lesson.txt', mimetype: 'text/plain', size: 80,
    }, { count: '1' })).rejects.toThrow('kamida 4 ta turli atama');
    expect(featureUsageService.refund).toHaveBeenCalledWith('user-1', 'documentQuiz');
  });


  it('creates basic practice from saved mistakes for FREE users', async () => {
    attemptsRepository.find.mockResolvedValue([{
      subjectName: 'Matematika',
      topicName: 'Kasrlar',
      review: [{
        id: 'mistake-1', question: '1/2 + 1/2 nechaga teng?',
        options: ['1/2', '1', '2', '3'], selectedAnswer: 0,
        correctAnswer: 1, isCorrect: false, explanation: 'Yarim va yarim bir butun bo‘ladi.',
      }],
    }]);
    subscriptionsService.current.mockResolvedValue({
      tier: 'free', entitlements: getPlanEntitlements(null),
    });

    const result = await service.createSmartPractice('user-1', { language: 'uz' });

    expect(result.personalized).toBe(false);
    expect(result.questions[0].question).toContain('1/2');
    expect(aiService.generateQuestions).not.toHaveBeenCalled();
    expect(featureUsageService.consume).toHaveBeenCalledWith('user-1', 'smartPractice');
  });

  it('generates new AI-personalized questions for PREMIUM PRO users', async () => {
    attemptsRepository.find.mockResolvedValue([{
      subjectName: 'Matematika',
      topicName: 'Kasrlar',
      review: [{
        id: 'mistake-2', question: '1/3 + 1/3 nechaga teng?',
        options: ['1/3', '2/3', '1', '2'], selectedAnswer: 0,
        correctAnswer: 1, isCorrect: false, explanation: 'Maxrajlar teng.',
      }],
    }]);

    const result = await service.createSmartPractice('user-1', { language: 'uz' });

    expect(result.personalized).toBe(true);
    expect(aiService.generateQuestions).toHaveBeenCalledTimes(1);
    expect(aiService.generateQuestions).toHaveBeenCalledWith(expect.objectContaining({
      subjectId: 'smart-practice',
      count: 1,
      language: 'uz',
    }));
  });

  it('does not consume a daily quota when there are no saved mistakes', async () => {
    await expect(service.createSmartPractice('user-1', { language: 'uz' }))
      .rejects.toThrow('saqlangan xatolar topilmadi');
    expect(featureUsageService.consume).not.toHaveBeenCalled();
  });

  it('refunds Smart Practice quota if AI generation fails', async () => {
    attemptsRepository.find.mockResolvedValue([{
      subjectName: 'Matematika',
      topicName: 'Kasrlar',
      review: [{
        id: 'mistake-3', question: '2/4 qisqartirilsa nima bo‘ladi?',
        options: ['1/2', '1/4', '2/3', '2'], selectedAnswer: 1,
        correctAnswer: 0, isCorrect: false, explanation: 'Surat va maxrajni 2 ga bo‘ling.',
      }],
    }]);
    aiService.generateQuestions.mockRejectedValue(new Error('AI unavailable'));

    await expect(service.createSmartPractice('user-1', { language: 'uz' }))
      .rejects.toThrow('AI unavailable');
    expect(featureUsageService.refund).toHaveBeenCalledWith('user-1', 'smartPractice');
  });

  it('enforces the active tier file-size limit', async () => {
    subscriptionsService.current.mockResolvedValue({
      tier: 'free',
      entitlements: getPlanEntitlements(null),
    });
    const large = Buffer.alloc(6 * 1024 * 1024, 65);
    await expect(service.createDocumentQuiz('user-1', {
      buffer: large, originalname: 'lesson.txt', mimetype: 'text/plain', size: large.length,
    }, { count: '1' })).rejects.toThrow('5 MB');
    expect(featureUsageService.consume).not.toHaveBeenCalled();
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
    });

    expect(result.questions).toHaveLength(10);
    expect(result.source).toBe('database');
    expect(cache.get).toHaveBeenCalledTimes(1);
    expect(dataSource.transaction).not.toHaveBeenCalled();
    expect(ai.generateQuestions).not.toHaveBeenCalled();
  });
});
