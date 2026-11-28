export type SubscriptionTier = 'free' | 'premium' | 'premium_pro' | 'legenda_plus';

export interface PlanEntitlements {
  tier: SubscriptionTier;
  label: string;
  statsPdf: { monthlyLimit: number | null; includeAiInsights: boolean };
  documentQuiz: { monthlyLimit: number; maxQuestionsPerDocument: number; maxFileSizeMb: number };
  privateBattle: { dailyLimit: number; maxPlayers: number };
  smartPractice: { dailyLimit: number | null; aiPersonalized: boolean };
  aiTutor: { available: boolean; dailyMessages: number | null; errorAnalysis: boolean; fullHistory: boolean };
  cosmetics: { premiumBadge: boolean; exclusiveItems: boolean; rareItems: boolean; animatedGoldFrame: boolean };
  tournaments: { special: boolean; elite: boolean };
  rank: { legendStatus: boolean };
}

const PLAN_ENTITLEMENTS: Record<SubscriptionTier, PlanEntitlements> = {
  free: {
    tier: 'free', label: 'FREE',
    statsPdf: { monthlyLimit: null, includeAiInsights: true },
    documentQuiz: { monthlyLimit: null, maxQuestionsPerDocument: 100, maxFileSizeMb: 20 },
    privateBattle: { dailyLimit: null, maxPlayers: 2 },
    smartPractice: { dailyLimit: null, aiPersonalized: true },
    aiTutor: { available: true, dailyMessages: null, errorAnalysis: true, fullHistory: true },
    cosmetics: { premiumBadge: true, exclusiveItems: true, rareItems: true, animatedGoldFrame: true },
    tournaments: { special: true, elite: true }, rank: { legendStatus: true },
  },
  premium: {
    tier: 'premium', label: 'PREMIUM',
    statsPdf: { monthlyLimit: 10, includeAiInsights: false },
    documentQuiz: { monthlyLimit: 5, maxQuestionsPerDocument: 25, maxFileSizeMb: 8 },
    privateBattle: { dailyLimit: 10, maxPlayers: 2 },
    smartPractice: { dailyLimit: 3, aiPersonalized: false },
    aiTutor: { available: true, dailyMessages: 10, errorAnalysis: false, fullHistory: false },
    cosmetics: { premiumBadge: true, exclusiveItems: true, rareItems: false, animatedGoldFrame: false },
    tournaments: { special: false, elite: false }, rank: { legendStatus: false },
  },
  premium_pro: {
    tier: 'premium_pro', label: 'PREMIUM PRO',
    statsPdf: { monthlyLimit: null, includeAiInsights: false },
    documentQuiz: { monthlyLimit: 30, maxQuestionsPerDocument: 50, maxFileSizeMb: 12 },
    privateBattle: { dailyLimit: 20, maxPlayers: 2 },
    smartPractice: { dailyLimit: null, aiPersonalized: true },
    aiTutor: { available: true, dailyMessages: 100, errorAnalysis: true, fullHistory: true },
    cosmetics: { premiumBadge: true, exclusiveItems: true, rareItems: false, animatedGoldFrame: false },
    tournaments: { special: true, elite: false }, rank: { legendStatus: false },
  },
  legenda_plus: {
    tier: 'legenda_plus', label: 'LEGENDA+',
    statsPdf: { monthlyLimit: null, includeAiInsights: false },
    documentQuiz: { monthlyLimit: 100, maxQuestionsPerDocument: 100, maxFileSizeMb: 15 },
    privateBattle: { dailyLimit: 30, maxPlayers: 2 },
    smartPractice: { dailyLimit: null, aiPersonalized: true },
    aiTutor: { available: true, dailyMessages: null, errorAnalysis: true, fullHistory: true },
    cosmetics: { premiumBadge: true, exclusiveItems: true, rareItems: true, animatedGoldFrame: true },
    tournaments: { special: true, elite: true }, rank: { legendStatus: true },
  },
};

const VALID_PLAN_KEYS: Record<string, SubscriptionTier> = {
  premium_monthly: 'premium',
  premium_yearly: 'premium',
  premium_pro_monthly: 'premium_pro',
  premium_pro_yearly: 'premium_pro',
  legenda_plus_monthly: 'legenda_plus',
  legenda_plus_yearly: 'legenda_plus',
};

export function resolveSubscriptionTier(planKey?: string | null): SubscriptionTier {
  if (!planKey) return 'free';
  return VALID_PLAN_KEYS[planKey] ?? 'free';
}

export function getPlanEntitlements(planKey?: string | null): PlanEntitlements {
  return PLAN_ENTITLEMENTS[resolveSubscriptionTier(planKey)];
}
