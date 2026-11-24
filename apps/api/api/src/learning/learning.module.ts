import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AuthModule } from '../auth/auth.module';
import { LearningAttempt } from './entities/learning-attempt.entity';
import { LearningController } from './learning.controller';
import { LearningService } from './learning.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([LearningAttempt]),
    AuthModule,
  ],
  controllers: [LearningController],
  providers: [LearningService],
})
export class LearningModule {}
