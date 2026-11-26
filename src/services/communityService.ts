import { API_BASE_URL, getToken } from './authService';

export interface CommunityPerson {
  id: string;
  displayName: string;
  username: string;
  avatarUrl: string | null;
  profileFrame?: string | null;
  profileBadge?: string | null;
}

export interface CommunityPost {
  id: string;
  content: string;
  createdAt: string;
  author: CommunityPerson;
  likesCount: number;
  commentsCount: number;
  isLiked: boolean;
  isOwn: boolean;
}

export interface CommunityComment {
  id: string;
  content: string;
  createdAt: string;
  author: CommunityPerson;
}

async function request<T>(path: string, method = 'GET', body?: unknown): Promise<T> {
  const token = await getToken();
  if (!token) throw new Error('Kirish talab qilinadi');
  const response = await fetch(`${API_BASE_URL}${path}`, {
    method,
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(typeof data.message === 'string' ? data.message : 'Hamjamiyat serverida xatolik');
  return data as T;
}

export const getCommunityFeed = () => request<CommunityPost[]>('/api/community/posts?limit=40');
export const createCommunityPost = (content: string) => request<CommunityPost>('/api/community/posts', 'POST', { content });
export const likeCommunityPost = (id: string) => request<{ isLiked: boolean; likesCount: number }>(`/api/community/posts/${encodeURIComponent(id)}/like`, 'POST');
export const unlikeCommunityPost = (id: string) => request<{ isLiked: boolean; likesCount: number }>(`/api/community/posts/${encodeURIComponent(id)}/unlike`, 'POST');
export const getCommunityComments = (id: string) => request<CommunityComment[]>(`/api/community/posts/${encodeURIComponent(id)}/comments`);
export const addCommunityComment = (id: string, content: string) => request<CommunityComment>(`/api/community/posts/${encodeURIComponent(id)}/comments`, 'POST', { content });
