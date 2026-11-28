import { BadRequestException, Injectable } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { SubscriptionsService } from './subscriptions.service';

export type MeteredFeature = 'statsPdf' | 'documentQuiz' | 'privateBattle' | 'smartPractice' | 'aiTutor';

type UsageReceipt = {
  allowed: boolean;
  featureKey: MeteredFeature;
  tier: string;
  period: 'daily' | 'monthly' | 'unlimited';
  periodKey: string;
  limit: number | null;
  used: number;
  remaining: number | null;
};

@Injectable()
export class FeatureUsageService {
  constructor(
    private readonly dataSource: DataSource,
    private readonly subscriptions: SubscriptionsService,
  ) {}

  private getPeriodKey(isDaily: boolean, date = new Date()): string {
    const parts = new Intl.DateTimeFormat('en-CA', {
      timeZone: 'Asia/Tashkent',
      year: 'numeric',
      month: '2-digit',
      ...(isDaily ? { day: '2-digit' } : {}),
    }).formatToParts(date);
    const value = (type: Intl.DateTimeFormatPartTypes) => parts.find((part) => part.type === type)?.value ?? '';
    return isDaily ? `${value('year')}-${value('month')}-${value('day')}` : `${value('year')}-${value('month')}`;
  }

  private getLimit(entitlements: Awaited<ReturnType<SubscriptionsService['current']>>['entitlements'], feature: MeteredFeature): number | null {
    switch (feature) {
      case 'statsPdf': return entitlements.statsPdf.monthlyLimit;
      case 'documentQuiz': return entitlements.documentQuiz.monthlyLimit;
      case 'privateBattle': return entitlements.privateBattle.dailyLimit;
      case 'smartPractice': return entitlements.smartPractice.dailyLimit;
      case 'aiTutor': return entitlements.aiTutor.available ? entitlements.aiTutor.dailyMessages : 0;
    }
  }

  private isDaily(feature: MeteredFeature): boolean {
    return feature === 'privateBattle' || feature === 'smartPractice' || feature === 'aiTutor';
  }

  private assertFeature(featureKey: string): MeteredFeature {
    if (!['statsPdf', 'documentQuiz', 'privateBattle', 'smartPractice', 'aiTutor'].includes(featureKey)) {
      throw new BadRequestException('Funksiya nomi noto‘g‘ri.');
    }
    return featureKey as MeteredFeature;
  }

  async usage(userId: string, featureKey: string): Promise<UsageReceipt> {
    const feature = this.assertFeature(featureKey);
    const current = await this.subscriptions.current(userId);
    const limit = this.getLimit(current.entitlements, feature);
    const isDaily = this.isDaily(feature);
    const periodKey = this.getPeriodKey(isDaily);
    const rows = await this.dataSource.query(
      `SELECT "usageCount" FROM "feature_usage" WHERE "userId" = $1 AND "featureKey" = $2 AND "periodKey" = $3 LIMIT 1`,
      [userId, feature, periodKey],
    ) as Array<{ usageCount: number | string }>;
    const used = rows.length ? Number(rows[0].usageCount) : 0;
    return {
      allowed: limit === null || (Number.isInteger(limit) && limit > used),
      featureKey: feature,
      tier: current.tier,
      period: limit === null ? 'unlimited' : isDaily ? 'daily' : 'monthly',
      periodKey,
      limit,
      used,
      remaining: limit === null ? null : Math.max(0, limit - used),
    };
  }

  async consume(userId: string, featureKey: string): Promise<UsageReceipt> {
    const feature = this.assertFeature(featureKey);
    const current = await this.subscriptions.current(userId);
    const limit = this.getLimit(current.entitlements, feature);
    const isDaily = this.isDaily(feature);
    const periodKey = this.getPeriodKey(isDaily);

    // Document-quiz usage is recorded even for LEGENDA+ so the account can see its usage.
    if (limit === null && feature !== 'documentQuiz') {
      return { allowed: true, featureKey: feature, tier: current.tier, period: 'unlimited', periodKey, limit: null, used: 0, remaining: null };
    }
    if (limit !== null && (!Number.isInteger(limit) || limit < 1)) {
      return { allowed: false, featureKey: feature, tier: current.tier, period: isDaily ? 'daily' : 'monthly', periodKey, limit: 0, used: 0, remaining: 0 };
    }

    const rows = await this.dataSource.query(
      limit === null
        ? `INSERT INTO "feature_usage" ("userId", "featureKey", "periodKey", "usageCount", "createdAt", "updatedAt")
           VALUES ($1, $2, $3, 1, NOW(), NOW())
           ON CONFLICT ("userId", "featureKey", "periodKey")
           DO UPDATE SET "usageCount" = "feature_usage"."usageCount" + 1, "updatedAt" = NOW()
           RETURNING "usageCount"`
        : `INSERT INTO "feature_usage" ("userId", "featureKey", "periodKey", "usageCount", "createdAt", "updatedAt")
           VALUES ($1, $2, $3, 1, NOW(), NOW())
           ON CONFLICT ("userId", "featureKey", "periodKey")
           DO UPDATE SET "usageCount" = "feature_usage"."usageCount" + 1, "updatedAt" = NOW()
           WHERE "feature_usage"."usageCount" < $4
           RETURNING "usageCount"`,
      limit === null ? [userId, feature, periodKey] : [userId, feature, periodKey, limit],
    ) as Array<{ usageCount: number | string }>;

    const allowed = rows.length > 0;
    const used = allowed ? Number(rows[0].usageCount) : (limit ?? 0);
    return {
      allowed,
      featureKey: feature,
      tier: current.tier,
      period: limit === null ? 'unlimited' : isDaily ? 'daily' : 'monthly',
      periodKey,
      limit,
      used,
      remaining: limit === null ? null : Math.max(0, limit - used),
    };
  }

  async refund(userId: string, featureKey: MeteredFeature, consumedPeriodKey?: string): Promise<void> {
    const isDaily = this.isDaily(featureKey);
    const periodKey = consumedPeriodKey && /^\d{4}-\d{2}(?:-\d{2})?$/.test(consumedPeriodKey)
      ? consumedPeriodKey
      : this.getPeriodKey(isDaily);
    await this.dataSource.query(
      `UPDATE "feature_usage"
       SET "usageCount" = GREATEST("usageCount" - 1, 0), "updatedAt" = NOW()
       WHERE "userId" = $1 AND "featureKey" = $2 AND "periodKey" = $3 AND "usageCount" > 0`,
      [userId, featureKey, periodKey],
    );
  }
}
