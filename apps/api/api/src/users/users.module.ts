import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AuthModule } from '../auth/auth.module';
import { User } from './entities/user.entity';
import { UserFollow } from './entities/user-follow.entity';
import { ZcTransaction } from './entities/zc-transaction.entity';
import { ZcStoreItem } from './entities/zc-store-item.entity';
import { UsersController } from './users.controller';
import { CommunityController } from './community.controller';
import { CommunityService } from './community.service';
import { CommunityPost } from './entities/community-post.entity';
import { CommunityPostLike } from './entities/community-post-like.entity';
import { CommunityPostComment } from './entities/community-post-comment.entity';
import { CommunityStory } from './entities/community-story.entity';
import { CommunityStoryView } from './entities/community-story-view.entity';
import { CommunityStorageService } from './community-storage.service';
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
  imports: [TypeOrmModule.forFeature([User, UserFollow, ZcTransaction, ZcStoreItem, DailyTaskProgress, UserNotification, CommunityPost, CommunityPostLike, CommunityPostComment, CommunityStory, CommunityStoryView]), AuthModule],
  controllers: [CommunityController, UsersController, ZcWalletController, ZcStoreController, DailyTasksController, NotificationsController],
  providers: [CommunityStorageService, CommunityService, UsersService, ZcWalletService, ZcStoreService, DailyTasksService, NotificationsService],
  exports: [UsersService, ZcWalletService, ZcStoreService, DailyTasksService],
})
export class UsersModule {}
