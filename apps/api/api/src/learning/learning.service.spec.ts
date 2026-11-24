import { describe, expect, it, jest, beforeEach } from '@jest/globals';
import { getPlanEntitlements } from '../subscriptions/plan-entitlements';
import { LearningService } from './learning.service';

describe('LearningService document quiz generation', () => {
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
    {} as never,
    {} as never,
    {} as never,
    {} as never,
    aiService as never,
    featureUsageService as never,
    subscriptionsService as never,
  );

  beforeEach(() => {
    jest.clearAllMocks();
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
