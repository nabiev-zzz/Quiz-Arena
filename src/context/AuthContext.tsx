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
  registerWithPhoneUser,
  requestPhoneOtp,
  loginWithPhoneUser,
  resetPasswordWithPhone,
  removeToken,
  updateCurrentUser,
} from '../services/authService';

interface AuthContextValue {
  user: AuthUser | null;
  loading: boolean;
  login: (username: string, password: string) => Promise<void>;
  register: (input: {
    phoneNumber: string;
    code: string;
    displayName: string;
    username: string;
    email?: string;
    password: string;
  }) => Promise<void>;
  requestRegistrationOtp: (phoneNumber: string) => Promise<void>;
  requestPhoneLogin: (phoneNumber: string) => Promise<void>;
  loginWithPhone: (phoneNumber: string, code: string) => Promise<void>;
  requestPasswordReset: (phoneNumber: string) => Promise<void>;
  resetPassword: (phoneNumber: string, code: string, newPassword: string) => Promise<void>;
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
    phoneNumber: string;
    code: string;
    displayName: string;
    username: string;
    email?: string;
    password: string;
  }) => {
    const result = await registerWithPhoneUser(input);
    setUser(result.user);
  };

  const requestRegistrationOtp = async (phoneNumber: string) => {
    await requestPhoneOtp(phoneNumber, 'register');
  };

  const requestPhoneLogin = async (phoneNumber: string) => {
    await requestPhoneOtp(phoneNumber, 'phone-login');
  };

  const loginWithPhone = async (phoneNumber: string, code: string) => {
    const result = await loginWithPhoneUser({ phoneNumber, code });
    setUser(result.user);
  };

  const requestPasswordReset = async (phoneNumber: string) => {
    await requestPhoneOtp(phoneNumber, 'password-reset');
  };

  const resetPassword = async (phoneNumber: string, code: string, newPassword: string) => {
    await resetPasswordWithPhone({ phoneNumber, code, newPassword });
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
        requestRegistrationOtp,
        requestPhoneLogin,
        loginWithPhone,
        requestPasswordReset,
        resetPassword,
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
