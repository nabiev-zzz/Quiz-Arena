import { Logger } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { AppModule } from '../app.module';
import { LearningService } from './learning.service';

async function main(): Promise<void> {
  const app = await NestFactory.createApplicationContext(AppModule, {
    logger: ['error', 'warn', 'log'],
  });
  const logger = new Logger('LearningPrewarm');
  try {
    const report = await app.get(LearningService).prewarmPopularTopics();
    logger.log(`AI question prewarm: ${report.queued} queued, ${report.failed} failed`);
    for (const item of report.results) {
      logger.log(`${item.status}: ${item.subjectId}/${item.topicId} (${item.jobId ?? item.error ?? 'no job id'})${item.error ? ' — ' + item.error : ''}`);
    }
    if (report.failed > 0) process.exitCode = 1;
  } finally {
    await app.close();
  }
}

main().catch((error: unknown) => {
  // Avoid printing environment variables or provider credentials.
  const message = error instanceof Error ? error.message : 'Unknown prewarm error';
  process.stderr.write(`Learning prewarm failed: ${message}\n`);
  process.exitCode = 1;
});
