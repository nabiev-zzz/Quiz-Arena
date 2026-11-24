import { API_BASE_URL, getToken } from './authService';

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
  subscription: null | {
    planKey: string;
    provider: 'google_play' | 'click' | 'payme';
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
