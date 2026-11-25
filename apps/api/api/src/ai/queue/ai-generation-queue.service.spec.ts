import { describe, expect, it, jest, beforeEach } from '@jest/globals';
import { HttpException } from '@nestjs/common';
import { AiGenerationQueueService } from './ai-generation-queue.service';

describe('AiGenerationQueueService', () => {
  const jobRepository = {
    create: jest.fn(),
    save: jest.fn(),
    findOne: jest.fn(),
    find: jest.fn(),
    count: jest.fn(),
    update: jest.fn(),
    increment: jest.fn(),
    createQueryBuilder: jest.fn(),
  };
  const featureUsage = {
    consume: jest.fn(),
    refund: jest.fn(),
  };
  const service = new AiGenerationQueueService(jobRepository as never, featureUsage as never);
  const queue = { add: jest.fn(), getJob: jest.fn(), getWaitingCount: jest.fn() };

  beforeEach(() => {
    jest.clearAllMocks();
    (service as unknown as { queue: typeof queue }).queue = queue;
    queue.add.mockResolvedValue({});
    queue.getJob.mockResolvedValue(null);
    queue.getWaitingCount.mockResolvedValue(0);
    jobRepository.count.mockResolvedValue(0);
    jobRepository.findOne.mockResolvedValue(null);
    jobRepository.find.mockResolvedValue([]);
    jobRepository.create.mockImplementation((value) => ({ ...value, id: 'job-1' }));
    jobRepository.save.mockImplementation(async (value) => value);
    jobRepository.update.mockResolvedValue({ affected: 1 });
    featureUsage.consume.mockResolvedValue({
      allowed: true,
      featureKey: 'documentQuiz',
      tier: 'premium_pro',
      period: 'monthly',
      limit: 30,
      used: 1,
      remaining: 29,
    });
    featureUsage.refund.mockResolvedValue(undefined);
  });

  it('persists a durable job and reserves quota once before enqueueing', async () => {
    const result = await service.enqueue({
      userId: '11111111-1111-4111-8111-111111111111',
      jobType: 'document_quiz',
      quotaFeature: 'documentQuiz',
      idempotencyKey: 'same-document-request',
      payload: { fileName: 'lesson.txt' },
      fileBuffer: Buffer.from('document'),
    });

    expect(result).toMatchObject({ status: 'queued', jobId: 'job-1' });
    expect(featureUsage.consume).toHaveBeenCalledTimes(1);
    expect(jobRepository.save).toHaveBeenCalledTimes(1);
    expect(jobRepository.update).toHaveBeenCalledWith(
      { id: 'job-1' },
      expect.objectContaining({
        quotaConsumed: true,
        payload: expect.objectContaining({ _jobId: 'job-1', _quotaReceipt: expect.objectContaining({ allowed: true }) }),
      }),
    );
    expect(queue.add).toHaveBeenCalledWith('document_quiz', { jobId: 'job-1' }, { jobId: 'job-1', priority: 5 });
  });

  it('returns an existing idempotent job without consuming quota again', async () => {
    jobRepository.findOne.mockResolvedValue({
      id: 'existing-job',
      status: 'queued',
      result: null,
    });

    const result = await service.enqueue({
      userId: '11111111-1111-4111-8111-111111111111',
      jobType: 'smart_practice',
      quotaFeature: 'smartPractice',
      idempotencyKey: 'same-smart-practice',
      payload: { count: 5 },
    });

    expect(result.jobId).toBe('existing-job');
    expect(featureUsage.consume).not.toHaveBeenCalled();
    expect(jobRepository.save).not.toHaveBeenCalled();
    expect(queue.add).not.toHaveBeenCalled();
  });

  it('does not enqueue or consume quota when the plan limit is exhausted', async () => {
    featureUsage.consume.mockResolvedValue({
      allowed: false,
      featureKey: 'aiTutor',
      tier: 'free',
      period: 'daily',
      limit: 3,
      used: 3,
      remaining: 0,
    });

    await expect(service.enqueue({
      userId: '11111111-1111-4111-8111-111111111111',
      jobType: 'ai_tutor',
      quotaFeature: 'aiTutor',
      payload: { message: 'Help' },
    })).rejects.toBeInstanceOf(HttpException);

    expect(queue.add).not.toHaveBeenCalled();
    expect(jobRepository.update).toHaveBeenCalledWith(
      { id: 'job-1' },
      expect.objectContaining({ status: 'failed', fileBuffer: null }),
    );
  });

  it('re-enqueues durable queued jobs missing from Redis after a worker restart', async () => {
    jobRepository.find.mockResolvedValue([{
      id: 'orphan-job',
      userId: '11111111-1111-4111-8111-111111111111',
      jobType: 'topic_questions',
      status: 'queued',
      priority: 21,
    }]);
    queue.getJob.mockResolvedValue(null);

    await service.reconcilePendingJobs();

    expect(queue.add).toHaveBeenCalledWith(
      'topic_questions',
      { jobId: 'orphan-job' },
      { jobId: 'orphan-job', priority: 21 },
    );
  });

  it('reconciles a BullMQ-completed result into PostgreSQL after a process crash', async () => {
    const completedBullJob = {
      getState: jest.fn().mockResolvedValue('completed'),
      returnvalue: { questions: [{ id: 'q-1' }] },
      attemptsMade: 1,
      opts: { attempts: 3 },
    };
    jobRepository.find.mockResolvedValue([{
      id: 'completed-job',
      status: 'active',
      jobType: 'topic_questions',
      priority: 21,
    }]);
    queue.getJob.mockResolvedValue(completedBullJob);
    jobRepository.findOne.mockResolvedValue({
      id: 'completed-job',
      status: 'active',
      result: null,
      fileBuffer: null,
    });

    await service.reconcilePendingJobs();

    expect(jobRepository.save).toHaveBeenCalledWith(expect.objectContaining({
      id: 'completed-job',
      status: 'completed',
      result: { questions: [{ id: 'q-1' }] },
    }));
  });

  it('refunds quota if BullMQ refuses the newly reserved job', async () => {
    queue.add.mockRejectedValue(new Error('Redis unavailable'));

    await expect(service.enqueue({
      userId: '11111111-1111-4111-8111-111111111111',
      jobType: 'document_quiz',
      quotaFeature: 'documentQuiz',
      payload: { fileName: 'lesson.pdf' },
      fileBuffer: Buffer.from('%PDF-1.4'),
    })).rejects.toThrow('AI navbatiga ulanishda xatolik');

    expect(featureUsage.refund).toHaveBeenCalledWith('11111111-1111-4111-8111-111111111111', 'documentQuiz');
    expect(queue.add).toHaveBeenCalledTimes(1);
  });
});
