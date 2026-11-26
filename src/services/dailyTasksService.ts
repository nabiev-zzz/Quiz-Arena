import { API_BASE_URL, getToken } from './authService';

export interface DailyTask {
  id: string;
  title: string;
  description: string;
  target: number;
  reward: number;
  progress: number;
  completed: boolean;
  claimed: boolean;
  claimedAt: string | null;
}
export interface DailyTasksResponse {
  date: string;
  timezone: 'Asia/Tashkent';
  tasks: DailyTask[];
}
async function request<T>(path: string, method = 'GET', body?: unknown): Promise<T> {
  const token = await getToken();
  if (!token) throw new Error('Avval hisobingizga kiring');
  const response = await fetch(`${API_BASE_URL}${path}`, {
    method,
    headers: { Authorization: `Bearer ${token}`, ...(body ? { 'Content-Type': 'application/json' } : {}) },
    ...(body ? { body: JSON.stringify(body) } : {}),
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(typeof data.message === 'string' ? data.message : 'Kunlik vazifalar yuklanmadi');
  return data as T;
}
export function getDailyTasks(): Promise<DailyTasksResponse> {
  return request('/api/daily-tasks');
}
export function claimDailyTask(taskId: string): Promise<{ claimed: boolean; alreadyClaimed?: boolean; reward: number; balance: number }> {
  return request('/api/daily-tasks/claim', 'POST', { taskId });
}
