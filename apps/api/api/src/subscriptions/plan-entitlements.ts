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
    statsPdf: { monthlyLimit: 1, includeAiInsights: false },
    documentQuiz: { monthlyLimit: 1, maxQuestionsPerDocument: 10, maxFileSizeMb: 5 },
    privateBattle: { dailyLimit: 3, maxPlayers: 2 },
    smartPractice: { dailyLimit: 1, aiPersonalized: false },
    aiTutor: { available: false, dailyMessages: 0, errorAnalysis: false, fullHistory: false },
    cosmetics: { premiumBadge: false, exclusiveItems: false, rareItems: false, animatedGoldFrame: false },
    tournaments: { special: false, elite: false }, rank: { legendStatus: false },
  },
  premium: {
    tier: 'premium', label: 'PREMIUM',
    statsPdf: { monthlyLimit: 10, includeAiInsights: false },
    documentQuiz: { monthlyLimit: 5, maxQuestionsPerDocument: 25, maxFileSizeMb: 8 },
    privateBattle: { dailyLimit: 10, maxPlayers: 2 },
    smartPractice: { dailyLimit: 3, aiPersonalized: false },
    aiTutor: { available: false, dailyMessages: 0, errorAnalysis: false, fullHistory: false },
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

export function resolveSubscriptionTier(planKey?: string | null): SubscriptionTier {
  if (!planKey) return 'free';
  if (planKey.startsWith('legenda_plus_')) return 'legenda_plus';
  if (planKey.startsWith('premium_pro_')) return 'premium_pro';
  if (planKey.startsWith('premium_')) return 'premium';
  return 'free';
}

export function getPlanEntitlements(planKey?: string | null): PlanEntitlements {
  return PLAN_ENTITLEMENTS[resolveSubscriptionTier(planKey)];
}
