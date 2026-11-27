import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AuthModule } from '../auth/auth.module';
import { AiModule } from '../ai/ai.module';
import { LearningAttempt } from './entities/learning-attempt.entity';
import { LearningTopic } from './entities/learning-topic.entity';
import { LearningQuestion } from './entities/learning-question.entity';
import { LearningWebSession } from './entities/learning-web-session.entity';
import { LearningController } from './learning.controller';
import { LearningService } from './learning.service';
import { SubscriptionsModule } from '../subscriptions/subscriptions.module';
import { LearningQuestionCache } from './learning-question-cache.service';
import { AiJobsModule } from '../ai/queue/ai-jobs.module';
import { DocumentExtractionService } from './document-quiz/document-extraction.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([LearningAttempt, LearningTopic, LearningQuestion, LearningWebSession]),
    AuthModule,
    AiModule,
    SubscriptionsModule,
    AiJobsModule,
  ],
  controllers: [LearningController],
  providers: [LearningService, LearningQuestionCache, DocumentExtractionService],
  exports: [LearningService],
})
export class LearningModule {}
