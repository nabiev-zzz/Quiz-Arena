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
  mediaUrl?: string | null;
  mediaType?: string | null;
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

export interface CommunityStory {
  id: string;
  mediaUrl: string;
  mediaType: string;
  caption: string;
  createdAt: string;
  expiresAt: string;
  author: CommunityPerson;
  isOwn: boolean;
  viewed: boolean;
  viewsCount: number;
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
export const createCommunityPost = (content: string, mediaKey?: string, mediaType?: string) =>
  request<CommunityPost>('/api/community/posts', 'POST', { content, mediaKey, mediaType });
export const likeCommunityPost = (id: string) => request<{ isLiked: boolean; likesCount: number }>(`/api/community/posts/${encodeURIComponent(id)}/like`, 'POST');
export const unlikeCommunityPost = (id: string) => request<{ isLiked: boolean; likesCount: number }>(`/api/community/posts/${encodeURIComponent(id)}/unlike`, 'POST');
export const getCommunityComments = (id: string) => request<CommunityComment[]>(`/api/community/posts/${encodeURIComponent(id)}/comments`);
export const addCommunityComment = (id: string, content: string) => request<CommunityComment>(`/api/community/posts/${encodeURIComponent(id)}/comments`, 'POST', { content });
export const getCommunityStories = () => request<CommunityStory[]>('/api/community/stories');
export const createCommunityStory = (mediaKey: string, mediaType: string, caption: string) =>
  request<CommunityStory>('/api/community/stories', 'POST', { mediaKey, mediaType, caption });
export const markCommunityStoryViewed = (id: string) =>
  request<{ viewed: boolean; viewsCount: number }>(`/api/community/stories/${encodeURIComponent(id)}/view`, 'POST');

export async function uploadCommunityMedia(uri: string, contentType: string) {
  const token = await getToken();
  if (!token) throw new Error('Kirish talab qilinadi');
  const key = await request<{ fileName: string; mediaType: string }>('/api/community/media/upload-key', 'POST', { contentType });
  const local = await fetch(uri);
  if (!local.ok) throw new Error('Tanlangan rasmni o‘qib bo‘lmadi');
  const blob = await local.blob();
  if (!blob.size || blob.size > 8 * 1024 * 1024) throw new Error('Rasm hajmi 8 MB dan oshmasin');
  const response = await fetch(`${API_BASE_URL}/api/community/media/upload/${encodeURIComponent(key.fileName)}`, {
    method: 'PUT',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': contentType },
    body: blob,
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(typeof data.message === 'string' ? data.message : 'Rasmni yuklab bo‘lmadi');
  return { mediaKey: data.mediaKey as string, mediaType: data.mediaType as string };
}
