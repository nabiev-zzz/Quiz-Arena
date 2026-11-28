import { describe, expect, it, jest, beforeEach } from '@jest/globals';
import { getPlanEntitlements } from '../subscriptions/plan-entitlements';
import { AiTutorService } from './ai-tutor.service';

describe('AiTutorService tier-aware progress context', () => {
  const config = { get: jest.fn() };
  const messages = { find: jest.fn(), create: jest.fn(), save: jest.fn(), delete: jest.fn(), findOne: jest.fn() };
  const users = { findOne: jest.fn() };
  const battles = { find: jest.fn() };
  const attempts = { find: jest.fn() };
  const subscriptions = { current: jest.fn() };
  const aiQueue = { enqueue: jest.fn() };
  const service = new AiTutorService(
    config as never,
    messages as never,
    users as never,
    battles as never,
    attempts as never,
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

  it('shares verified totals and detailed mistake analysis with FREE users during free access', async () => {
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
    expect(progress.learningStats.weakTopics).toEqual([{ subjectName: 'Matematika', topicName: 'Kasrlar', mistakes: 1 }]);
    expect(progress.learningStats.recentMistakes).toHaveLength(1);
    expect(progress.entitlements.detailedErrorAnalysis).toBe(true);
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

  it('routes Tutor messages through BullMQ and removes the pending message when quota is rejected', async () => {
    messages.create.mockReturnValue({ id: 'message-1', userId: 'user-1', role: 'user', content: 'Menga yordam bering' });
    messages.save.mockResolvedValue({ id: 'message-1', userId: 'user-1', role: 'user', content: 'Menga yordam bering' });
    messages.delete.mockResolvedValue({ affected: 1 });
    aiQueue.enqueue.mockRejectedValue(new Error('kunlik xabar limiti tugagan'));

    await expect(service.sendMessage('user-1', 'Menga yordam bering', 'uz'))
      .rejects.toThrow('kunlik xabar limiti tugagan');
    expect(aiQueue.enqueue).toHaveBeenCalledWith(expect.objectContaining({
      jobType: 'ai_tutor',
      quotaFeature: 'aiTutor',
    }));
    expect(messages.delete).toHaveBeenCalledWith({ id: 'message-1', userId: 'user-1' });
  });

  it('queues a Tutor message and returns a job identifier immediately', async () => {
    messages.create.mockReturnValue({ id: 'message-2', userId: 'user-1', role: 'user', content: 'Kasrlarni tushuntiring' });
    messages.save.mockResolvedValue({ id: 'message-2', userId: 'user-1', role: 'user', content: 'Kasrlarni tushuntiring' });
    aiQueue.enqueue.mockResolvedValue({
      status: 'queued',
      jobId: 'job-tutor-1',
      message: 'Test tayyorlanmoqda',
      usage: { allowed: true, remaining: 2 },
    });

    const result = await service.sendMessage('user-1', 'Kasrlarni tushuntiring', 'uz');

    expect(result).toMatchObject({ status: 'queued', jobId: 'job-tutor-1' });
    expect(aiQueue.enqueue).toHaveBeenCalledTimes(1);
  });

  it('provides full AI Tutor history and returns the newest messages in order', async () => {
    subscriptions.current.mockResolvedValue({
      tier: 'free',
      entitlements: getPlanEntitlements(null),
    });
    messages.find.mockResolvedValue([{ id: 'newest' }, { id: 'older' }]);

    const result = await service.getHistory('user-1');

    expect(messages.find).toHaveBeenCalledWith(expect.objectContaining({
      take: 100,
      order: { createdAt: 'DESC' },
    }));
    expect(result.messages.map((item) => item.id)).toEqual(['older', 'newest']);
  });
});
