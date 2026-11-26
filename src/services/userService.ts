import { API_BASE_URL, getToken, type AuthUser } from './authService';

export interface PublicUser extends Pick<AuthUser,
  'id' | 'displayName' | 'username' | 'avatarUrl' | 'bio' | 'xp' |
  'level' | 'rankPoints' | 'rankTier' | 'profileFrame' | 'avatarDecoration' | 'profileBadge' | 'createdAt'> {
  followersCount: number;
  followingCount?: number;
  isFollowing?: boolean;
  isFriend?: boolean;
  isSelf?: boolean;
}

export type UserSuggestion = Omit<PublicUser, 'followingCount' | 'isFriend' | 'isSelf'>;

async function userRequest<T>(path: string, method = 'GET'): Promise<T> {
  const token = await getToken();
  if (!token) throw new Error('Kirish talab qilinadi');
  const response = await fetch(`${API_BASE_URL}${path}`, {
    method,
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(typeof data.message === 'string' ? data.message : 'Server bilan aloqa xatosi');
  }
  return data as T;
}

export function getUserSuggestions(): Promise<UserSuggestion[]> {
  return userRequest<UserSuggestion[]>('/api/users/suggestions?limit=16');
}

export function getPublicUserProfile(username: string): Promise<PublicUser> {
  return userRequest<PublicUser>(`/api/users/profile/${encodeURIComponent(username)}`);
}

export function getUserFollowers(id: string): Promise<PublicUser[]> {
  return userRequest<PublicUser[]>(`/api/users/${encodeURIComponent(id)}/followers`);
}

export function getUserFollowing(id: string): Promise<PublicUser[]> {
  return userRequest<PublicUser[]>(`/api/users/${encodeURIComponent(id)}/following`);
}

export function followUser(id: string): Promise<{ following: boolean; followersCount: number }> {
  return userRequest(`/api/users/${encodeURIComponent(id)}/follow`, 'POST');
}

export function unfollowUser(id: string): Promise<{ following: boolean; followersCount: number }> {
  return userRequest(`/api/users/${encodeURIComponent(id)}/follow`, 'DELETE');
}
