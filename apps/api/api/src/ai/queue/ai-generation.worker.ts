import './worker-mode';
import { HttpException, Logger } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { Job, UnrecoverableError, Worker } from 'bullmq';
import { AppModule } from '../../app.module';
import { AiService } from '../ai.service';
import { AiTutorService } from '../ai-tutor.service';
import { AiGenerationQueueService, AI_GENERATION_PREFIX, AI_GENERATION_QUEUE, createAiQueueRedisConnection } from './ai-generation-queue.service';
import { LearningService } from '../../learning/learning.service';

function rethrowWithRetryPolicy(error: unknown): never {
  if (error instanceof HttpException) {
    const status = error.getStatus();
    if (status >= 400 && status < 500 && status !== 429) {
      throw new UnrecoverableError(error.message);
    }
  }
  if (error instanceof Error && /topilmadi|noma.?lum|kamida \d+ ta|invalid document/i.test(error.message)) {
    throw new UnrecoverableError(error.message);
  }
  throw error;
}

function boundedInteger(value: string | undefined, fallback: number, min: number, max: number): number {
  const parsed = Number(value);
  return Number.isFinite(parsed)
    ? Math.min(max, Math.max(min, Math.floor(parsed)))
    : fallback;
}

async function main(): Promise<void> {
  const app = await NestFactory.createApplicationContext(AppModule, {
    logger: ['error', 'warn', 'log'],
  });
  const logger = new Logger('AiGenerationWorker');
  const queueService = app.get(AiGenerationQueueService);
  const learning = app.get(LearningService);
  const ai = app.get(AiService);
  const tutor = app.get(AiTutorService);
  const connection = createAiQueueRedisConnection();
  await connection.connect();
  await connection.ping();

  const worker = new Worker(
    AI_GENERATION_QUEUE,
    async (bullJob: Job<{ jobId: string }>) => {
      const job = await queueService.markActive(bullJob.data.jobId);
      const stored = await queueService.getJobForWorker(job.id);
      if (stored.status === 'completed' && stored.result) return stored.result;
      if (stored.status === 'failed') throw new Error(stored.error || 'AI generation job already failed');
      let result: Record<string, unknown>;

      try {
        switch (stored.jobType) {
          case 'topic_questions':
            result = await learning.generateTopicQuestionsForQueue(stored.payload as never);
            break;
          case 'document_quiz':
            if (!stored.userId) throw new UnrecoverableError('Hujjat job egasi topilmadi.');
            if (!stored.fileBuffer) throw new UnrecoverableError('Hujjat fayli navbat yozuvida topilmadi.');
            result = await learning.generateDocumentQuizForQueue({
              userId: stored.userId,
              payload: stored.payload,
              fileBuffer: stored.fileBuffer,
              onProgress: async (step: string) => { await bullJob.updateProgress({ step, updatedAt: Date.now() }); },
            });
            break;
          case 'smart_practice':
            result = await learning.generateSmartPracticeForQueue(stored.payload as never);
            break;
          case 'ai_tutor':
            result = await tutor.processQueuedMessage(stored.payload as never);
            break;
          case 'ai_generate':
            result = { questions: await ai.generateQuestions(stored.payload as never) };
            break;
          default:
            throw new UnrecoverableError('Noma’lum AI navbat vazifasi.');
        }
      } catch (error) {
        rethrowWithRetryPolicy(error);
      }

      await queueService.markCompleted(job.id, result);
      return result;
    },
    {
      connection,
      prefix: AI_GENERATION_PREFIX,
      concurrency: boundedInteger(process.env.AI_WORKER_CONCURRENCY, 3, 1, 8),
      limiter: {
        max: boundedInteger(process.env.AI_WORKER_RATE_LIMIT_MAX, 120, 1, 1000),
        duration: boundedInteger(process.env.AI_WORKER_RATE_LIMIT_DURATION_MS, 60_000, 1000, 3_600_000),
      },
      lockDuration: 120_000,
      stalledInterval: 30_000,
      maxStalledCount: 2,
    },
  );

  let recoveryInProgress = false;
  const recoveryTimer = setInterval(() => {
    if (recoveryInProgress) return;
    recoveryInProgress = true;
    void queueService.reconcilePendingJobs().finally(() => { recoveryInProgress = false; });
  }, 30_000);

  worker.on('failed', (job, error) => {
    if (!job) return;
    const maxAttempts = Number(job.opts.attempts || 1);
    if (error instanceof UnrecoverableError || job.attemptsMade >= maxAttempts) {
      void queueService.markFailedAndRefund(job.data.jobId, error);
    } else {
      void queueService.markRetrying(job.data.jobId, error);
    }
  });

  worker.on('error', (error) => logger.error(`BullMQ worker error: ${error.message}`));
  logger.log('AI generation worker ishga tushdi. Battle navbati bilan bog‘lanmagan.');

  const shutdown = async () => {
    clearInterval(recoveryTimer);
    await worker.close();
    if (connection.status === 'ready') await connection.quit();
    else connection.disconnect();
    await app.close();
  };
  process.once('SIGTERM', () => { void shutdown(); });
  process.once('SIGINT', () => { void shutdown(); });
}

main().catch((error: unknown) => {
  process.stderr.write(`AI worker startup failed: ${error instanceof Error ? error.message : 'Unknown error'}\n`);
  process.exitCode = 1;
});
