import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';

import { AppController } from './app.controller';
import { AppService } from './app.service';
import { HealthController } from './health/health.controller';
import { AiModule } from './ai/ai.module';
import { AuthModule } from './auth/auth.module';
import { BattleModule } from './battle/battle.module';
import { UsersModule } from './users/users.module';
import { LearningModule } from './learning/learning.module';
import { SubscriptionsModule } from './subscriptions/subscriptions.module';

import { CreateUsersTable20261122173000 } from './database/migrations/CreateUsersTable';
import { CreateAiTutorMessages20261122180000 } from './database/migrations/CreateAiTutorMessages';
import { AddUserProfileFields20261122192000 } from './database/migrations/AddUserProfileFields';
import { AddUserRankPoints20261124002500 } from './database/migrations/AddUserRankPoints';
import { AddUserZcBalance20261125230000 } from './database/migrations/AddUserZcBalance';
import { CreateZcTransactions20261126010000 } from './database/migrations/CreateZcTransactions';
import { CreateUserNotifications20261126150000 } from './database/migrations/CreateUserNotifications';
import { CreateZcStoreItems20261126020000 } from './database/migrations/CreateZcStoreItems';
import { CreateDailyTaskProgress20261126030000 } from './database/migrations/CreateDailyTaskProgress';
import { AddZcProfileBadges20261126040000 } from './database/migrations/AddZcProfileBadges';
import { AddBattleMatchRankChanges20261124040000 } from './database/migrations/AddBattleMatchRankChanges';
import { CreateUserFollows20261124070000 } from './database/migrations/CreateUserFollows';
import { CreateLearningAttempts20261124090000 } from './database/migrations/CreateLearningAttempts';
import { AddLearningAttemptReview20261124235000 } from './database/migrations/AddLearningAttemptReview';
import { CreateLearningQuestionBank20261124200000 } from './database/migrations/CreateLearningQuestionBank';
import { CreateLearningWebSessions20261124210000 } from './database/migrations/CreateLearningWebSessions';
import { CreateUserSubscriptions20261124120000 } from './database/migrations/CreateUserSubscriptions';
import { CreateSubscriptionPayments20261124130000 } from './database/migrations/CreateSubscriptionPayments';
import { AddSubscriptionProviderLifecycle20261124140000 } from './database/migrations/AddSubscriptionProviderLifecycle';
import { CreateAuthOtps20261124150000 } from './database/migrations/CreateAuthOtps';
import { CreateAuthOAuthCodes20261124151000 } from './database/migrations/CreateAuthOAuthCodes';
import { CreateAuthEmailCodes20261124170000 } from './database/migrations/CreateAuthEmailCodes';
import { AddTelegramIdentity20261124190000 } from './database/migrations/AddTelegramIdentity';
import { AddAvatarImageSupport20261124230000 } from './database/migrations/AddAvatarImageSupport';
import { CreateFeatureUsage20261124203000 } from './database/migrations/CreateFeatureUsage';
import { CreateAiGenerationJobs20261125100000 } from './database/migrations/CreateAiGenerationJobs';
import { AddAiTutorGenerationJobLink20261125101000 } from './database/migrations/AddAiTutorGenerationJobLink';
import { AllowSystemAiGenerationJobs20261125102000 } from './database/migrations/AllowSystemAiGenerationJobs';
import { AddAiGenerationJobPriority20261125103000 } from './database/migrations/AddAiGenerationJobPriority';
import { AddAiQueueEnqueuedAt20261125104000 } from './database/migrations/AddAiQueueEnqueuedAt';
import { AllowAdminGrantSubscriptionProvider20261126130000 } from './database/migrations/AllowAdminGrantSubscriptionProvider';
import { CreateBattleMatches20261122210000 } from './battle/database/CreateBattleMatches';
import { CreateBattleQuestions20261122220000 } from './battle/database/CreateBattleQuestions';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
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
        AddUserZcBalance20261125230000,
        CreateZcTransactions20261126010000,
        CreateUserNotifications20261126150000,
        CreateZcStoreItems20261126020000,
        CreateDailyTaskProgress20261126030000,
        AddZcProfileBadges20261126040000,
        CreateBattleMatches20261122210000,
        CreateBattleQuestions20261122220000,
        AddBattleMatchRankChanges20261124040000,
        CreateUserFollows20261124070000,
        CreateLearningAttempts20261124090000,
        AddLearningAttemptReview20261124235000,
        CreateLearningQuestionBank20261124200000,
        CreateLearningWebSessions20261124210000,
        CreateUserSubscriptions20261124120000,
        CreateSubscriptionPayments20261124130000,
        AddSubscriptionProviderLifecycle20261124140000,
        CreateAuthOtps20261124150000,
        CreateAuthOAuthCodes20261124151000,
        CreateAuthEmailCodes20261124170000,
        AddTelegramIdentity20261124190000,
        AddAvatarImageSupport20261124230000,
        CreateFeatureUsage20261124203000,
        CreateAiGenerationJobs20261125100000,
        AddAiTutorGenerationJobLink20261125101000,
        AllowSystemAiGenerationJobs20261125102000,
        AddAiGenerationJobPriority20261125103000,
        AddAiQueueEnqueuedAt20261125104000,
        AllowAdminGrantSubscriptionProvider20261126130000,
      ],
      migrationsRun: process.env.AI_WORKER_PROCESS !== 'true',
      migrationsTableName: 'typeorm_migrations',
    }),
    AiModule,
    AuthModule,
    BattleModule,
    UsersModule,
    LearningModule,
    SubscriptionsModule,
  ],
  controllers: [AppController, HealthController],
  providers: [AppService],
})
export class AppModule {}
