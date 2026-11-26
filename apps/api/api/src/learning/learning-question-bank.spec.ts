import { describe, expect, it, jest } from '@jest/globals';
import { LearningService } from './learning.service';
import { LearningQuestion } from './entities/learning-question.entity';

describe('LearningService question-bank fallback', () => {
  it('serves a test from the database without calling AI when enough questions are cached', async () => {
    const questions = [
      {
        id: 'q-1', subjectId: 'math', topicId: 'fractions', language: 'uz',
        difficulty: 'easy', question: '1/2 + 1/2 nechaga teng?',
        options: ['1/2', '1', '2', '3'], correctAnswer: 1,
        explanation: 'Ikki yarim bir butun bo‘ladi.', isActive: true,
      },
      {
        id: 'q-2', subjectId: 'math', topicId: 'fractions', language: 'uz',
        difficulty: 'easy', question: '1/4 + 1/4 nechaga teng?',
        options: ['1/4', '1/2', '1', '2'], correctAnswer: 1,
        explanation: 'To‘rtdan bir va to‘rtdan bir — yarmi.', isActive: true,
      },
    ];
    const queryBuilder = {
      where: jest.fn().mockReturnThis(),
      andWhere: jest.fn().mockReturnThis(),
      orderBy: jest.fn().mockReturnThis(),
      take: jest.fn().mockReturnThis(),
      getMany: jest.fn().mockResolvedValue(questions),
    };
    const bankRepository = {
      find: jest.fn().mockResolvedValue(questions),
      createQueryBuilder: jest.fn().mockReturnValue(queryBuilder),
      create: jest.fn(),
      save: jest.fn(),
    };
    const manager = {
      query: jest.fn().mockResolvedValue(undefined),
      getRepository: jest.fn().mockReturnValue(bankRepository),
    };
    const dataSource = {
      transaction: jest.fn(async (callback: (value: typeof manager) => unknown) => callback(manager)),
    };
    const topics = {
      findOne: jest.fn().mockResolvedValue({
        subjectName: 'Matematika',
        topicName: 'Kasrlar',
        description: 'Oddiy kasrlar',
      }),
    };
    const aiService = {
      generateQuestions: jest.fn(),
    };
    const service = new LearningService(
      {} as never,
      topics as never,
      {} as never,
      dataSource as never,
      aiService as never,
      {} as never,
      {} as never,
    );

    const result = await service.getTopicQuestions({
      subjectId: 'math',
      topicId: 'fractions',
      count: 2,
      difficulty: 'easy',
      language: 'uz',
    });

    expect(result.questions).toHaveLength(2);
    expect(result.source).toBe('database');
    expect(aiService.generateQuestions).not.toHaveBeenCalled();
    expect(bankRepository.save).not.toHaveBeenCalled();
  });
});
