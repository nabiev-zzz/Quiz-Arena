import { API_BASE_URL, getToken } from './authService';

export type SubscriptionTier = 'free' | 'premium' | 'premium_pro' | 'legenda_plus';

export interface PremiumEntitlements {
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

export interface PremiumPlan {
  key: string;
  name: string;
  durationDays: number;
  price: number | null;
  currency: 'UZS';
  available: boolean;
}
export interface PremiumStatus {
  isPremium: boolean;
  isOwner?: boolean;
  tier: SubscriptionTier;
  entitlements: PremiumEntitlements;
  subscription: null | {
    planKey: string;
    provider: 'google_play' | 'click' | 'payme' | 'owner' | 'admin_grant';
    status: string;
    startsAt: string | null;
    expiresAt: string | null;
    autoRenew: boolean;
  };
}
export interface CheckoutResult {
  paymentId: string;
  provider: 'click' | 'payme';
  planKey: string;
  amount: number;
  currency: 'UZS';
  checkoutUrl: string | null;
}
async function request<T>(path: string, options: RequestInit = {}): Promise<T> {
  const token = await getToken();
  const response = await fetch(`${API_BASE_URL}${path}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...options.headers,
    },
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(typeof data.message === 'string' ? data.message : 'Server bilan aloqa xatosi');
  return data as T;
}
export const getPremiumPlans = () => request<PremiumPlan[]>('/api/subscriptions/plans');
export const getPremiumStatus = () => request<PremiumStatus>('/api/subscriptions/me');
export const createPremiumCheckout = (provider: 'click' | 'payme', planKey: string) =>
  request<CheckoutResult>('/api/subscriptions/checkout', {
    method: 'POST',
    body: JSON.stringify({ provider, planKey }),
  });
export const getGooglePlayAccountId = async () =>
  (await request<{ obfuscatedAccountId: string }>('/api/subscriptions/google-play/account-id')).obfuscatedAccountId;
export const verifyGooglePlayPurchase = (purchaseToken: string) =>
  request<{ isPremium: boolean; expiresAt: string; provider: 'google_play' }>('/api/subscriptions/google-play/verify', {
    method: 'POST',
    body: JSON.stringify({ purchaseToken }),
  });

export type MeteredFeature = 'statsPdf' | 'documentQuiz' | 'privateBattle' | 'smartPractice' | 'aiTutor';

export interface FeatureUsageResult {
  allowed: boolean;
  featureKey: MeteredFeature;
  tier: SubscriptionTier;
  period: 'daily' | 'monthly' | 'unlimited';
  limit: number | null;
  used: number | null;
  remaining: number | null;
}

export const consumePremiumFeature = (featureKey: MeteredFeature) =>
  request<FeatureUsageResult>(`/api/subscriptions/usage/${featureKey}`, { method: 'POST' });


export interface QaTesterGrantResult {
  username: string;
  role: 'user';
  zcBalance: number;
  tier: 'legenda_plus';
  planKey: string;
  status: string;
  expiresAt: string;
}

export const grantQaTester = () =>
  request<QaTesterGrantResult>('/api/subscriptions/admin/qa-tester/grant', { method: 'POST' });

export interface AdminTargetUser { id: string; username: string; displayName: string; role: string; zcBalance: number }
export const searchAdminUsers = (query: string) => request<AdminTargetUser[]>(`/api/subscriptions/admin/users?q=${encodeURIComponent(query)}`);
export const adminGrantAccount = (input: { username: string; zcAmount: number; planKey: 'none' | 'premium' | 'premium_pro' | 'legenda_plus'; durationDays: number }) =>
  request<{ username: string; zcBalance: number; zcGranted: number; planKey: string; expiresAt: string | null }>('/api/subscriptions/admin/grant', { method: 'POST', body: JSON.stringify(input) });
export const adminRevokeAccount = (input: { username: string; zcAmount: number; premium: boolean }) =>
  request<{ username: string; zcBalance: number; zcRemoved: number; premiumRevoked: boolean }>('/api/subscriptions/admin/revoke', { method: 'POST', body: JSON.stringify(input) });
