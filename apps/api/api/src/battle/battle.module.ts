import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AiModule } from '../ai/ai.module';
import { AuthModule } from '../auth/auth.module';
import { User } from '../users/entities/user.entity';
import { BattleController } from './battle.controller';
import { BattleGateway } from './gateway/battle.gateway';
import { BattleService } from './battle.service';
import { BattleStateStore } from './battle-state.store';
import { BattleMatch } from './entities/battle-match.entity';
import { BattleQuestion } from './entities/battle-question.entity';
import { SubscriptionsModule } from '../subscriptions/subscriptions.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([BattleMatch, BattleQuestion, User]),
    AiModule,
    AuthModule,
    SubscriptionsModule,
  ],
  controllers: [BattleController],
  providers: [BattleService, BattleStateStore, BattleGateway],
  exports: [BattleService, BattleStateStore],
})
export class BattleModule {}