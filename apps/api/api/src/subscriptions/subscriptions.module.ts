import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AuthModule } from '../auth/auth.module';
import { User } from '../users/entities/user.entity';
import { UserSubscription } from './entities/subscription.entity';
import { SubscriptionPayment } from './entities/subscription-payment.entity';
import { SubscriptionsController } from './subscriptions.controller';
import { SubscriptionsService } from './subscriptions.service';
import { SubscriptionPaymentsController } from './subscription-payments.controller';
import { SubscriptionPaymentsService } from './subscription-payments.service';
import { FeatureUsageService } from './feature-usage.service';

@Module({
  imports: [TypeOrmModule.forFeature([UserSubscription, SubscriptionPayment, User]), AuthModule],
  controllers: [SubscriptionsController, SubscriptionPaymentsController],
  providers: [SubscriptionsService, SubscriptionPaymentsService, FeatureUsageService],
  exports: [SubscriptionsService, FeatureUsageService],
})
export class SubscriptionsModule {}
