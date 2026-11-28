import { HttpException, HttpStatus, Injectable, Logger, NotFoundException, OnModuleDestroy, OnModuleInit, ServiceUnavailableException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Queue } from 'bullmq';
import Redis from 'ioredis';
import { createHash } from 'node:crypto';
import { In, IsNull, Repository } from 'typeorm';
import { FeatureUsageService } from '../../subscriptions/feature-usage.service';
import { AiGenerationJob, AiGenerationJobType } from '../entities/ai-generation-job.entity';

function boundedInteger(value: string | undefined, fallback: number, min: number, max: number): number {
  const parsed = Number(value);
  return Number.isFinite(parsed)
    ? Math.min(max, Math.max(min, Math.floor(parsed)))
    : fallback;
}

export const AI_GENERATION_QUEUE = 'ai-generation';
export const AI_GENERATION_PREFIX = `quiz-arena:${process.env.NODE_ENV || 'development'}:ai-bull`;

export function createAiQueueRedisConnection(): Redis {
  const url = process.env.AI_QUEUE_REDIS_URL?.trim() || process.env.REDIS_URL?.trim() || process.env.VALKEY_URL?.trim();
  const host = process.env.AI_QUEUE_REDIS_HOST?.trim() || process.env.VALKEY_HOST?.trim();
  if (url) {
    return new Redis(url, {
      lazyConnect: true,
      connectTimeout: 5000,
      maxRetriesPerRequest: null,
      enableReadyCheck: true,
      retryStrategy: (times) => times > 2 ? null : Math.min(times * 250, 1000),
    });
  }
  if (!host) throw new Error('AI queue uchun REDIS_URL, VALKEY_URL yoki VALKEY_HOST sozlanmagan.');
  return new Redis({
    host,
    port: Number(process.env.AI_QUEUE_REDIS_PORT || process.env.VALKEY_PORT || 6379),
    password: process.env.AI_QUEUE_REDIS_PASSWORD || process.env.VALKEY_PASSWORD || undefined,
    lazyConnect: true,
    connectTimeout: 5000,
    maxRetriesPerRequest: null,
    enableReadyCheck: true,
    retryStrategy: (times) => times > 2 ? null : Math.min(times * 250, 1000),
  });
}

