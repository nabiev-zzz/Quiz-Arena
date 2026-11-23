import React, {
  createContext,
  useContext,
  useMemo,
} from 'react';

import { useAppSettings } from '../context/AppSettingsContext';
import {
  themeTokens,
  type ThemeMode,
  type ThemeTokens,
} from './tokens';

interface ThemeContextValue {
  mode: ThemeMode;
  isDark: boolean;
  tokens: ThemeTokens;
}

const ThemeContext = createContext<ThemeContextValue | undefined>(
  undefined,
);

export function ThemeProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  const { theme } = useAppSettings();

  const value = useMemo<ThemeContextValue>(() => ({
    mode: theme,
    isDark: theme === 'dark',
    tokens: themeTokens[theme],
  }), [theme]);

  return (
    <ThemeContext.Provider value={value}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  const context = useContext(ThemeContext);

  if (!context) {
    throw new Error(
      'useTheme ThemeProvider ichida ishlatilishi kerak.',
    );
  }

  return context;
}