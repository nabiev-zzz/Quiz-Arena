import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
} from 'react';
import { Alert, Linking } from 'react-native';

import {
  AuthUser,
  UpdateProfileInput,
  API_BASE_URL,
  exchangeGoogleCode,
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
      if (parsed.protocol !== 'quizarena:' || parsed.hostname !== 'auth') return;
      if (parsed.searchParams.get('error')) {
        Alert.alert('Google orqali kirish', 'Google hisobiga kirish yakunlanmadi. Qayta urinib ko‘ring.');
        return;
      }
      const code = parsed.searchParams.get('code');
      if (!code) return;
      const result = await exchangeGoogleCode(code);
      setUser(result.user);
    } catch {
      Alert.alert('Google orqali kirish', 'Kirishni yakunlab bo‘lmadi. Qayta urinib ko‘ring.');
    }
  }, []);

  useEffect(() => {
    const subscription = Linking.addEventListener('url', ({ url }) => {
      void processGoogleRedirect(url);
    });
    void Linking.getInitialURL().then((url) => {
      if (url) void processGoogleRedirect(url);
    });
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

  const startGoogleLogin = async () => {
    await Linking.openURL(`${API_BASE_URL}/api/auth/google/start`);
  };

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
