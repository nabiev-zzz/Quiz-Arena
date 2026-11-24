import { describe, expect, it, jest, beforeEach } from '@jest/globals';
import { getPlanEntitlements } from '../subscriptions/plan-entitlements';
import { LearningService } from './learning.service';

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

  it('refunds quota if AI generation fails', async () => {
    aiService.generateQuestions.mockRejectedValue(new Error('AI unavailable'));
    await expect(service.createDocumentQuiz('user-1', {
      buffer: Buffer.from('Ushbu hujjat test yaratish uchun yetarli bo‘lgan matnni o‘z ichiga oladi.'),
      originalname: 'lesson.txt', mimetype: 'text/plain', size: 80,
    }, { count: '1' })).rejects.toThrow('AI unavailable');
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
