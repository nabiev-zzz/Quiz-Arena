import { BadRequestException, Injectable } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { SubscriptionsService } from './subscriptions.service';

export type MeteredFeature = 'statsPdf' | 'documentQuiz' | 'privateBattle' | 'smartPractice';

@Injectable()
export class FeatureUsageService {
  constructor(
    private readonly dataSource: DataSource,
    private readonly subscriptions: SubscriptionsService,
  ) {}

  async consume(userId: string, featureKey: string) {
    if (!['statsPdf', 'documentQuiz', 'privateBattle', 'smartPractice'].includes(featureKey)) {
      throw new BadRequestException('Funksiya nomi noto‘g‘ri.');
    }

    const feature = featureKey as MeteredFeature;
    const current = await this.subscriptions.current(userId);
    const entitlement = current.entitlements;
    const isDaily = feature === 'privateBattle' || feature === 'smartPractice';
    const limit = feature === 'statsPdf'
      ? entitlement.statsPdf.monthlyLimit
      : feature === 'documentQuiz'
        ? entitlement.documentQuiz.monthlyLimit
        : feature === 'privateBattle'
          ? entitlement.privateBattle.dailyLimit
          : entitlement.smartPractice.dailyLimit;

    if (limit === null) {
      return { allowed: true, featureKey: feature, tier: current.tier, period: 'unlimited', limit: null, used: null, remaining: null };
    }

    if (!Number.isInteger(limit) || limit < 1) {
      return { allowed: false, featureKey: feature, tier: current.tier, period: isDaily ? 'daily' : 'monthly', limit: 0, used: 0, remaining: 0 };
    }

    const now = new Date();
    const periodKey = isDaily
      ? [now.getUTCFullYear(), String(now.getUTCMonth() + 1).padStart(2, '0'), String(now.getUTCDate()).padStart(2, '0')].join('-')
      : [now.getUTCFullYear(), String(now.getUTCMonth() + 1).padStart(2, '0')].join('-');

    const rows = await this.dataSource.query(
      `INSERT INTO "feature_usage" ("userId", "featureKey", "periodKey", "usageCount", "createdAt", "updatedAt")
       VALUES ($1, $2, $3, 1, NOW(), NOW())
       ON CONFLICT ("userId", "featureKey", "periodKey")
       DO UPDATE SET "usageCount" = "feature_usage"."usageCount" + 1, "updatedAt" = NOW()
       WHERE "feature_usage"."usageCount" < $4
       RETURNING "usageCount"`,
      [userId, feature, periodKey, limit],
    ) as Array<{ usageCount: number | string }>;

    const used = rows.length ? Number(rows[0].usageCount) : limit;
    const allowed = rows.length > 0;
    return {
      allowed,
      featureKey: feature,
      tier: current.tier,
      period: isDaily ? 'daily' : 'monthly',
      limit,
      used,
      remaining: Math.max(0, limit - used),
    };
  }
}
