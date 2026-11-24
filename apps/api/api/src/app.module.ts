import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { createObserveModule } from '@nestjs/observe';

import { AppController } from './app.controller';
import { AppService } from './app.service';
import { AiModule } from './ai/ai.module';
import { AuthModule } from './auth/auth.module';
import { BattleModule } from './battle/battle.module';
import { UsersModule } from './users/users.module';

import { CreateUsersTable20261122173000 } from './database/migrations/CreateUsersTable';
import { CreateAiTutorMessages20261122180000 } from './database/migrations/CreateAiTutorMessages';
import { AddUserProfileFields20261122192000 } from './database/migrations/AddUserProfileFields';
import { AddUserRankPoints20261124002500 } from './database/migrations/AddUserRankPoints';
import { AddBattleMatchRankChanges20261124040000 } from './database/migrations/AddBattleMatchRankChanges';
import { CreateUserFollows20261124070000 } from './database/migrations/CreateUserFollows';
import { CreateBattleMatches20261122210000 } from './battle/database/CreateBattleMatches';
import { CreateBattleQuestions20261122220000 } from './battle/database/CreateBattleQuestions';

export const { ObserveModule, ObserveInstrument } = createObserveModule();

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
    }),

    TypeOrmModule.forRoot({
      type: 'postgres',
      host: process.env.DB_HOST ?? '127.0.0.1',
      port: Number(process.env.DB_PORT ?? 5432),
      username: process.env.DB_USERNAME ?? 'postgres',
      password: process.env.DB_PASSWORD,
      database: process.env.DB_DATABASE ?? 'quiz_arena',
      autoLoadEntities: true,
      synchronize: false,
      migrations: [
        CreateUsersTable20261122173000,
        CreateAiTutorMessages20261122180000,
        AddUserProfileFields20261122192000,
        AddUserRankPoints20261124002500,
        CreateBattleMatches20261122210000,
        CreateBattleQuestions20261122220000,
        AddBattleMatchRankChanges20261124040000,
        CreateUserFollows20261124070000,
      ],
      migrationsRun: true,
      migrationsTableName: 'typeorm_migrations',
    }),

    ObserveModule.forRoot({
      appKey: process.env.OBSERVE_APP_KEY ?? 'YOUR_APP_KEY',
      appSecret: process.env.OBSERVE_APP_SECRET ?? 'YOUR_APP_SECRET',
      serviceId: 'api',
    }),

    AiModule,
    AuthModule,
    BattleModule,
    UsersModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
