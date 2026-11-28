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
  background: '#081321',
  backgroundSecondary: '#0D1B2D',
  surface: '#122238',
  surfaceElevated: '#192C45',
  surfaceGlass: 'rgba(18, 34, 56, 0.94)',
  primary: '#9AD8FF',
  primaryLight: '#D7F0FF',
  primaryDark: '#4D9CCB',
  secondary: '#B8C7D8',
  text: '#F4F8FC',
  textSecondary: '#C4D0DD',
  textMuted: '#8FA2B8',
  textInverse: '#FFFFFF',
  border: 'rgba(173, 205, 235, 0.12)',
  borderStrong: 'rgba(173, 205, 235, 0.22)',
  glassBorder: 'rgba(173, 205, 235, 0.18)',
  success: '#78D6B0',
  successSurface: 'rgba(101, 201, 154, 0.14)',
  danger: '#FF647C',
  dangerSurface: 'rgba(255, 100, 124, 0.14)',
  warning: '#E8C77A',
  warningSurface: 'rgba(255, 196, 107, 0.14)',
  info: '#55B8FF',
  infoSurface: 'rgba(85, 184, 255, 0.14)',
  overlay: 'rgba(4, 10, 20, 0.80)',
  inputBackground: '#0D1B2D',
  disabled: '#46566B',
} as const;

const lightColors = {
  background: '#F2F7FC',
  backgroundSecondary: '#E7F0F8',
  surface: '#FFFFFF',
  surfaceElevated: '#FFFFFF',
  surfaceGlass: 'rgba(255, 255, 255, 0.82)',
  primary: '#347EA9',
  primaryLight: '#69A9CF',
  primaryDark: '#245D80',
  secondary: '#71869B',
  text: '#172638',
  textSecondary: '#4F6277',
  textMuted: '#74879A',
  textInverse: '#FFFFFF',
  border: 'rgba(65, 111, 151, 0.12)',
  borderStrong: 'rgba(65, 111, 151, 0.20)',
  glassBorder: 'rgba(52, 126, 169, 0.18)',
  success: '#258A69',
  successSurface: 'rgba(40, 125, 89, 0.10)',
  danger: '#D9435B',
  dangerSurface: 'rgba(217, 67, 91, 0.10)',
  warning: '#9A741F',
  warningSurface: 'rgba(183, 121, 31, 0.10)',
  info: '#247CC5',
  infoSurface: 'rgba(36, 124, 197, 0.10)',
  overlay: 'rgba(8, 19, 33, 0.44)',
  inputBackground: 'rgba(255, 255, 255, 0.94)',
  disabled: '#C6CDDA',
} as const;

export const themeTokens = {
  dark: {
    ...shared,
    colors: darkColors,
    gradients: {
      primary: ['#347EA9', '#9AD8FF'],
      secondary: ['#71869B', '#B8C7D8'],
      background: ['#142A43', '#081321'],
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
        color: '#78BFE8',
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
      primary: ['#347EA9', '#9AD8FF'],
      secondary: ['#258A69', '#B8C7D8'],
      background: ['#FFFFFF', '#E7F0F8'],
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
        color: '#347EA9',
        opacity: 0.20,
        radius: 16,
        offset: { width: 0, height: 6 },
        elevation: 5,
      },
    },
  },
} as const;

export type ThemeTokens = (typeof themeTokens)[ThemeMode];