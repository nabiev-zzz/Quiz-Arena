import { getPlanEntitlements, resolveSubscriptionTier } from './plan-entitlements';

describe('subscription plan entitlements', () => {
  it.each([
    ['premium_monthly', 'premium'],
    ['premium_yearly', 'premium'],
    ['premium_pro_monthly', 'premium_pro'],
    ['premium_pro_yearly', 'premium_pro'],
    ['legenda_plus_monthly', 'legenda_plus'],
    ['legenda_plus_yearly', 'legenda_plus'],
  ] as const)('resolves %s to %s', (planKey, expected) => {
    expect(resolveSubscriptionTier(planKey)).toBe(expected);
  });

  it('falls back to FREE for missing or unknown plans', () => {
    expect(resolveSubscriptionTier(null)).toBe('free');
    expect(resolveSubscriptionTier('unknown_plan')).toBe('free');
  });

  it('provides tiered AI Tutor quotas and advanced analysis to PREMIUM PRO+', () => {
    expect(getPlanEntitlements(null).aiTutor.dailyMessages).toBe(3);
    expect(getPlanEntitlements('premium_monthly').aiTutor.dailyMessages).toBe(10);
    expect(getPlanEntitlements('premium_pro_monthly').aiTutor).toMatchObject({
      available: true, dailyMessages: 100, errorAnalysis: true, fullHistory: true,
    });
    expect(getPlanEntitlements('legenda_plus_yearly').aiTutor.dailyMessages).toBeNull();
  });

  it('gives higher tiers larger document quiz and private battle limits', () => {
    const free = getPlanEntitlements();
    const premium = getPlanEntitlements('premium_monthly');
    const pro = getPlanEntitlements('premium_pro_monthly');
    const legend = getPlanEntitlements('legenda_plus_monthly');
    expect(free.documentQuiz.monthlyLimit).toBeLessThan(premium.documentQuiz.monthlyLimit);
    expect(premium.documentQuiz.monthlyLimit).toBeLessThan(pro.documentQuiz.monthlyLimit);
    expect(pro.documentQuiz.monthlyLimit).toBeLessThan(legend.documentQuiz.monthlyLimit);
    expect(free.privateBattle.dailyLimit).toBeLessThan(legend.privateBattle.dailyLimit);
  });

  it('reserves Legend status and elite tournaments for LEGENDA+', () => {
    expect(getPlanEntitlements('premium_pro_monthly').rank.legendStatus).toBe(false);
    expect(getPlanEntitlements('premium_pro_monthly').tournaments.elite).toBe(false);
    expect(getPlanEntitlements('legenda_plus_monthly').rank.legendStatus).toBe(true);
    expect(getPlanEntitlements('legenda_plus_monthly').tournaments.elite).toBe(true);
  });
});
