import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { MoreThan, Repository } from 'typeorm';
import { UserSubscription } from './entities/subscription.entity';

@Injectable()
export class SubscriptionsService {
  constructor(
    @InjectRepository(UserSubscription)
    private readonly subscriptions: Repository<UserSubscription>,
  ) {}

  plans() {
    const tiers = [
      { key: 'premium', name: 'PREMIUM', monthlyEnv: 'PREMIUM_MONTHLY_PRICE_UZS', yearlyEnv: 'PREMIUM_YEARLY_PRICE_UZS' },
      { key: 'premium_pro', name: 'PREMIUM PRO', monthlyEnv: 'PREMIUM_PRO_MONTHLY_PRICE_UZS', yearlyEnv: 'PREMIUM_PRO_YEARLY_PRICE_UZS' },
      { key: 'legenda_plus', name: 'LEGENDA+', monthlyEnv: 'LEGENDA_PLUS_MONTHLY_PRICE_UZS', yearlyEnv: 'LEGENDA_PLUS_YEARLY_PRICE_UZS' },
    ];
    return tiers.flatMap((tier) => {
      const monthly = this.readPrice(tier.monthlyEnv);
      const yearly = this.readPrice(tier.yearlyEnv);
      return [
        { key: `${tier.key}_monthly`, name: tier.name, durationDays: 30, price: monthly, currency: 'UZS', available: monthly !== null },
        { key: `${tier.key}_yearly`, name: tier.name, durationDays: 365, price: yearly, currency: 'UZS', available: yearly !== null },
      ];
    });
  }

  async current(userId: string) {
    const subscription = await this.subscriptions.findOne({
      where: { userId, status: 'active', expiresAt: MoreThan(new Date()) },
      order: { expiresAt: 'DESC' },
    });
    if (!subscription || !subscription.expiresAt) {
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
