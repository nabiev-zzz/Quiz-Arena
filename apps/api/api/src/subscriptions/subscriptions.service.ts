import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { UserSubscription } from './entities/subscription.entity';

@Injectable()
export class SubscriptionsService {
  constructor(
    @InjectRepository(UserSubscription)
    private readonly subscriptions: Repository<UserSubscription>,
  ) {}

  plans() {
    const monthly = this.readPrice('PREMIUM_MONTHLY_PRICE_UZS');
    const yearly = this.readPrice('PREMIUM_YEARLY_PRICE_UZS');
    return [
      { key: 'premium_monthly', name: 'Premium', durationDays: 30, price: monthly, currency: 'UZS', available: monthly !== null },
      { key: 'premium_yearly', name: 'Premium', durationDays: 365, price: yearly, currency: 'UZS', available: yearly !== null },
    ];
  }

  async current(userId: string) {
    const subscription = await this.subscriptions.findOne({
      where: { userId, status: 'active' },
      order: { expiresAt: 'DESC' },
    });
    if (!subscription || !subscription.expiresAt || subscription.expiresAt.getTime() <= Date.now()) {
      return { isPremium: false, subscription: null };
    }
    return {
      isPremium: true,
      subscription: {
        planKey: subscription.planKey,
        provider: subscription.provider,
        status: subscription.status,
        startsAt: subscription.startsAt,
        expiresAt: subscription.expiresAt,
        autoRenew: subscription.autoRenew,
      },
    };
  }

  private readPrice(name: string): number | null {
    const raw = process.env[name];
    if (!raw) return null;
    const amount = Number(raw);
    return Number.isSafeInteger(amount) && amount > 0 ? amount : null;
  }
}
