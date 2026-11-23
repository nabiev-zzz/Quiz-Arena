
import * as SecureStore from 'expo-secure-store';
import { API_BASE_URL } from '../config/api';

export { API_BASE_URL };

const TOKEN_KEY = 'quiz_arena_access_token';

export interface AuthUser {
  id: string;
  displayName: string;
  username: string;
  email: string | null;
  role: 'user' | 'admin';
  status: 'active' | 'blocked';
  xp: number;
  level: number;
  rankPoints?: number;
  rankTier?: string;
  avatarUrl: string | null;
  bio: string | null;
  profileFrame: string | null;
  avatarDecoration: string | null;
  createdAt?: string;
}

export interface AuthResponse {
  accessToken: string;
  user: AuthUser;
}

export interface UpdateProfileInput {
  displayName?: string;
  username?: string;
  bio?: string | null;
}

async function request<T>(
  endpoint: string,
  options: RequestInit = {},
): Promise<T> {
  const response = await fetch(`${API_BASE_URL}${endpoint}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...options.headers,
    },
  });

  const data = await response.json().catch(() => ({}));

  if (!response.ok) {
    throw new Error(
      typeof data.message === 'string'
        ? data.message
        : 'Server bilan aloqa qilishda xatolik',
    );
  }

  return data as T;
}

export async function registerUser(input: {
  displayName: string;
  username: string;
  email?: string;
  password: string;
}): Promise<AuthResponse> {
  const result = await request<AuthResponse>('/api/auth/register', {
    method: 'POST',
    body: JSON.stringify(input),
  });

  await saveToken(result.accessToken);
  return result;
}

export async function loginUser(input: {
  username: string;
  password: string;
}): Promise<AuthResponse> {
  const result = await request<AuthResponse>('/api/auth/login', {
    method: 'POST',
    body: JSON.stringify(input),
  });

  await saveToken(result.accessToken);
  return result;
}

export async function getCurrentUser(): Promise<AuthUser> {
  const token = await getToken();

  if (!token) {
    throw new Error('Kirish tokeni topilmadi');
  }

  return request<AuthUser>('/api/auth/me', {
    method: 'GET',
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });
}

export async function updateCurrentUser(
  input: UpdateProfileInput,
): Promise<AuthUser> {
  const token = await getToken();

  if (!token) {
    throw new Error('Kirish tokeni topilmadi');
  }

  return request<AuthUser>('/api/auth/profile', {
    method: 'PATCH',
    headers: {
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify(input),
  });
}

export async function saveToken(token: string): Promise<void> {
  await SecureStore.setItemAsync(TOKEN_KEY, token);
}

export async function getToken(): Promise<string | null> {
  return SecureStore.getItemAsync(TOKEN_KEY);
}

export async function removeToken(): Promise<void> {
  await SecureStore.deleteItemAsync(TOKEN_KEY);
}
