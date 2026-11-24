import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { MoreThan, Repository } from 'typeorm';
import { UserSubscription } from './entities/subscription.entity';
import { User } from '../users/entities/user.entity';
import { getPlanEntitlements, resolveSubscriptionTier } from './plan-entitlements';

@Injectable()
export class SubscriptionsService {
  constructor(
    @InjectRepository(UserSubscription)
    private readonly subscriptions: Repository<UserSubscription>,
    @InjectRepository(User)
    private readonly users: Repository<User>,
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
    const user = await this.users.findOne({ where: { id: userId, status: 'active' } });
    if (user?.role === 'admin') {
      const planKey = 'legenda_plus_yearly';
      return {
        isPremium: true,
        isOwner: true,
        tier: resolveSubscriptionTier(planKey),
        entitlements: getPlanEntitlements(planKey),
        subscription: {
          planKey,
          provider: 'owner',
          status: 'active',
          startsAt: user.createdAt,
          expiresAt: null,
          autoRenew: false,
        },
      };
    }

    const subscription = await this.subscriptions.findOne({
      where: { userId, status: 'active', expiresAt: MoreThan(new Date()) },
      order: { expiresAt: 'DESC' },
    });
    const planKey = subscription?.expiresAt ? subscription.planKey : null;
    const tier = resolveSubscriptionTier(planKey);

    if (!subscription || !subscription.expiresAt || tier === 'free') {
      return {
        isPremium: false,
        tier: 'free',
        entitlements: getPlanEntitlements(null),
        subscription: null,
      };
    }

    return {
      isPremium: true,
      tier,
      entitlements: getPlanEntitlements(planKey),
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
