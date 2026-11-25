import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
} from 'react';
import { Alert, Linking, Platform } from 'react-native';

import {
  AuthUser,
  UpdateProfileInput,
  API_BASE_URL,
  exchangeGoogleCode,
  exchangeTelegramCode,
  getCurrentUser,
  getToken,
  loginUser,
  requestPhoneLinkOtp,
  linkPhoneNumber,
  removeToken,
  updateCurrentUser,
  registerUser,
  requestEmailVerification,
  verifyEmailUser,
  requestEmailPasswordReset,
  resetPasswordWithEmail,
} from '../services/authService';

interface AuthContextValue {
  user: AuthUser | null;
  loading: boolean;
  login: (username: string, password: string) => Promise<void>;
  register: (input: {
    displayName: string;
    username: string;
    email?: string;
    password: string;
  }) => Promise<void>;
  requestEmailVerification: (email: string) => Promise<void>;
  verifyEmail: (email: string, code: string) => Promise<void>;
  requestEmailPasswordReset: (email: string) => Promise<void>;
  resetEmailPassword: (email: string, code: string, newPassword: string) => Promise<void>;
  requestPhoneLink: (phoneNumber: string) => Promise<void>;
  linkPhone: (phoneNumber: string, code: string) => Promise<void>;
  startGoogleLogin: () => Promise<void>;
  startTelegramLogin: () => Promise<void>;
  updateProfile: (input: UpdateProfileInput) => Promise<void>;
  refreshUser: () => Promise<void>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [loading, setLoading] = useState(true);

  const refreshUser = useCallback(async () => {
    const currentUser = await getCurrentUser();
    setUser(currentUser);
  }, []);

  const restoreSession = useCallback(async () => {
    try {
      const token = await getToken();
      if (!token) {
        setUser(null);
        return;
      }
      const currentUser = await getCurrentUser();
      setUser(currentUser);
    } catch {
      await removeToken();
      setUser(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void restoreSession();
  }, [restoreSession]);

  const processGoogleRedirect = useCallback(async (url: string) => {
    try {
      const parsed = new URL(url);
      const isWebCallback = Platform.OS === 'web' && parsed.pathname.replace(/\/$/, '') === '/app';
      const isNativeCallback = parsed.protocol === 'quizarena:' && parsed.hostname === 'auth';
      if (!isWebCallback && !isNativeCallback) return;
      if (isWebCallback) {
        window.history.replaceState({}, document.title, parsed.pathname);
      }
      if (parsed.searchParams.get('error')) {
        Alert.alert('Kirish', 'Kirish jarayoni yakunlanmadi. Qayta urinib ko‘ring.');
        return;
      }
      const code = parsed.searchParams.get('code');
      if (!code) return;
      const provider = parsed.searchParams.get('provider');
      const result = provider === 'telegram'
        ? await exchangeTelegramCode(code)
        : await exchangeGoogleCode(code);
      setUser(result.user);
    } catch {
      Alert.alert('Kirish', 'Kirishni yakunlab bo‘lmadi. Qayta urinib ko‘ring.');
    }
  }, []);

  useEffect(() => {
    const subscription = Linking.addEventListener('url', ({ url }) => {
      void processGoogleRedirect(url);
    });
    if (Platform.OS === 'web') {
      void processGoogleRedirect(window.location.href);
    } else {
      void Linking.getInitialURL().then((url) => {
        if (url) void processGoogleRedirect(url);
      });
    }
    return () => subscription.remove();
  }, [processGoogleRedirect]);

  const login = async (username: string, password: string) => {
    const result = await loginUser({ username, password });
    setUser(result.user);
  };

  const register = async (input: {
    displayName: string;
    username: string;
    email?: string;
    password: string;
  }) => {
    const result = await registerUser(input);
    setUser(result.user);
  };

  const requestEmailVerificationCode = async (email: string) => {
    await requestEmailVerification(email);
  };

  const verifyEmail = async (email: string, code: string) => {
    const result = await verifyEmailUser(email, code);
    setUser(result.user);
  };

  const requestEmailReset = async (email: string) => {
    await requestEmailPasswordReset(email);
  };

  const resetEmailPassword = async (email: string, code: string, newPassword: string) => {
    await resetPasswordWithEmail({ email, code, newPassword });
  };

  const requestPhoneLink = async (phoneNumber: string) => {
    await requestPhoneLinkOtp(phoneNumber);
  };

  const linkPhone = async (phoneNumber: string, code: string) => {
    const updatedUser = await linkPhoneNumber({ phoneNumber, code });
    setUser(updatedUser);
  };

  const openOAuth = async (provider: 'google' | 'telegram') => {
    const platform = Platform.OS === 'web' ? '?platform=web' : '';
    const url = `${API_BASE_URL}/api/auth/${provider}/start${platform}`;
    if (Platform.OS === 'web') {
      window.location.assign(url);
      return;
    }
    await Linking.openURL(url);
  };

  const startGoogleLogin = async () => openOAuth('google');

  const startTelegramLogin = async () => openOAuth('telegram');

  const updateProfile = async (input: UpdateProfileInput) => {
    const updatedUser = await updateCurrentUser(input);
    setUser(updatedUser);
  };

  const logout = async () => {
    await removeToken();
    setUser(null);
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        loading,
        login,
        register,
        requestEmailVerification: requestEmailVerificationCode,
        verifyEmail,
        requestEmailPasswordReset: requestEmailReset,
        resetEmailPassword,
        requestPhoneLink,
        linkPhone,
        startGoogleLogin,
        startTelegramLogin,
        updateProfile,
        refreshUser,
        logout,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth AuthProvider ichida ishlatilishi kerak');
  return context;
}
