import { describe, expect, it, jest, beforeEach } from '@jest/globals';
import { getPlanEntitlements } from '../subscriptions/plan-entitlements';
import { AiTutorService } from './ai-tutor.service';

describe('AiTutorService tier-aware progress context', () => {
  const config = { get: jest.fn() };
  const messages = { find: jest.fn(), create: jest.fn(), save: jest.fn() };
  const users = { findOne: jest.fn() };
  const battles = { find: jest.fn() };
  const attempts = { find: jest.fn() };
  const usage = { consume: jest.fn(), refund: jest.fn() };
  const subscriptions = { current: jest.fn() };
  const aiQueue = { enqueue: jest.fn() };
  const service = new AiTutorService(
    config as never,
    messages as never,
    users as never,
    battles as never,
    attempts as never,
    usage as never,
    subscriptions as never,
    aiQueue as never,
  );

  beforeEach(() => {
    jest.clearAllMocks();
    users.findOne.mockResolvedValue({ level: 4, xp: 120, rankPoints: 350 });
    battles.find.mockResolvedValue([]);
    attempts.find.mockResolvedValue([{
      subjectName: 'Matematika',
      topicName: 'Kasrlar',
      totalQuestions: 5,
      correctAnswers: 3,
      review: [{
        id: 'mistake-1',
        question: '1/2 + 1/2 nechaga teng?',
        isCorrect: false,
        explanation: 'Ikki yarim bir butun bo‘ladi.',
      }],
    }]);
  });

  it('shares verified totals but hides detailed mistake analysis from FREE users', async () => {
    subscriptions.current.mockResolvedValue({
      tier: 'free',
      entitlements: getPlanEntitlements(null),
    });

    const progress = await service.getStudentProgress('user-1');

    expect(progress.learningStats).toMatchObject({
      analyzedAttempts: 1,
      totalQuestions: 5,
      correctAnswers: 3,
      accuracy: 60,
    });
    expect(progress.learningStats).not.toHaveProperty('weakTopics');
    expect(progress.entitlements.detailedErrorAnalysis).toBe(false);
  });

  it('provides weak-topic and mistake details to PREMIUM PRO users', async () => {
    subscriptions.current.mockResolvedValue({
      tier: 'premium_pro',
      entitlements: getPlanEntitlements('premium_pro_monthly'),
    });

    const progress = await service.getStudentProgress('user-1');

    expect(progress.learningStats.weakTopics).toEqual([
      { subjectName: 'Matematika', topicName: 'Kasrlar', mistakes: 1 },
    ]);
    expect(progress.learningStats.recentMistakes).toHaveLength(1);
    expect(progress.entitlements.detailedErrorAnalysis).toBe(true);
  });

  it('blocks AI Tutor messages when the daily quota is exhausted', async () => {
    usage.consume.mockResolvedValue({
      allowed: false, featureKey: 'aiTutor', tier: 'free',
      period: 'daily', limit: 3, used: 3, remaining: 0,
    });

    await expect(service.sendMessage('user-1', 'Menga yordam bering', 'uz'))
      .rejects.toThrow('kunlik xabar limiti tugagan');
    expect(messages.save).not.toHaveBeenCalled();
  });

  it('limits basic AI Tutor history to 20 messages and returns the newest messages in order', async () => {
    subscriptions.current.mockResolvedValue({
      tier: 'free',
      entitlements: getPlanEntitlements(null),
    });
    messages.find.mockResolvedValue([{ id: 'newest' }, { id: 'older' }]);

    const result = await service.getHistory('user-1');

    expect(messages.find).toHaveBeenCalledWith(expect.objectContaining({
      take: 20,
      order: { createdAt: 'DESC' },
    }));
    expect(result.messages.map((item) => item.id)).toEqual(['older', 'newest']);
  });
});
