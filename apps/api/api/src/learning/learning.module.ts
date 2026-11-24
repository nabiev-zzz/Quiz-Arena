import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AuthModule } from '../auth/auth.module';
import { AiModule } from '../ai/ai.module';
import { LearningAttempt } from './entities/learning-attempt.entity';
import { LearningTopic } from './entities/learning-topic.entity';
import { LearningQuestion } from './entities/learning-question.entity';
import { LearningController } from './learning.controller';
import { LearningService } from './learning.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([LearningAttempt, LearningTopic, LearningQuestion]),
    AuthModule,
    AiModule,
  ],
  controllers: [LearningController],
  providers: [LearningService],
})
export class LearningModule {}
