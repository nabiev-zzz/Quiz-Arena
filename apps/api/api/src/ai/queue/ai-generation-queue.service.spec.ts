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
    usage: jest.fn(),
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
    jobRepository.create.mockImplementation((value) => ({ ...value }));
    jobRepository.save.mockImplementation(async (value) => ({ ...value, id: 'job-1' }));
    jobRepository.update.mockResolvedValue({ affected: 1 });
    featureUsage.consume.mockResolvedValue({
      allowed: true,
      featureKey: 'documentQuiz',
      tier: 'premium_pro',
      period: 'monthly',
      limit: 30,
      used: 1,
      remaining: 29,
      periodKey: '2026-11',
    });
    featureUsage.usage.mockResolvedValue({
      allowed: true,
      featureKey: 'documentQuiz',
      tier: 'premium_pro',
      period: 'monthly',
      limit: 40,
      used: 1,
      remaining: 39,
      periodKey: '2026-11',
    });
    featureUsage.refund.mockResolvedValue(undefined);
  });

  it('stops a worker when a user has cancelled the queued job', async () => {
    jobRepository.findOne.mockResolvedValueOnce({ id: 'job-1', status: 'active' });
    await expect(service.assertJobActive('job-1')).resolves.toBeUndefined();
    jobRepository.findOne.mockResolvedValueOnce({ id: 'job-1', status: 'failed' });
    await expect(service.assertJobActive('job-1')).rejects.toThrow('bekor qilindi');
  });

  it('checks document quota without charging before the test is generated', async () => {
    featureUsage.usage.mockResolvedValue({
      allowed: true, featureKey: 'documentQuiz', tier: 'premium_pro',
      period: 'monthly', limit: 40, used: 2, remaining: 38, periodKey: '2026-11',
    });

    const result = await service.enqueue({
      userId: '11111111-1111-4111-8111-111111111111',
      jobType: 'document_quiz',
      quotaFeature: 'documentQuiz',
      idempotencyKey: 'same-document-request',
      payload: { fileName: 'lesson.txt' },
      fileBuffer: Buffer.from('document'),
    });

    expect(result).toMatchObject({ status: 'queued', jobId: 'job-1' });
    expect(featureUsage.usage).toHaveBeenCalledTimes(1);
    expect(featureUsage.consume).not.toHaveBeenCalled();
    expect(jobRepository.update).not.toHaveBeenCalledWith(
      { id: 'job-1' }, expect.objectContaining({ quotaConsumed: true }),
    );
    expect(queue.add).toHaveBeenCalledWith(
      'document_quiz', { jobId: 'job-1' }, { jobId: 'job-1', priority: 5 },
    );
  });

  it('charges document quota only after successful test generation', async () => {
    const job = {
      id: 'job-1',
      userId: '11111111-1111-4111-8111-111111111111',
      status: 'active',
      quotaFeature: 'documentQuiz',
      quotaConsumed: false,
      payload: { _quotaReceipt: { periodKey: '2026-11' } },
      result: null,
    };
    jobRepository.findOne.mockResolvedValue(job);
    featureUsage.consume.mockResolvedValue({
      allowed: true, featureKey: 'documentQuiz', tier: 'premium_pro',
      period: 'monthly', limit: 40, used: 3, remaining: 37, periodKey: '2026-11',
    });

    await service.markCompleted('job-1', { questions: [{ id: 'q1' }] });

    expect(featureUsage.consume).toHaveBeenCalledTimes(1);
    expect(jobRepository.update).toHaveBeenCalledWith(
      { id: 'job-1', quotaConsumed: false, status: expect.anything() },
      { quotaConsumed: true },
    );
    expect(jobRepository.save).toHaveBeenCalledWith(expect.objectContaining({
      status: 'completed', quotaConsumed: true,
      result: { questions: [{ id: 'q1' }] },
    }));
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

  it('returns a recently completed identical request without consuming quota twice', async () => {
    jobRepository.findOne.mockResolvedValue({ id: 'recent-job', status: 'completed', createdAt: new Date(), result: { questions: [] } });
    const result = await service.enqueue({ userId: '11111111-1111-4111-8111-111111111111', jobType: 'document_quiz', quotaFeature: 'documentQuiz', idempotencyKey: 'same-document', payload: {} });
    expect(result).toMatchObject({ status: 'completed', jobId: 'recent-job' });
    expect(featureUsage.consume).not.toHaveBeenCalled();
    expect(jobRepository.save).not.toHaveBeenCalled();
  });

  it('allows an intentional regeneration after the duplicate-submit window', async () => {
    jobRepository.findOne.mockResolvedValue({ id: 'old-job', status: 'completed', createdAt: new Date(Date.now() - 31_000), result: { questions: [] } });
    const result = await service.enqueue({ userId: '11111111-1111-4111-8111-111111111111', jobType: 'document_quiz', quotaFeature: 'documentQuiz', idempotencyKey: 'same-document', payload: {}, fileBuffer: Buffer.from('same document') });
    expect(result).toMatchObject({ status: 'queued', jobId: 'job-1' });
    expect(jobRepository.update).toHaveBeenCalledWith({ id: 'old-job' }, { idempotencyKey: null });
    expect(featureUsage.usage).toHaveBeenCalledTimes(1);
    expect(featureUsage.consume).not.toHaveBeenCalled();
    expect(queue.add).toHaveBeenCalledTimes(1);
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

  it('repairs a BullMQ-completed job when the database completion write was missed', async () => {
    const job = {
      id: 'document-job',
      userId: '11111111-1111-4111-8111-111111111111',
      jobType: 'document_quiz',
      status: 'active',
      result: null,
      fileBuffer: Buffer.from('document'),
      error: null,
      completedAt: null,
      queueEnqueuedAt: new Date(),
    };
    const completedResult = { questions: [{ id: 'question-1' }] };
    const bullJob = {
      getState: jest.fn().mockResolvedValue('completed'),
      returnvalue: completedResult,
      progress: { step: 'generating' },
      attemptsMade: 1,
      opts: { attempts: 3 },
    };
    queue.getJob.mockResolvedValue(bullJob);
    jobRepository.findOne
      .mockResolvedValueOnce(job)
      .mockResolvedValueOnce(job)
      .mockResolvedValueOnce({ ...job, status: 'completed', result: completedResult });

    const status = await service.getStatus(job.userId, job.id);

    expect(status).toMatchObject({ status: 'completed', result: completedResult });
    expect(jobRepository.save).toHaveBeenCalledWith(expect.objectContaining({
      id: job.id,
      status: 'completed',
      result: completedResult,
      fileBuffer: null,
    }));
  });

  it('claims a quota refund once and uses the original monthly period', async () => {
    jobRepository.findOne.mockResolvedValue({
      id: 'job-1', status: 'failed', quotaConsumed: true, quotaRefunded: false,
      userId: '11111111-1111-4111-8111-111111111111', quotaFeature: 'documentQuiz',
      payload: { _quotaReceipt: { periodKey: '2026-11' } },
    });
    await service.markFailedAndRefund('job-1', new Error('AI failed'));
    expect(jobRepository.update).toHaveBeenCalledWith(
      { id: 'job-1', quotaConsumed: true, quotaRefunded: false },
      { quotaRefunded: true },
    );
    expect(featureUsage.refund).toHaveBeenCalledWith('11111111-1111-4111-8111-111111111111', 'documentQuiz', '2026-11');
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

    expect(featureUsage.consume).not.toHaveBeenCalled();
    expect(featureUsage.refund).not.toHaveBeenCalled();
    expect(queue.add).toHaveBeenCalledTimes(1);
  });
});
