export type SubscriptionTier = 'free' | 'premium' | 'premium_pro' | 'legenda_plus';

export interface PlanEntitlements {
  tier: SubscriptionTier;
  label: string;
  statsPdf: { monthlyLimit: number | null; includeAiInsights: boolean };
  documentQuiz: { monthlyLimit: number | null; maxQuestionsPerDocument: number; maxFileSizeMb: number };
  privateBattle: { dailyLimit: number | null; maxPlayers: number };
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
    documentQuiz: { monthlyLimit: 5, maxQuestionsPerDocument: 100, maxFileSizeMb: 20 },
    privateBattle: { dailyLimit: null, maxPlayers: 2 },
    smartPractice: { dailyLimit: null, aiPersonalized: true },
    aiTutor: { available: true, dailyMessages: null, errorAnalysis: true, fullHistory: true },
    cosmetics: { premiumBadge: true, exclusiveItems: true, rareItems: true, animatedGoldFrame: true },
    tournaments: { special: true, elite: true }, rank: { legendStatus: true },
  },
  premium: {
    tier: 'premium', label: 'PREMIUM',
    statsPdf: { monthlyLimit: null, includeAiInsights: true },
    documentQuiz: { monthlyLimit: 20, maxQuestionsPerDocument: 100, maxFileSizeMb: 20 },
    privateBattle: { dailyLimit: null, maxPlayers: 2 },
    smartPractice: { dailyLimit: null, aiPersonalized: true },
    aiTutor: { available: true, dailyMessages: null, errorAnalysis: true, fullHistory: true },
    cosmetics: { premiumBadge: true, exclusiveItems: true, rareItems: true, animatedGoldFrame: true },
    tournaments: { special: true, elite: true }, rank: { legendStatus: true },
  },
  premium_pro: {
    tier: 'premium_pro', label: 'PREMIUM PRO',
    statsPdf: { monthlyLimit: null, includeAiInsights: true },
    documentQuiz: { monthlyLimit: 40, maxQuestionsPerDocument: 100, maxFileSizeMb: 20 },
    privateBattle: { dailyLimit: null, maxPlayers: 2 },
    smartPractice: { dailyLimit: null, aiPersonalized: true },
    aiTutor: { available: true, dailyMessages: null, errorAnalysis: true, fullHistory: true },
    cosmetics: { premiumBadge: true, exclusiveItems: true, rareItems: true, animatedGoldFrame: true },
    tournaments: { special: true, elite: true }, rank: { legendStatus: true },
  },
  legenda_plus: {
    tier: 'legenda_plus', label: 'LEGENDA+',
    statsPdf: { monthlyLimit: null, includeAiInsights: true },
    documentQuiz: { monthlyLimit: null, maxQuestionsPerDocument: 100, maxFileSizeMb: 20 },
    privateBattle: { dailyLimit: null, maxPlayers: 2 },
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
