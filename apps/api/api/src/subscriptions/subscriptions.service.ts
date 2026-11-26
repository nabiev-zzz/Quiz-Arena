import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, MoreThan, Repository } from 'typeorm';
import { UserSubscription } from './entities/subscription.entity';
import { User } from '../users/entities/user.entity';
import { ZcTransaction } from '../users/entities/zc-transaction.entity';
import { UserNotification } from '../users/entities/user-notification.entity';
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


  async adminSearchUsers(requesterId: string, query: string) {
    await this.assertAdmin(requesterId);
    const term = query.trim().replace(/^@/, '').toLowerCase();
    if (term.length < 2) throw new BadRequestException('Kamida 2 ta belgi kiriting');
    const users = await this.users.createQueryBuilder('user')
      .where('user.status = :status', { status: 'active' })
      .andWhere('(LOWER(user.username) LIKE :term OR LOWER(user.displayName) LIKE :term)', { term: `%${term}%` })
      .orderBy('user.username', 'ASC').take(20).getMany();
    return users.map(user => ({ id: user.id, username: user.username, displayName: user.displayName, role: user.role, zcBalance: user.zcBalance }));
  }

  private async assertAdmin(requesterId: string) {
    const requester = await this.users.findOne({ where: { id: requesterId } });
    if (!requester || requester.status !== 'active' || requester.role !== 'admin') {
      throw new ForbiddenException('Faqat faol administrator bu amalni bajarishi mumkin');
    }
    return requester;
  }

  async adminGrant(requesterId: string, input: { username: string; zcAmount?: number; planKey?: string; durationDays?: number }) {
    await this.assertAdmin(requesterId);
    const username = input.username.trim().replace(/^@/, '').toLowerCase();
    const zcAmount = input.zcAmount ?? 0;
    const planKey = input.planKey ?? 'none';
    const durationDays = input.durationDays ?? 30;
    if (!username || username.length > 30) throw new BadRequestException('Username noto‘g‘ri');
    if (!Number.isSafeInteger(zcAmount) || zcAmount < 0 || zcAmount > 2_000_000_000) throw new BadRequestException('ZC miqdori 0 dan 2 milliardgacha butun son bo‘lishi kerak');
    const plans: Record<string, string> = { premium: 'premium', premium_pro: 'premium_pro', legenda_plus: 'legenda_plus' };
    if (planKey !== 'none' && !plans[planKey]) throw new BadRequestException('Premium turi noto‘g‘ri');
    if (!Number.isSafeInteger(durationDays) || durationDays < 1 || durationDays > 36500) throw new BadRequestException('Obuna muddati 1–36500 kun oralig‘ida bo‘lishi kerak');
    if (zcAmount === 0 && planKey === 'none') throw new BadRequestException('ZC yoki Premium miqdoridan birini kiriting');

    return this.dataSource.transaction(async manager => {
      const target = await manager.findOne(User, { where: { username, status: 'active' }, lock: { mode: 'pessimistic_write' } });
      if (!target) throw new NotFoundException('Foydalanuvchi topilmadi');
      if (target.role === 'admin') throw new BadRequestException('Boshqa administrator akkauntiga grant berish taqiqlangan');
      const now = new Date();
      let newBalance = Number(target.zcBalance ?? 0);
      if (zcAmount > 0) {
        newBalance += zcAmount;
        if (!Number.isSafeInteger(newBalance) || newBalance > 2_147_483_647) throw new BadRequestException('Yangi ZC balansi ruxsat etilgan chegaradan oshadi');
        target.zcBalance = newBalance;
        await manager.save(User, target);
        await manager.save(ZcTransaction, manager.create(ZcTransaction, {
          userId: target.id, type: 'credit', amount: zcAmount, balanceAfter: newBalance,
          reason: 'Administrator tomonidan ZC berildi', idempotencyKey: null,
        }));
      }
      let expiresAt: Date | null = null;
      if (planKey !== 'none') {
        const active = await manager.findOne(UserSubscription, { where: { userId: target.id, status: 'active' }, order: { expiresAt: 'DESC' }, lock: { mode: 'pessimistic_write' } });
        const startAt = active?.expiresAt && active.expiresAt > now ? active.expiresAt : now;
        expiresAt = new Date(startAt.getTime() + durationDays * 86400000);
        if (active && active.provider === 'admin_grant') {
          active.planKey = `${planKey}_${durationDays >= 180 ? 'yearly' : 'monthly'}`;
          active.startsAt = active.startsAt ?? now;
          active.expiresAt = expiresAt;
          active.providerReference = `admin-grant:${target.id}:${Date.now()}`;
          await manager.save(UserSubscription, active);
        } else {
          if (active && active.expiresAt && active.expiresAt > now) {
            throw new BadRequestException('Akkauntda boshqa faol obuna bor. Avval uning muddati tugashini kuting yoki qo‘llab-quvvatlashga murojaat qiling');
          }
          await manager.save(UserSubscription, manager.create(UserSubscription, {
            userId: target.id, planKey: `${planKey}_${durationDays >= 180 ? 'yearly' : 'monthly'}`, provider: 'admin_grant', status: 'active',
            providerReference: `admin-grant:${target.id}:${Date.now()}`, startsAt: now, expiresAt, autoRenew: false,
          }));
        }
      }
      const parts = [];
      if (zcAmount > 0) parts.push(`Hisobingizga ${zcAmount.toLocaleString('en-US')} ZC qo‘shildi. Yangi balans: ${newBalance.toLocaleString('en-US')} ZC.`);
      if (planKey !== 'none') parts.push(`${planKey.toUpperCase()} obunasi ${durationDays} kunga faollashtirildi.`);
      await manager.save(UserNotification, manager.create(UserNotification, {
        userId: target.id, type: 'admin_reward', title: 'Sizga mukofot berildi!', body: parts.join(' '), isRead: false,
      }));
      return { username: target.username, zcBalance: newBalance, zcGranted: zcAmount, planKey, expiresAt };
    });
  }

  async adminRevoke(requesterId: string, input: { username: string; zcAmount?: number; premium?: boolean }) {
    await this.assertAdmin(requesterId);
    const username = input.username.trim().replace(/^@/, '').toLowerCase();
    const zcAmount = input.zcAmount ?? 0;
    const revokePremium = input.premium === true;
    if (!username || !Number.isSafeInteger(zcAmount) || zcAmount < 0 || (!zcAmount && !revokePremium)) throw new BadRequestException('Olib tashlash miqdorini tanlang');
    return this.dataSource.transaction(async manager => {
      const target = await manager.findOne(User, { where: { username, status: 'active' }, lock: { mode: 'pessimistic_write' } });
      if (!target) throw new NotFoundException('Foydalanuvchi topilmadi');
      if (target.role === 'admin') throw new BadRequestException('Administrator akkauntiga ta’sir qilish mumkin emas');
      let removedZc = 0;
      if (zcAmount > 0) {
        removedZc = Math.min(zcAmount, Number(target.zcBalance ?? 0));
        if (removedZc > 0) {
          target.zcBalance -= removedZc;
          await manager.save(User, target);
          await manager.save(ZcTransaction, manager.create(ZcTransaction, {
            userId: target.id, type: 'debit', amount: removedZc, balanceAfter: target.zcBalance,
            reason: 'Administrator tomonidan ZC olib tashlandi', idempotencyKey: null,
          }));
        }
      }
      let premiumRevoked = false;
      if (revokePremium) {
        const active = await manager.find(UserSubscription, { where: { userId: target.id, status: 'active', provider: 'admin_grant' } });
        for (const subscription of active) {
          subscription.status = 'cancelled';
          subscription.autoRenew = false;
          await manager.save(UserSubscription, subscription);
          premiumRevoked = true;
        }
      }
      const message = [removedZc ? `${removedZc.toLocaleString('en-US')} ZC hisobingizdan olib tashlandi. Qolgan balans: ${target.zcBalance.toLocaleString('en-US')} ZC.` : '', premiumRevoked ? 'Administrator bergan Premium obunangiz bekor qilindi.' : ''].filter(Boolean).join(' ');
      await manager.save(UserNotification, manager.create(UserNotification, {
        userId: target.id, type: 'admin_revoke', title: 'Hisobingizdagi o‘zgarish', body: message, isRead: false,
      }));
      return { username: target.username, zcBalance: target.zcBalance, zcRemoved: removedZc, premiumRevoked };
    });
  }

  private readPrice(name: string): number | null {
    const raw = process.env[name];
    if (!raw) return null;
    const amount = Number(raw);
    return Number.isSafeInteger(amount) && amount > 0 ? amount : null;
  }
}
