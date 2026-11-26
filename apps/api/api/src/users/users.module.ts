import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AuthModule } from '../auth/auth.module';
import { User } from './entities/user.entity';
import { UserFollow } from './entities/user-follow.entity';
import { ZcTransaction } from './entities/zc-transaction.entity';
import { ZcStoreItem } from './entities/zc-store-item.entity';
import { UsersController } from './users.controller';
import { UsersService } from './users.service';
import { ZcWalletController } from './zc-wallet.controller';
import { ZcWalletService } from './zc-wallet.service';
import { ZcStoreController } from './zc-store.controller';
import { ZcStoreService } from './zc-store.service';
import { DailyTaskProgress } from './entities/daily-task-progress.entity';
import { DailyTasksController } from './daily-tasks.controller';
import { DailyTasksService } from './daily-tasks.service';

@Module({
  imports: [TypeOrmModule.forFeature([User, UserFollow, ZcTransaction, ZcStoreItem, DailyTaskProgress]), AuthModule],
  controllers: [UsersController, ZcWalletController, ZcStoreController, DailyTasksController],
  providers: [UsersService, ZcWalletService, ZcStoreService, DailyTasksService],
  exports: [UsersService, ZcWalletService, ZcStoreService, DailyTasksService],
})
export class UsersModule {}
