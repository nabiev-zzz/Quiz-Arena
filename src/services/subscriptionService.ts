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
async function request<T>(path: string): Promise<T> {
  const token = await getToken();
  const response = await fetch(`${API_BASE_URL}${path}`, {
    headers: token ? { Authorization: `Bearer ${token}` } : {},
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(typeof data.message === 'string' ? data.message : 'Server bilan aloqa xatosi');
  return data as T;
}
export const getPremiumPlans = () => request<PremiumPlan[]>('/api/subscriptions/plans');
export const getPremiumStatus = () => request<PremiumStatus>('/api/subscriptions/me');
