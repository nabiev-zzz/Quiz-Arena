
import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
} from 'react';

import {
  AuthUser,
  UpdateProfileInput,
  getCurrentUser,
  getToken,
  loginUser,
  registerUser,
  removeToken,
  updateCurrentUser,
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
  updateProfile: (input: UpdateProfileInput) => Promise<void>;
  refreshUser: () => Promise<void>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export function AuthProvider({
  children,
}: {
  children: React.ReactNode;
}) {
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

  if (!context) {
    throw new Error('useAuth AuthProvider ichida ishlatilishi kerak');
  }

  return context;
}