@Injectable()
export class AiGenerationQueueService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(AiGenerationQueueService.name);
  private redis: Redis | null = null;
  private queue: Queue | null = null;

  constructor(
    @InjectRepository(AiGenerationJob)
    private readonly jobs: Repository<AiGenerationJob>,
    private readonly featureUsage: FeatureUsageService,
  ) {}

  async onModuleInit(): Promise<void> {
    if (!process.env.AI_QUEUE_REDIS_URL?.trim() && !process.env.AI_QUEUE_REDIS_HOST?.trim() && !process.env.REDIS_URL?.trim() && !process.env.VALKEY_URL?.trim() && !process.env.VALKEY_HOST?.trim()) {
      this.logger.warn('AI BullMQ navbati sozlanmagan; AI generation so‘rovlari 503 bilan qaytariladi.');
      return;
    }
    try {
      this.redis = createAiQueueRedisConnection();
      await this.redis.connect();
      await this.redis.ping();
      this.queue = new Queue(AI_GENERATION_QUEUE, {
        connection: this.redis,
        prefix: AI_GENERATION_PREFIX,
        defaultJobOptions: {
          attempts: 3,
          backoff: { type: 'exponential', delay: 3000 },
          removeOnComplete: { age: 24 * 60 * 60, count: 2000 },
          removeOnFail: { age: 7 * 24 * 60 * 60, count: 5000 },
        },
      });
      await this.queue.waitUntilReady();
      this.logger.log('AI BullMQ navbati tayyor (Battle navbatidan alohida namespace).');
      if (process.env.AI_WORKER_PROCESS === 'true') await this.reconcilePendingJobs();
    } catch (error) {
      this.queue = null;
      if (this.redis) this.redis.disconnect();
      this.redis = null;
      this.logger.error(`AI BullMQ ulanmagan: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  async onModuleDestroy(): Promise<void> {
    if (this.queue) await this.queue.close();
    if (this.redis) {
      if (this.redis.status === 'ready') await this.redis.quit();
      else this.redis.disconnect();
    }
  }

  async enqueue(input: {
    userId: string | null;
    jobType: AiGenerationJobType;
    payload: Record<string, unknown>;
    fileBuffer?: Buffer;
    quotaFeature?: string;
    idempotencyKey?: string;
  }): Promise<{ status: 'queued' | 'active' | 'completed'; jobId: string; message: string; result?: Record<string, unknown> | null; usage?: unknown }> {
    if (!this.queue) {
      throw new ServiceUnavailableException('AI navbati vaqtincha ishlamayapti. Iltimos, birozdan keyin qayta urinib ko‘ring.');
    }

    const idempotencyKey = input.idempotencyKey
      ? createHash('sha256').update(input.idempotencyKey).digest('hex')
      : null;
    const ownerWhere = input.userId ? { userId: input.userId } : { userId: IsNull() };
    if (idempotencyKey) {
      const existing = await this.jobs.findOne({ where: { ...ownerWhere, idempotencyKey } });
      const recentlySubmitted = existing?.createdAt
        ? Date.now() - new Date(existing.createdAt).getTime() < 2 * 60 * 1000
        : true;
      if (existing && ['queued', 'active'].includes(existing.status)) {
        return {
          status: existing.status as 'queued' | 'active',
          jobId: existing.id,
          message: 'Test tayyorlanmoqda',
          result: existing.result,
        };
      }
      if (existing?.status === 'completed' && recentlySubmitted) {
        return { status: 'completed', jobId: existing.id, message: 'Natija tayyor.', result: existing.result };
      }
      if (existing?.status === 'completed') {
        await this.jobs.update({ id: existing.id }, { idempotencyKey: null });
      }
      if (existing?.status === 'failed') {
        const oldBullJob = await this.queue.getJob(existing.id);
        if (oldBullJob) await oldBullJob.remove();
        await this.jobs.update({ id: existing.id }, { idempotencyKey: null });
      }
    }

    const waitingCount = await this.queue.getWaitingCount();
    const maxWaiting = boundedInteger(process.env.AI_QUEUE_MAX_WAITING, 100_000, 100, 1_000_000);
    if (waitingCount >= maxWaiting) {
      throw new ServiceUnavailableException('AI navbati band. So‘rovingizni birozdan keyin qayta yuboring.');
    }
    if (input.userId) {
      const maxPendingPerUser = boundedInteger(process.env.AI_MAX_PENDING_JOBS_PER_USER, 5, 1, 20);
      const pendingCount = await this.jobs.count({
        where: { userId: input.userId, status: In(['queued', 'active']) },
      });
      if (pendingCount >= maxPendingPerUser) {
        throw new HttpException('Sizda bajarilayotgan AI so‘rovlari ko‘p. Avval mavjud natijalarni kuting.', HttpStatus.TOO_MANY_REQUESTS);
      }
    }

    const job = this.jobs.create({
      userId: input.userId,
      jobType: input.jobType,
      status: 'queued',
      payload: input.payload,
      fileBuffer: input.fileBuffer ?? null,
      result: null,
      error: null,
      quotaFeature: input.quotaFeature ?? null,
      quotaConsumed: false,
      quotaRefunded: false,
      idempotencyKey,
      attempts: 0,
      priority: 50,
      queueEnqueuedAt: null,
    });
    let persistedJob: AiGenerationJob;
    try {
      persistedJob = await this.jobs.save(job);
    } catch (error) {
      // A concurrent identical request may have won the unique idempotency key.
      if (idempotencyKey) {
        const existing = await this.jobs.findOne({ where: { ...ownerWhere, idempotencyKey } });
        if (existing) return { status: existing.status as 'queued' | 'active' | 'completed', jobId: existing.id, message: existing.status === 'completed' ? 'Natija tayyor.' : 'Test tayyorlanmoqda', result: existing.result };
      }
      throw error;
    }

    let usage: unknown;
    if (input.quotaFeature) {
      if (!input.userId) {
        await this.jobs.update({ id: persistedJob.id }, { status: 'failed', error: 'Quota owner missing.', fileBuffer: null, completedAt: new Date() });
        throw new Error('Quota bilan AI job yaratish uchun userId talab qilinadi.');
      }
      try {
        usage = await this.featureUsage.consume(input.userId, input.quotaFeature);
      } catch (error) {
        await this.jobs.update({ id: persistedJob.id }, { status: 'failed', error: 'Quota tekshiruvi bajarilmadi.', fileBuffer: null, completedAt: new Date() });
        throw error;
      }
      if (!(usage as { allowed?: boolean }).allowed) {
        await this.jobs.update({ id: persistedJob.id }, { status: 'failed', error: 'Tarif limitingiz tugagan.', fileBuffer: null, completedAt: new Date() });
        throw new HttpException('Ushbu AI funksiyasi uchun tarif limitingiz tugagan.', HttpStatus.TOO_MANY_REQUESTS);
      }
      await this.jobs.update({ id: persistedJob.id }, { quotaConsumed: true, payload: { ...input.payload, _jobId: persistedJob.id, ...(usage ? { _quotaReceipt: usage } : {}) } });
    } else {
      await this.jobs.update({ id: persistedJob.id }, { payload: { ...input.payload, _jobId: persistedJob.id } });
    }

    try {
      const tier = (usage as { tier?: string } | undefined)?.tier;
      const tierPriority = tier === 'premium_pro' ? 1 : tier === 'premium' ? 10 : 20;
      const taskOffset = input.jobType === 'ai_tutor' ? 0
        : input.jobType === 'topic_questions' ? 1
        : input.jobType === 'smart_practice' ? 2
        : input.jobType === 'ai_generate' ? 3
        : input.jobType === 'document_quiz' ? 4
        : 0;
      const priority = input.userId ? tierPriority + taskOffset : 100;
      await this.jobs.update({ id: persistedJob.id }, { priority });
      await this.queue.add(input.jobType, { jobId: persistedJob.id }, { jobId: persistedJob.id, priority });
      try {
        await this.jobs.update({ id: persistedJob.id }, { queueEnqueuedAt: new Date() });
      } catch (ackError) {
        this.logger.warn(`AI job ${persistedJob.id} queued but enqueue acknowledgement failed: ${ackError instanceof Error ? ackError.message : String(ackError)}`);
      }
    } catch {
      await this.jobs.update({ id: persistedJob.id }, {
        status: 'failed',
        error: 'AI navbatiga qo‘shib bo‘lmadi. Qayta urinib ko‘ring.',
        completedAt: new Date(),
        fileBuffer: null,
      });
      if (usage && input.quotaFeature) {
        try {
          if (input.userId) await this.featureUsage.refund(input.userId, input.quotaFeature as never, (usage as { periodKey?: string } | undefined)?.periodKey);
          await this.jobs.update({ id: persistedJob.id }, { quotaRefunded: true });
        } catch { /* Preserve the queue error; refund can be retried operationally. */ }
      }
      throw new ServiceUnavailableException('AI navbatiga ulanishda xatolik. Qayta urinib ko‘ring.');
    }

    return { status: 'queued', jobId: persistedJob.id, message: 'Test tayyorlanmoqda', usage };
  }

  async reconcilePendingJobs(): Promise<void> {
    if (!this.queue) return;
    const batchSize = boundedInteger(process.env.AI_QUEUE_RECONCILE_BATCH_SIZE, 500, 1, 5000);
    const pending = await this.jobs.find({
      where: { status: In(['queued', 'active']), queueEnqueuedAt: IsNull() },
      order: { createdAt: 'ASC' },
      take: batchSize,
    });
    let requeued = 0;
    let completed = 0;
    let failed = 0;

    for (const job of pending) {
      try {
        const bullJob = await this.queue.getJob(job.id);
        if (!bullJob) {
          await this.queue.add(job.jobType, { jobId: job.id }, {
            jobId: job.id,
            priority: job.priority ?? (job.userId ? 20 : 100),
          });
          await this.jobs.update({ id: job.id }, { queueEnqueuedAt: new Date() });
          requeued += 1;
          continue;
        }

        const state = await bullJob.getState();
        await this.jobs.update({ id: job.id }, { queueEnqueuedAt: new Date() });
        if (state === 'completed' && job.status !== 'completed') {
          const value = bullJob.returnvalue;
          const result = value && typeof value === 'object'
            ? value as Record<string, unknown>
            : { value };
          await this.markCompleted(job.id, result);
          completed += 1;
        } else if (state === 'failed' && bullJob.attemptsMade >= Number(bullJob.opts.attempts || 1)) {
          await this.markFailedAndRefund(job.id, new Error(bullJob.failedReason || 'AI worker failed'));
          failed += 1;
        }
      } catch (error) {
        this.logger.warn(`AI job recovery skipped for ${job.id}: ${error instanceof Error ? error.message : String(error)}`);
      }
    }

    this.logger.log(`AI job recovery: ${requeued} requeued, ${completed} reconciled, ${failed} failed`);
  }

  async getOwnedJob(userId: string, jobId: string): Promise<AiGenerationJob> {
    const job = await this.jobs.findOne({ where: { id: jobId, userId } });
    if (!job) {
      // Avoid revealing whether a job belongs to another account.
      throw new NotFoundException('AI so‘rovi topilmadi.');
    }
    return job;
  }

  async getJobForWorker(jobId: string): Promise<AiGenerationJob> {
    const job = await this.jobs.createQueryBuilder('job')
      .addSelect('job.fileBuffer')
      .where('job.id = :jobId', { jobId })
      .getOne();
    if (!job) throw new Error('AI generation job not found');
    return job;
  }

  async assertJobActive(jobId: string): Promise<void> {
    const job = await this.jobs.findOne({ where: { id: jobId } });
    if (!job || job.status === 'failed') {
      throw new HttpException('Test yaratish bekor qilindi.', HttpStatus.GONE);
    }
  }

  async getStatus(userId: string, jobId: string) {
    const job = await this.getOwnedJob(userId, jobId);
    const bullJob = this.queue ? await this.queue.getJob(job.id) : null;
    return {
      jobId: job.id,
      status: job.status,
      progress: bullJob?.progress ?? { step: job.status === 'queued' ? 'uploading' : job.status },
      result: job.status === 'completed' ? job.result : undefined,
      error: job.status === 'failed' ? job.error : undefined,
      createdAt: job.createdAt,
      completedAt: job.completedAt,
    };
  }

  async cancelJob(userId: string, jobId: string): Promise<{ cancelled: boolean; message: string }> {
    const job = await this.getOwnedJob(userId, jobId);
    if (job.status === 'completed') return { cancelled: false, message: 'Test allaqachon tayyor.' };
    if (job.status === 'failed') return { cancelled: true, message: 'Vazifa allaqachon to‘xtatilgan.' };
    const bullJob = this.queue ? await this.queue.getJob(job.id) : null;
    if (bullJob) {
      const state = await bullJob.getState();
      if (['waiting', 'delayed', 'waiting-children', 'paused'].includes(state)) {
        try { await bullJob.remove(); } catch { /* Worker may have claimed it concurrently. */ }
      }
    }
    await this.markFailedAndRefund(job.id, new Error('Foydalanuvchi test yaratishni bekor qildi.'));
    return { cancelled: true, message: 'Test yaratish bekor qilindi.' };
  }

  async markActive(jobId: string): Promise<AiGenerationJob> {
    const existing = await this.jobs.findOne({ where: { id: jobId } });
    if (!existing) throw new Error('AI generation job not found');
    if (existing.status === 'completed' || existing.status === 'failed') return existing;
    await this.jobs.increment({ id: jobId }, 'attempts', 1);
    await this.jobs.update({ id: jobId, status: 'queued' }, { status: 'active', error: null });
    const job = await this.jobs.findOne({ where: { id: jobId } });
    if (!job) throw new Error('AI generation job not found');
    return job;
  }

  async markCompleted(jobId: string, result: Record<string, unknown>): Promise<void> {
    const job = await this.jobs.findOne({ where: { id: jobId } });
    if (!job) throw new Error('AI generation job not found');
    if (job.status === 'failed') return;
    job.status = 'completed';
    job.result = result;
    job.fileBuffer = null;
    job.error = null;
    job.completedAt = new Date();
    job.queueEnqueuedAt = job.queueEnqueuedAt ?? new Date();
    await this.jobs.save(job);
  }

  async markRetrying(jobId: string, error: unknown): Promise<void> {
    await this.jobs.update({ id: jobId, status: 'active' }, {
      status: 'queued',
      error: error instanceof Error ? error.message.slice(0, 500) : 'AI generation failed',
    });
  }

  async markFailedAndRefund(jobId: string, error: unknown): Promise<void> {
    const job = await this.jobs.findOne({ where: { id: jobId } });
    if (!job || job.status === 'completed') return;
    if (job.status !== 'failed') {
      await this.jobs.update({ id: jobId }, {
        status: 'failed',
        error: error instanceof Error ? error.message.slice(0, 1000) : 'AI generation failed',
        fileBuffer: null,
        completedAt: new Date(),
      });
    }
    if (job.quotaConsumed && job.quotaFeature && !job.quotaRefunded) {
      const claim = await this.jobs.update(
        { id: jobId, quotaConsumed: true, quotaRefunded: false },
        { quotaRefunded: true },
      );
      if (claim.affected) {
        try {
          if (!job.userId) throw new Error('Quota job owner is missing');
          const receipt = job.payload?._quotaReceipt as { periodKey?: string } | undefined;
          await this.featureUsage.refund(job.userId, job.quotaFeature as never, receipt?.periodKey);
        } catch (refundError) {
          await this.jobs.update({ id: jobId }, { quotaRefunded: false });
          this.logger.error(`AI job quota refund failed for ${jobId}: ${refundError instanceof Error ? refundError.message : String(refundError)}`);
        }
      }
    }
  }
}