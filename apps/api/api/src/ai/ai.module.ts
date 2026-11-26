import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import { AiService } from './ai.service';
import { AiTutorService } from './ai-tutor.service';
import { SupportAiService } from './support-ai.service';
import { AiController } from './ai.controller';
import { AiTutorMessage } from './entities/ai-tutor-message.entity';
import { BattleMatch } from '../battle/entities/battle-match.entity';
import { LearningAttempt } from '../learning/entities/learning-attempt.entity';
import { User } from '../users/entities/user.entity';

import { AuthModule } from '../auth/auth.module';
import { SubscriptionsModule } from '../subscriptions/subscriptions.module';
import { AiJobsModule } from './queue/ai-jobs.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([AiTutorMessage, BattleMatch, LearningAttempt, User]),
    AuthModule,
    SubscriptionsModule,
    AiJobsModule,
  ],
  providers: [
    AiService,
    AiTutorService,
    SupportAiService,
  ],
  controllers: [
    AiController,
  ],
  exports: [AiService],
})
export class AiModule {}
