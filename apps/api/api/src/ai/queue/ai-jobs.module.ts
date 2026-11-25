import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { SubscriptionsModule } from '../../subscriptions/subscriptions.module';
import { AiGenerationJob } from '../entities/ai-generation-job.entity';
import { AiGenerationQueueService } from './ai-generation-queue.service';

@Module({
  imports: [TypeOrmModule.forFeature([AiGenerationJob]), SubscriptionsModule],
  providers: [AiGenerationQueueService],
  exports: [AiGenerationQueueService],
})
export class AiJobsModule {}
