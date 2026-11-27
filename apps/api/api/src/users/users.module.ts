import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AuthModule } from '../auth/auth.module';
import { User } from './entities/user.entity';
import { UserFollow } from './entities/user-follow.entity';
import { ZcTransaction } from './entities/zc-transaction.entity';
import { ZcStoreItem } from './entities/zc-store-item.entity';
import { UsersController } from './users.controller';
import { CommunityController } from './community.controller';
import { CommunityPlaybackController } from './community-playback.controller';
import { CommunityLearningController } from './community-learning.controller';
import { CommunityLearningService } from './community-learning.service';
import { CommunityService } from './community.service';
import { CommunityPost } from './entities/community-post.entity';
import { CommunityPostLike } from './entities/community-post-like.entity';
import { CommunityPostComment } from './entities/community-post-comment.entity';
import { CommunityPostSave } from './entities/community-post-save.entity';
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
import { DirectConversation } from './entities/direct-conversation.entity';
import { DirectMessage } from './entities/direct-message.entity';
import { DirectMessagesController } from './direct-messages.controller';
import { DirectMessagesService } from './direct-messages.service';
import { DirectMessagesGateway } from './direct-messages.gateway';

@Module({
  imports: [TypeOrmModule.forFeature([User, UserFollow, ZcTransaction, ZcStoreItem, DailyTaskProgress, UserNotification, CommunityPost, CommunityPostLike, CommunityPostComment, CommunityPostSave, CommunityStory, CommunityStoryView, DirectConversation, DirectMessage]), AuthModule],
  controllers: [DirectMessagesController, CommunityLearningController, CommunityController, CommunityPlaybackController, UsersController, ZcWalletController, ZcStoreController, DailyTasksController, NotificationsController],
  providers: [CommunityStorageService, CommunityLearningService, CommunityService, UsersService, ZcWalletService, ZcStoreService, DailyTasksService, NotificationsService, DirectMessagesService, DirectMessagesGateway],
  exports: [UsersService, ZcWalletService, ZcStoreService, DailyTasksService],
})
export class UsersModule {}
