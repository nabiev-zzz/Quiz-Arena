import { io, Socket } from 'socket.io-client';
import { API_BASE_URL, apiFetch, getToken } from './authService';

export interface DirectPerson {
  id: string; displayName: string; username: string; avatarUrl: string | null;
  profileFrame?: string | null; profileBadge?: string | null;
}
export interface DirectConversation {
  id: string; otherUser: DirectPerson;
  lastMessage: { content: string; senderId: string; createdAt: string; mediaType?: string | null; isDeleted?: boolean; editedAt?: string | null } | null;
  lastMessageAt: string; unreadCount: number;
}
export interface DirectMessage {
  id: string; conversationId: string; content: string; createdAt: string;
  readAt: string | null; senderId: string; isMine: boolean; sender: DirectPerson | null;
  mediaType?: string | null; durationSeconds?: number | null;
  isEdited?: boolean; editedAt?: string | null; isDeleted?: boolean; deletedAt?: string | null; deletedForMe?: boolean;
}
async function request<T>(path: string, method = 'GET', body?: unknown): Promise<T> {
  const token = await getToken();
  if (!token) throw new Error('Kirish talab qilinadi');
  const response = await apiFetch(`${API_BASE_URL}${path}`, {
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
export const sendDirectMessage = (conversationId: string, content: string, clientMessageId?: string) =>
  request<DirectMessage>(`/api/direct/conversations/${encodeURIComponent(conversationId)}/messages`, 'POST', { content, ...(clientMessageId ? { clientMessageId } : {}) });
export const sendDirectVoiceMessage = (conversationId: string, attachment: { mediaKey: string; mediaType: string; mediaSize: number; durationSeconds: number }, clientMessageId?: string) =>
  request<DirectMessage>(`/api/direct/conversations/${encodeURIComponent(conversationId)}/messages`, 'POST', { content: '', ...attachment, ...(clientMessageId ? { clientMessageId } : {}) });
export const sendDirectAttachmentMessage = (conversationId: string, content: string, attachment: { mediaKey: string; mediaType: string; mediaSize: number }, clientMessageId?: string) =>
  request<DirectMessage>(`/api/direct/conversations/${encodeURIComponent(conversationId)}/messages`, 'POST', { content, ...attachment, ...(clientMessageId ? { clientMessageId } : {}) });
export const editDirectMessage = (conversationId: string, messageId: string, content: string) =>
  request<DirectMessage>(`/api/direct/conversations/${encodeURIComponent(conversationId)}/messages/${encodeURIComponent(messageId)}`, 'PATCH', { content });
export const deleteDirectMessage = (conversationId: string, messageId: string, scope: 'me' | 'everyone') =>
  request<DirectMessage>(`/api/direct/conversations/${encodeURIComponent(conversationId)}/messages/${encodeURIComponent(messageId)}?scope=${scope}`, 'DELETE');
export const getDirectMessageHistory = (conversationId: string, messageId: string) =>
  request<{ messageId: string; entries: Array<{ action: string; content: string; at: string }> }>(`/api/direct/conversations/${encodeURIComponent(conversationId)}/messages/${encodeURIComponent(messageId)}/history`);
export const getDirectAttachmentUrl = (conversationId: string, messageId: string) =>
  request<{ url: string; mediaType: string }>(`/api/direct/conversations/${encodeURIComponent(conversationId)}/messages/${encodeURIComponent(messageId)}/attachment`);
export const markDirectRead = (conversationId: string) =>
  request<{ updated: number }>(`/api/direct/conversations/${encodeURIComponent(conversationId)}/read`, 'POST');
export async function createDirectSocket(): Promise<Socket> {
  const token = await getToken();
  if (!token) throw new Error('Kirish talab qilinadi');
  return io(`${API_BASE_URL}/direct`, { transports: ['polling', 'websocket'], auth: { token }, reconnection: true, reconnectionAttempts: Infinity, reconnectionDelay: 1000, reconnectionDelayMax: 10000, timeout: 15000 });
}
