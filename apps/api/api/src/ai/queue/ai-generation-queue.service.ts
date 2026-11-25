import { Injectable, Logger, OnModuleDestroy, OnModuleInit, ServiceUnavailableException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Queue } from 'bullmq';
import Redis from 'ioredis';
import { createHash } from 'node:crypto';
import { Repository } from 'typeorm';
import { FeatureUsageService } from '../../subscriptions/feature-usage.service';
import { AiGenerationJob, AiGenerationJobType } from '../entities/ai-generation-job.entity';

export const AI_GENERATION_QUEUE = 'ai-generation';
export const AI_GENERATION_PREFIX = `quiz-arena:${process.env.NODE_ENV || 'development'}:ai-bull`;

export function createAiQueueRedisConnection(): Redis {
  const url = process.env.REDIS_URL?.trim() || process.env.VALKEY_URL?.trim();
  const host = process.env.VALKEY_HOST?.trim();
  if (url) {
    return new Redis(url, {
      lazyConnect: true,
      connectTimeout: 5000,
      maxRetriesPerRequest: null,
      enableReadyCheck: true,
    });
  }
  if (!host) throw new Error('AI queue uchun REDIS_URL, VALKEY_URL yoki VALKEY_HOST sozlanmagan.');
  return new Redis({
    host,
    port: Number(process.env.VALKEY_PORT || 6379),
    password: process.env.VALKEY_PASSWORD || undefined,
    lazyConnect: true,
    connectTimeout: 5000,
    maxRetriesPerRequest: null,
    enableReadyCheck: true,
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
    if (!process.env.REDIS_URL?.trim() && !process.env.VALKEY_URL?.trim() && !process.env.VALKEY_HOST?.trim()) {
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
    userId: string;
    jobType: AiGenerationJobType;
    payload: Record<string, unknown>;
    fileBuffer?: Buffer;
    quotaFeature?: string;
    quotaConsumed?: boolean;
    idempotencyKey?: string;
  }): Promise<{ status: 'queued' | 'active' | 'completed'; jobId: string; message: string; result?: Record<string, unknown> | null }> {
    if (!this.queue) {
      throw new ServiceUnavailableException('AI navbati vaqtincha ishlamayapti. Iltimos, birozdan keyin qayta urinib ko‘ring.');
    }

    const idempotencyKey = input.idempotencyKey
      ? createHash('sha256').update(input.idempotencyKey).digest('hex')
      : null;
    if (idempotencyKey) {
      const existing = await this.jobs.findOne({ where: { userId: input.userId, idempotencyKey } });
      if (existing && ['queued', 'active', 'completed'].includes(existing.status)) {
        return {
          status: existing.status as 'queued' | 'active' | 'completed',
          jobId: existing.id,
          message: existing.status === 'completed' ? 'Natija tayyor.' : 'Test tayyorlanmoqda',
          result: existing.result,
        };
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
      quotaConsumed: Boolean(input.quotaConsumed),
      quotaRefunded: false,
      idempotencyKey,
      attempts: 0,
    });
    await this.jobs.save(job);

    try {
      await this.queue.add(input.jobType, { jobId: job.id }, { jobId: job.id });
    } catch (error) {
      await this.jobs.update({ id: job.id }, {
        status: 'failed',
        error: 'AI navbatiga qo‘shib bo‘lmadi. Qayta urinib ko‘ring.',
        completedAt: new Date(),
        fileBuffer: null,
      });
      if (input.quotaConsumed && input.quotaFeature) {
        try { await this.featureUsage.refund(input.userId, input.quotaFeature as never); } catch { /* retain queue error */ }
      }
      throw new ServiceUnavailableException('AI navbatiga ulanishda xatolik. Qayta urinib ko‘ring.');
    }

    return { status: 'queued', jobId: job.id, message: 'Test tayyorlanmoqda' };
  }

  async getOwnedJob(userId: string, jobId: string): Promise<AiGenerationJob> {
    const job = await this.jobs.findOne({ where: { id: jobId, userId } });
    if (!job) {
      // Avoid revealing whether a job belongs to another account.
      const { NotFoundException } = await import('@nestjs/common');
      throw new NotFoundException('AI so‘rovi topilmadi.');
    }
    return job;
  }

  async markActive(jobId: string): Promise<AiGenerationJob> {
    await this.jobs.increment({ id: jobId }, 'attempts', 1);
    await this.jobs.update({ id: jobId, status: 'queued' }, { status: 'active', error: null });
    const job = await this.jobs.findOne({ where: { id: jobId } });
    if (!job) throw new Error('AI generation job not found');
    return job;
  }

  async markCompleted(jobId: string, result: Record<string, unknown>): Promise<void> {
    await this.jobs.update({ id: jobId }, {
      status: 'completed',
      result,
      fileBuffer: null,
      error: null,
      completedAt: new Date(),
    });
  }

  async markRetrying(jobId: string, error: unknown): Promise<void> {
    await this.jobs.update({ id: jobId, status: 'active' }, {
      status: 'queued',
      error: error instanceof Error ? error.message.slice(0, 500) : 'AI generation failed',
    });
  }

  async markFailedAndRefund(jobId: string, error: unknown): Promise<void> {
    const job = await this.jobs.findOne({ where: { id: jobId } });
    if (!job || job.status === 'completed' || job.status === 'failed') return;
    await this.jobs.update({ id: jobId }, {
      status: 'failed',
      error: error instanceof Error ? error.message.slice(0, 1000) : 'AI generation failed',
      fileBuffer: null,
      completedAt: new Date(),
    });
    if (job.quotaConsumed && job.quotaFeature && !job.quotaRefunded) {
      try {
        await this.featureUsage.refund(job.userId, job.quotaFeature as never);
        await this.jobs.update({ id: jobId }, { quotaRefunded: true });
      } catch (refundError) {
        this.logger.error(`AI job quota refund failed for ${jobId}: ${refundError instanceof Error ? refundError.message : String(refundError)}`);
      }
    }
  }
}
