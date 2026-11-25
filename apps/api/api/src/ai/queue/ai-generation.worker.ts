import { Logger } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { Job, Worker } from 'bullmq';
import { AppModule } from '../../app.module';
import { AiService } from '../ai.service';
import { AiTutorService } from '../ai-tutor.service';
import { AiGenerationQueueService, AI_GENERATION_PREFIX, AI_GENERATION_QUEUE, createAiQueueRedisConnection } from './ai-generation-queue.service';
import { LearningService } from '../../learning/learning.service';

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
      let result: Record<string, unknown>;

      switch (stored.jobType) {
        case 'topic_questions':
          result = await learning.generateTopicQuestionsForQueue(stored.payload as never);
          break;
        case 'document_quiz':
          if (!stored.userId) throw new Error('Hujjat job egasi topilmadi.');
          if (!stored.fileBuffer) throw new Error('Hujjat fayli navbat yozuvida topilmadi.');
          result = await learning.generateDocumentQuizForQueue({
            userId: stored.userId,
            payload: stored.payload,
            fileBuffer: stored.fileBuffer,
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
          throw new Error('Noma’lum AI navbat vazifasi.');
      }

      await queueService.markCompleted(job.id, result);
      return result;
    },
    {
      connection,
      prefix: AI_GENERATION_PREFIX,
      concurrency: Math.max(1, Math.min(8, Number(process.env.AI_WORKER_CONCURRENCY || 3))),
      limiter: {
        max: Math.max(1, Math.min(1000, Number(process.env.AI_WORKER_RATE_LIMIT_MAX || 120))),
        duration: Math.max(1000, Number(process.env.AI_WORKER_RATE_LIMIT_DURATION_MS || 60_000)),
      },
      lockDuration: 120_000,
      stalledInterval: 30_000,
      maxStalledCount: 2,
    },
  );

  worker.on('failed', (job, error) => {
    if (!job) return;
    const maxAttempts = Number(job.opts.attempts || 1);
    if (job.attemptsMade >= maxAttempts) {
      void queueService.markFailedAndRefund(job.data.jobId, error);
    } else {
      void queueService.markRetrying(job.data.jobId, error);
    }
  });

  worker.on('error', (error) => logger.error(`BullMQ worker error: ${error.message}`));
  logger.log('AI generation worker ishga tushdi. Battle navbati bilan bog‘lanmagan.');

  const shutdown = async () => {
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
