import { API_BASE_URL, getToken } from './authService';

export interface ZcStoreProduct {
  id: string;
  name: string;
  description: string;
  kind: 'frame' | 'decoration' | 'badge';
  value: string;
  price: number;
  owned: boolean;
}

export interface ZcStoreCatalog {
  currency: 'ZC';
  items: ZcStoreProduct[];
}

async function storeRequest<T>(path: string, method = 'GET', body?: unknown): Promise<T> {
  const token = await getToken();
  if (!token) throw new Error('Avval hisobingizga kiring');
  const response = await fetch(`${API_BASE_URL}${path}`, {
    method,
    headers: {
      Authorization: `Bearer ${token}`,
      ...(body ? { 'Content-Type': 'application/json' } : {}),
    },
    ...(body ? { body: JSON.stringify(body) } : {}),
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(typeof data.message === 'string' ? data.message : 'ZC do‘koni bilan aloqa xatosi');
  }
  return data as T;
}

export function getZcStoreCatalog(): Promise<ZcStoreCatalog> {
  return storeRequest<ZcStoreCatalog>('/api/store/zc/catalog');
}

export function purchaseZcStoreItem(itemId: string): Promise<{
  purchased: boolean;
  alreadyOwned: boolean;
  balance: number;
  equipped?: boolean;
  item: ZcStoreProduct;
}> {
  return storeRequest('/api/store/zc/purchase', 'POST', { itemId });
}
