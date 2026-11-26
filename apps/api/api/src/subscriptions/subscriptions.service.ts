import { ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, MoreThan, Repository } from 'typeorm';
import { UserSubscription } from './entities/subscription.entity';
import { User } from '../users/entities/user.entity';
import { ZcTransaction } from '../users/entities/zc-transaction.entity';
import { getPlanEntitlements, resolveSubscriptionTier } from './plan-entitlements';

@Injectable()
export class SubscriptionsService {
  constructor(
    @InjectRepository(UserSubscription)
    private readonly subscriptions: Repository<UserSubscription>,
    @InjectRepository(User)
    private readonly users: Repository<User>,
    private readonly dataSource: DataSource,
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

  /**
   * One-time, fixed-scope QA provisioning. Only an active admin can grant this
   * exact non-admin account its initial ZC balance and one-year LEGENDA+ plan.
   * Wallet ledger, balance, and subscription are committed atomically.
   */
  async grantQaTester(requesterId: string) {
    const username = 'qa_tester_zelqen';
    const amount = 100_000;
    const idempotencyKey = 'qa-provisioning:qa_tester_zelqen:initial-zc:v1';
    const providerReference = 'qa-provisioning:qa_tester_zelqen:legenda-plus:v1';

    return this.dataSource.transaction(async (manager) => {
      const requester = await manager.findOne(User, { where: { id: requesterId } });
      if (!requester || requester.status !== 'active' || requester.role !== 'admin') {
        throw new ForbiddenException('Faqat faol administrator QA akkauntini sozlashi mumkin');
      }

      const target = await manager.findOne(User, {
        where: { username, status: 'active' },
        lock: { mode: 'pessimistic_write' },
      });
      if (!target) throw new NotFoundException('qa_tester_zelqen akkaunti topilmadi');
      if (target.role !== 'user') {
        throw new ForbiddenException('QA akkauntiga administrator huquqi berilmaydi');
      }

      const existingCredit = await manager.findOne(ZcTransaction, {
        where: { idempotencyKey },
      });
      if (existingCredit) {
        if (existingCredit.userId !== target.id || existingCredit.type !== 'credit' || existingCredit.amount !== amount) {
          throw new ForbiddenException('QA ZC grant idempotency tekshiruvidan o‘tmadi');
        }
      } else {
        const nextBalance = Number(target.zcBalance ?? 0) + amount;
        if (!Number.isSafeInteger(nextBalance)) {
          throw new ForbiddenException('QA akkauntining ZC balansi ruxsat etilgan chegaradan oshadi');
        }
        target.zcBalance = nextBalance;
        await manager.save(User, target);
        await manager.save(ZcTransaction, manager.create(ZcTransaction, {
          userId: target.id,
          type: 'credit',
          amount,
          balanceAfter: nextBalance,
          reason: 'QA tester initial test balance',
          idempotencyKey,
        }));
      }

      let subscription = await manager.findOne(UserSubscription, {
        where: { providerReference },
      });
      if (!subscription) {
        const startsAt = new Date();
        const expiresAt = new Date(startsAt.getTime() + 365 * 24 * 60 * 60 * 1000);
        subscription = manager.create(UserSubscription, {
          userId: target.id,
          planKey: 'legenda_plus_yearly',
          provider: 'admin_grant',
          status: 'active',
          providerReference,
          startsAt,
          expiresAt,
          autoRenew: false,
        });
        await manager.save(UserSubscription, subscription);
      } else if (subscription.userId !== target.id || subscription.planKey !== 'legenda_plus_yearly') {
        throw new ForbiddenException('QA obuna yozuvi kutilgan ma’lumotlarga mos emas');
      }

      return {
        username: target.username,
        role: target.role,
        zcBalance: target.zcBalance,
        tier: 'legenda_plus',
        planKey: subscription.planKey,
        status: subscription.status,
        expiresAt: subscription.expiresAt,
      };
    });
  }

  private readPrice(name: string): number | null {
    const raw = process.env[name];
    if (!raw) return null;
    const amount = Number(raw);
    return Number.isSafeInteger(amount) && amount > 0 ? amount : null;
  }
}
