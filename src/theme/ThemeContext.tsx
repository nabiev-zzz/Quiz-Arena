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
  visualStyle: 'classic' | 'liquid-glass';
  isLiquidGlass: boolean;
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
  const { theme, visualStyle } = useAppSettings();

  const value = useMemo<ThemeContextValue>(() => {
    const isLiquidGlass = visualStyle === 'liquid-glass';
    const base = themeTokens[theme];
    const glassColors = isLiquidGlass ? (theme === 'dark' ? {
      ...base.colors,
      background: '#09111F',
      backgroundSecondary: '#101C2D',
      surface: 'rgba(24,38,58,0.72)',
      surfaceElevated: 'rgba(31,48,72,0.86)',
      surfaceGlass: 'rgba(19,32,51,0.62)',
      text: '#F4F8FC',
      textSecondary: '#D0DCE8',
      textMuted: '#9AADC1',
      textInverse: '#101827',
      border: 'rgba(190,216,239,0.16)',
      borderStrong: 'rgba(205,226,245,0.28)',
      glassBorder: 'rgba(210,230,248,0.24)',
      inputBackground: 'rgba(16,29,47,0.76)',
    } : {
      ...base.colors,
      background: '#EAF2FA',
      backgroundSecondary: '#F4F8FC',
      surface: 'rgba(255,255,255,0.76)',
      surfaceElevated: '#FFFFFF',
      surfaceGlass: 'rgba(255,255,255,0.58)',
      text: '#172638',
      textSecondary: '#4F6277',
      textMuted: '#6A7E91',
      border: 'rgba(255,255,255,0.78)',
      borderStrong: 'rgba(255,255,255,0.95)',
      glassBorder: 'rgba(255,255,255,0.82)',
      inputBackground: 'rgba(255,255,255,0.72)',
    }) : base.colors;
    return {
      mode: theme, visualStyle, isLiquidGlass,
      isDark: theme === 'dark',
      tokens: { ...base, colors: glassColors } as ThemeTokens,
    };
  }, [theme, visualStyle]);

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