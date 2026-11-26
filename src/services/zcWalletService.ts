import { API_BASE_URL, getToken } from './authService';

export interface ZcTransactionItem {
  id: string;
  type: 'credit' | 'debit';
  amount: number;
  balanceAfter: number;
  reason: string;
  createdAt: string;
}

export interface ZcHistoryResponse {
  items: ZcTransactionItem[];
  total: number;
  limit: number;
  offset: number;
}

export async function getZcHistory(limit = 10): Promise<ZcHistoryResponse> {
  const token = await getToken();
  if (!token) throw new Error('Avval hisobingizga kiring');
  const response = await fetch(
    `${API_BASE_URL}/api/wallet/zc/history?limit=${Math.min(Math.max(limit, 1), 100)}`,
    { headers: { Authorization: `Bearer ${token}` } },
  );
  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(typeof data.message === 'string' ? data.message : 'ZC tarixini yuklab bo‘lmadi');
  }
  return data as ZcHistoryResponse;
}
