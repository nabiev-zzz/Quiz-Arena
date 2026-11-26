export type ThemeMode = 'dark' | 'light';

const shared = {
  spacing: {
    0: 0, 1: 4, 2: 8, 3: 12, 4: 16, 5: 20,
    6: 24, 7: 28, 8: 32, 10: 40, 12: 48, 16: 64,
  },
  radius: {
    sm: 10, md: 14, lg: 18, xl: 24, pill: 999,
  },
  typography: {
    display: 36, title: 30, headline: 24, subheadline: 20,
    body: 16, bodySmall: 14, caption: 12, micro: 10,
  },
  fontWeight: {
    regular: '400', medium: '500', semibold: '600',
    bold: '700', extraBold: '800',
  },
  component: {
    buttonHeight: 54,
    inputHeight: 54,
    iconButtonSize: 48,
    tabBarHeight: 68,
    avatarSmall: 36,
    avatarMedium: 48,
    avatarLarge: 88,
    progressHeight: 8,
    modalTopRadius: 28,
    tabBarBottomOffset: 12,
  },
  blur: {
    subtle: 12, medium: 24, strong: 40,
  },
  opacity: {
    disabled: 0.45, muted: 0.65, overlay: 0.55,
    glass: 0.12, pressed: 0.75,
  },
  animation: {
    fast: 150, normal: 250, slow: 350,
  },
  zIndex: {
    base: 0, content: 1, sticky: 10,
    tabBar: 20, backdrop: 90, modal: 100, toast: 200,
  },
} as const;

const darkColors = {
  background: '#090B14',
  backgroundSecondary: '#101522',
  surface: '#141A28',
  surfaceElevated: '#1B2434',
  surfaceGlass: 'rgba(20, 26, 40, 0.96)',
  primary: '#A78BFA',
  primaryLight: '#C9B8FF',
  primaryDark: '#7658D6',
  secondary: '#73E2C4',
  text: '#F5F7FF',
  textSecondary: '#B9C2D4',
  textMuted: '#8792A8',
  textInverse: '#FFFFFF',
  border: 'rgba(174, 190, 220, 0.09)',
  borderStrong: 'rgba(174, 190, 220, 0.16)',
  glassBorder: 'rgba(174, 190, 220, 0.13)',
  success: '#43D6A5',
  successSurface: 'rgba(54, 214, 160, 0.14)',
  danger: '#FF647C',
  dangerSurface: 'rgba(255, 100, 124, 0.14)',
  warning: '#F4C66F',
  warningSurface: 'rgba(255, 196, 107, 0.14)',
  info: '#55B8FF',
  infoSurface: 'rgba(85, 184, 255, 0.14)',
  overlay: 'rgba(5, 8, 16, 0.78)',
  inputBackground: '#101624',
  disabled: '#465064',
} as const;

const lightColors = {
  background: '#F6F3FC',
  backgroundSecondary: '#EEE9F8',
  surface: '#FFFFFF',
  surfaceElevated: '#FFFFFF',
  surfaceGlass: 'rgba(255, 255, 255, 0.76)',
  primary: '#7958C9',
  primaryLight: '#A78BFA',
  primaryDark: '#6243B0',
  secondary: '#258F7C',
  text: '#211A32',
  textSecondary: '#554D68',
  textMuted: '#766E86',
  textInverse: '#FFFFFF',
  border: 'rgba(67, 48, 104, 0.10)',
  borderStrong: 'rgba(67, 48, 104, 0.18)',
  glassBorder: 'rgba(121, 88, 201, 0.16)',
  success: '#159B70',
  successSurface: 'rgba(21, 155, 112, 0.10)',
  danger: '#D9435B',
  dangerSurface: 'rgba(217, 67, 91, 0.10)',
  warning: '#B7791F',
  warningSurface: 'rgba(183, 121, 31, 0.10)',
  info: '#247CC5',
  infoSurface: 'rgba(36, 124, 197, 0.10)',
  overlay: 'rgba(14, 24, 44, 0.42)',
  inputBackground: 'rgba(255, 255, 255, 0.92)',
  disabled: '#C6CDDA',
} as const;

export const themeTokens = {
  dark: {
    ...shared,
    colors: darkColors,
    gradients: {
      primary: ['#805AD5', '#A78BFA'],
      secondary: ['#258F7C', '#8CE5D0'],
      background: ['#171E31', '#090B14'],
      success: ['#159B70', '#36D6A0'],
      danger: ['#D9435B', '#FF647C'],
    },
    shadows: {
      card: {
        color: '#000000',
        opacity: 0.22,
        radius: 22,
        offset: { width: 0, height: 10 },
        elevation: 5,
      },
      primary: {
        color: '#8B75FF',
        opacity: 0.28,
        radius: 16,
        offset: { width: 0, height: 6 },
        elevation: 6,
      },
    },
  },
  light: {
    ...shared,
    colors: lightColors,
    gradients: {
      primary: ['#6243B0', '#A78BFA'],
      secondary: ['#258F7C', '#8CE5D0'],
      background: ['#F6F3FC', '#EEE9F8'],
      success: ['#159B70', '#36C99A'],
      danger: ['#D9435B', '#FF647C'],
    },
    shadows: {
      card: {
        color: '#34466B',
        opacity: 0.10,
        radius: 18,
        offset: { width: 0, height: 8 },
        elevation: 4,
      },
      primary: {
        color: '#7155E8',
        opacity: 0.20,
        radius: 16,
        offset: { width: 0, height: 6 },
        elevation: 5,
      },
    },
  },
} as const;

export type ThemeTokens = (typeof themeTokens)[ThemeMode];