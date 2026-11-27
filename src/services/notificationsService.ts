import { API_BASE_URL, apiFetch, getToken } from './authService';
export interface AppNotification { id: string; type: string; title: string; body: string; isRead: boolean; createdAt: string }
export interface NotificationsResponse { items: AppNotification[]; unread: number }
async function request<T>(path: string, method = 'GET'): Promise<T> {
  const token = await getToken();
  if (!token) throw new Error('Avval hisobingizga kiring');
  const response = await apiFetch(`${API_BASE_URL}${path}`, { method, headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' } });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(typeof data.message === 'string' ? data.message : 'Bildirishnomalarni yuklab bo‘lmadi');
  return data as T;
}
export const getNotifications = () => request<NotificationsResponse>('/api/notifications');
export const markNotificationRead = (id: string) => request<NotificationsResponse>(`/api/notifications/${encodeURIComponent(id)}/read`, 'PATCH');
export const markAllNotificationsRead = () => request<NotificationsResponse>('/api/notifications/read-all', 'PATCH');
