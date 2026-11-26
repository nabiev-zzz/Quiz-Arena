import { Platform } from 'react-native';
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
export const getCommunityClips = () => request<CommunityPost[]>('/api/community/clips?limit=40');
export const createCommunityClip = (content: string, mediaKey: string, mediaType: string) =>
  request<CommunityPost>('/api/community/clips', 'POST', { content, mediaKey, mediaType });
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

function putBlobWithProgress(url: string, blob: Blob, headers: Record<string, string>, onProgress?: (percent: number) => void) {
  return new Promise<{ status: number; responseText: string }>((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open('PUT', url);
    Object.entries(headers).forEach(([name, value]) => xhr.setRequestHeader(name, value));
    xhr.timeout = 180_000;
    xhr.upload.onprogress = (event) => {
      if (event.lengthComputable && event.total > 0) onProgress?.(Math.min(98, 3 + Math.round((event.loaded / event.total) * 95)));
    };
    xhr.onload = () => resolve({ status: xhr.status, responseText: xhr.responseText || '' });
    xhr.onerror = () => reject(new Error('Internet aloqasi uzildi. Yuklashni qayta urinib ko‘ring.'));
    xhr.ontimeout = () => reject(new Error('Yuklash vaqti tugadi. Internetni tekshirib, qayta urinib ko‘ring.'));
    xhr.onabort = () => reject(new Error('Yuklash bekor qilindi.'));
    xhr.send(blob);
  });
}

export async function uploadCommunityMedia(uri: string, contentType: string, onProgress?: (percent: number) => void) {
  const token = await getToken();
  if (!token) throw new Error('Kirish talab qilinadi');
  const key = await request<{ fileName: string; mediaType: string; mediaKey: string; uploadUrl: string }>('/api/community/media/upload-key', 'POST', { contentType });
  onProgress?.(1);
  const local = await fetch(uri);
  if (!local.ok) throw new Error('Tanlangan video faylini o‘qib bo‘lmadi');
  const blob = await local.blob();
  const isVideo = contentType.startsWith('video/');
  const maxBytes = isVideo ? 30 * 1024 * 1024 : 8 * 1024 * 1024;
  if (!blob.size || blob.size > maxBytes) throw new Error(isVideo ? 'Video hajmi 30 MB dan oshmasin' : 'Rasm hajmi 8 MB dan oshmasin');
  onProgress?.(3);

  const mediaHeaders = { 'Content-Type': contentType, 'Cache-Control': 'public, max-age=31536000, immutable' };
  if (Platform.OS !== 'web' && key.uploadUrl && key.mediaKey) {
    try {
      const direct = await putBlobWithProgress(key.uploadUrl, blob, mediaHeaders, onProgress);
      if (direct.status >= 200 && direct.status < 300) {
        onProgress?.(100);
        return { mediaKey: key.mediaKey, mediaType: key.mediaType };
      }
    } catch {
      // Fall back to the authenticated API proxy if the storage endpoint rejects direct mobile upload.
    }
  }

  const proxy = await putBlobWithProgress(
    `${API_BASE_URL}/api/community/media/upload/${encodeURIComponent(key.fileName)}`,
    blob,
    { ...mediaHeaders, Authorization: `Bearer ${token}` },
    onProgress,
  );
  let data: Record<string, unknown> = {};
  try { data = JSON.parse(proxy.responseText || '{}') as Record<string, unknown>; } catch { /* handled below */ }
  if (proxy.status < 200 || proxy.status >= 300) {
    throw new Error(typeof data.message === 'string' ? data.message : 'Media faylni yuklab bo‘lmadi');
  }
  if (typeof data.mediaKey !== 'string' || typeof data.mediaType !== 'string') {
    throw new Error('Server yuklangan faylni tasdiqlamadi. Qayta urinib ko‘ring.');
  }
  onProgress?.(100);
  return { mediaKey: data.mediaKey, mediaType: data.mediaType };
}
