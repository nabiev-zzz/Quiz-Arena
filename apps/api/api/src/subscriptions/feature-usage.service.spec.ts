import { jest } from '@jest/globals';
import { BadRequestException } from '@nestjs/common';
import { getPlanEntitlements } from './plan-entitlements';
import { FeatureUsageService } from './feature-usage.service';

describe('FeatureUsageService document quiz allowances', () => {
  const query = jest.fn();
  const current = jest.fn();
  const service = new FeatureUsageService({ query } as never, { current } as never);

  beforeEach(() => {
    jest.clearAllMocks();
    query.mockResolvedValue([{ usageCount: 1 }]);
  });

  it.each([
    [null, 5, 'free'],
    ['premium_monthly', 20, 'premium'],
    ['premium_pro_monthly', 40, 'premium_pro'],
    ['legenda_plus_monthly', null, 'legenda_plus'],
  ] as const)('consumes document quota for %s', async (planKey, limit, tier) => {
    const entitlements = getPlanEntitlements(planKey);
    current.mockResolvedValue({ tier, entitlements });
    await expect(service.consume('user-1', 'documentQuiz')).resolves.toMatchObject({
      allowed: true, featureKey: 'documentQuiz', tier, limit, used: 1,
      remaining: limit === null ? null : limit - 1,
      period: limit === null ? 'unlimited' : 'monthly',
    });
    expect(query).toHaveBeenCalledTimes(1);
  });

  it('blocks FREE users after five accepted document jobs', async () => {
    current.mockResolvedValue({ tier: 'free', entitlements: getPlanEntitlements(null) });
    query.mockResolvedValue([]);
    await expect(service.consume('user-1', 'documentQuiz')).resolves.toMatchObject({
      allowed: false, limit: 5, used: 5, remaining: 0,
    });
  });

  it('returns usage without consuming an additional document', async () => {
    current.mockResolvedValue({ tier: 'free', entitlements: getPlanEntitlements(null) });
    query.mockResolvedValue([{ usageCount: 3 }]);
    await expect(service.usage('user-1', 'documentQuiz')).resolves.toMatchObject({
      allowed: true, featureKey: 'documentQuiz', limit: 5, used: 3, remaining: 2, period: 'monthly',
    });
    expect(query).toHaveBeenCalledTimes(1);
  });

  it('shows unlimited LEGENDA+ usage while still counting documents', async () => {
    current.mockResolvedValue({ tier: 'legenda_plus', entitlements: getPlanEntitlements('legenda_plus_monthly') });
    query.mockResolvedValue([{ usageCount: 12 }]);
    await expect(service.usage('user-1', 'documentQuiz')).resolves.toMatchObject({
      allowed: true, limit: null, used: 12, remaining: null, period: 'unlimited',
    });
  });

  it('refunds the original month when a queued job fails after the month changes', async () => {
    await service.refund('user-1', 'documentQuiz', '2026-11');
    expect(query).toHaveBeenCalledWith(expect.stringContaining('UPDATE "feature_usage"'), ['user-1', 'documentQuiz', '2026-11']);
  });

  it('rejects unsupported feature keys', async () => {
    await expect(service.consume('user-1', 'admin')).rejects.toBeInstanceOf(BadRequestException);
    expect(current).not.toHaveBeenCalled();
  });
});
