import * as SecureStore from 'expo-secure-store';
import { API_BASE_URL } from '../config/api';

export { API_BASE_URL };

const TOKEN_KEY = 'quiz_arena_access_token';

export interface AuthUser {
  id: string;
  displayName: string;
  username: string;
  email: string | null;
  phoneNumber?: string | null;
  phoneVerified?: boolean;
  emailVerified?: boolean;
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
  avatarUrl?: string | null;
  avatarDecoration?: string | null;
  profileFrame?: string | null;
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

async function persistAuth(result: AuthResponse): Promise<AuthResponse> {
  await saveToken(result.accessToken);
  return result;
}

export async function registerUser(input: {
  displayName: string;
  username: string;
  email?: string;
  password: string;
}): Promise<AuthResponse> {
  return persistAuth(await request<AuthResponse>('/api/auth/register', {
    method: 'POST',
    body: JSON.stringify(input),
  }));
}

export async function requestEmailVerification(email: string): Promise<{ message: string }> {
  return request('/api/auth/email/verification/request', {
    method: 'POST',
    body: JSON.stringify({ email }),
  });
}

export async function verifyEmailUser(email: string, code: string): Promise<AuthResponse> {
  return persistAuth(await request<AuthResponse>('/api/auth/email/verify', {
    method: 'POST',
    body: JSON.stringify({ email, code }),
  }));
}

export async function requestEmailPasswordReset(email: string): Promise<{ message: string }> {
  return request('/api/auth/email/password-reset/request', {
    method: 'POST',
    body: JSON.stringify({ email }),
  });
}

export async function resetPasswordWithEmail(input: {
  email: string;
  code: string;
  newPassword: string;
}): Promise<{ message: string }> {
  return request('/api/auth/email/password-reset', {
    method: 'POST',
    body: JSON.stringify(input),
  });
}

export async function loginUser(input: {
  username: string;
  password: string;
}): Promise<AuthResponse> {
  return persistAuth(await request<AuthResponse>('/api/auth/login', {
    method: 'POST',
    body: JSON.stringify(input),
  }));
}

export async function requestPhoneOtp(
  phoneNumber: string,
  purpose: 'register' | 'password-reset' | 'phone-login',
): Promise<{ message: string }> {
  const endpoint = purpose === 'register'
    ? '/api/auth/phone/register/request-otp'
    : purpose === 'password-reset'
      ? '/api/auth/phone/password-reset/request-otp'
      : '/api/auth/phone/login/request-otp';
  return request(endpoint, {
    method: 'POST',
    body: JSON.stringify({ phoneNumber }),
  });
}

export async function registerWithPhoneUser(input: {
  phoneNumber: string;
  code: string;
  displayName: string;
  username: string;
  email?: string;
  password: string;
}): Promise<AuthResponse> {
  return persistAuth(await request<AuthResponse>('/api/auth/phone/register', {
    method: 'POST',
    body: JSON.stringify(input),
  }));
}

export async function loginWithPhoneUser(input: {
  phoneNumber: string;
  code: string;
}): Promise<AuthResponse> {
  return persistAuth(await request<AuthResponse>('/api/auth/phone/login', {
    method: 'POST',
    body: JSON.stringify(input),
  }));
}

export async function resetPasswordWithPhone(input: {
  phoneNumber: string;
  code: string;
  newPassword: string;
}): Promise<{ message: string }> {
  return request('/api/auth/phone/password-reset', {
    method: 'POST',
    body: JSON.stringify(input),
  });
}

export async function exchangeTelegramCode(code: string): Promise<AuthResponse> {
  return persistAuth(await request<AuthResponse>('/api/auth/telegram/exchange', {
    method: 'POST',
    body: JSON.stringify({ code }),
  }));
}

export async function exchangeGoogleCode(code: string): Promise<AuthResponse> {
  return persistAuth(await request<AuthResponse>('/api/auth/google/exchange', {
    method: 'POST',
    body: JSON.stringify({ code }),
  }));
}


export async function requestPhoneLinkOtp(phoneNumber: string): Promise<{ message: string }> {
  const token = await getToken();
  if (!token) throw new Error('Avval hisobingizga kiring');
  return request('/api/auth/phone/link/request-otp', {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}` },
    body: JSON.stringify({ phoneNumber }),
  });
}

export async function linkPhoneNumber(input: {
  phoneNumber: string;
  code: string;
}): Promise<AuthUser> {
  const token = await getToken();
  if (!token) throw new Error('Avval hisobingizga kiring');
  return request<AuthUser>('/api/auth/phone/link', {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}` },
    body: JSON.stringify(input),
  });
}

export async function getCurrentUser(): Promise<AuthUser> {
  const token = await getToken();
  if (!token) throw new Error('Kirish tokeni topilmadi');
  return request<AuthUser>('/api/auth/me', {
    method: 'GET',
    headers: { Authorization: `Bearer ${token}` },
  });
}

export async function updateCurrentUser(
  input: UpdateProfileInput,
): Promise<AuthUser> {
  const token = await getToken();
  if (!token) throw new Error('Kirish tokeni topilmadi');
  return request<AuthUser>('/api/auth/profile', {
    method: 'PATCH',
    headers: { Authorization: `Bearer ${token}` },
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
