import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AiModule } from '../ai/ai.module';
import { AuthModule } from '../auth/auth.module';
import { User } from '../users/entities/user.entity';
import { ZcTransaction } from '../users/entities/zc-transaction.entity';
import { BattleController } from './battle.controller';
import { BattleGateway } from './gateway/battle.gateway';
import { BattleService } from './battle.service';
import { BattleMatch } from './entities/battle-match.entity';
import { BattleQuestion } from './entities/battle-question.entity';

@Module({
  imports: [
    TypeOrmModule.forFeature([BattleMatch, BattleQuestion, User, ZcTransaction]),
    AiModule,
    AuthModule,
  ],
  controllers: [BattleController],
  providers: [BattleService, BattleGateway],
  exports: [BattleService],
})
export class BattleModule {}