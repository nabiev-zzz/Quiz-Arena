import { io, Socket } from 'socket.io-client';
import { API_BASE_URL, getToken } from './authService';

export interface DirectPerson {
  id: string; displayName: string; username: string; avatarUrl: string | null;
  profileFrame?: string | null; profileBadge?: string | null;
}
export interface DirectConversation {
  id: string; otherUser: DirectPerson;
  lastMessage: { content: string; senderId: string; createdAt: string } | null;
  lastMessageAt: string; unreadCount: number;
}
export interface DirectMessage {
  id: string; conversationId: string; content: string; createdAt: string;
  readAt: string | null; senderId: string; isMine: boolean; sender: DirectPerson | null;
}
async function request<T>(path: string, method = 'GET', body?: unknown): Promise<T> {
  const token = await getToken();
  if (!token) throw new Error('Kirish talab qilinadi');
  const response = await fetch(`${API_BASE_URL}${path}`, {
    method, headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(typeof data.message === 'string' ? data.message : 'Xabarlar serverida xatolik');
  return data as T;
}
export const getDirectConversations = () => request<DirectConversation[]>('/api/direct/conversations');
export const startDirectConversation = (userId: string) => request<DirectConversation>(`/api/direct/conversations/${encodeURIComponent(userId)}`, 'POST');
export const getDirectMessages = (conversationId: string) => request<DirectMessage[]>(`/api/direct/conversations/${encodeURIComponent(conversationId)}/messages`);
export const sendDirectMessage = (conversationId: string, content: string) =>
  request<DirectMessage>(`/api/direct/conversations/${encodeURIComponent(conversationId)}/messages`, 'POST', { content });
export const markDirectRead = (conversationId: string) =>
  request<{ updated: number }>(`/api/direct/conversations/${encodeURIComponent(conversationId)}/read`, 'POST');
export async function createDirectSocket(): Promise<Socket> {
  const token = await getToken();
  if (!token) throw new Error('Kirish talab qilinadi');
  return io(`${API_BASE_URL}/direct`, { transports: ['polling', 'websocket'], auth: { token }, reconnection: true, reconnectionAttempts: 10, reconnectionDelay: 1000, timeout: 15000 });
}
