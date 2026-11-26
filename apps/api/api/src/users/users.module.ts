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
import { UserNotification } from './entities/user-notification.entity';
import { NotificationsController } from './notifications.controller';
import { NotificationsService } from './notifications.service';

@Module({
  imports: [TypeOrmModule.forFeature([User, UserFollow, ZcTransaction, ZcStoreItem, DailyTaskProgress, UserNotification]), AuthModule],
  controllers: [UsersController, ZcWalletController, ZcStoreController, DailyTasksController, NotificationsController],
  providers: [UsersService, ZcWalletService, ZcStoreService, DailyTasksService, NotificationsService],
  exports: [UsersService, ZcWalletService, ZcStoreService, DailyTasksService],
})
export class UsersModule {}
