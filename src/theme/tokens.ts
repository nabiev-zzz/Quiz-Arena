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
  background: '#091410',
  backgroundSecondary: '#102019',
  surface: '#15241D',
  surfaceElevated: '#1D2D24',
  surfaceGlass: 'rgba(21, 36, 29, 0.96)',
  primary: '#E5B95C',
  primaryLight: '#F4D98F',
  primaryDark: '#B78332',
  secondary: '#65C99A',
  text: '#F7F8F3',
  textSecondary: '#C5D2C8',
  textMuted: '#91A69A',
  textInverse: '#FFFFFF',
  border: 'rgba(193, 218, 198, 0.10)',
  borderStrong: 'rgba(193, 218, 198, 0.19)',
  glassBorder: 'rgba(193, 218, 198, 0.15)',
  success: '#65C99A',
  successSurface: 'rgba(101, 201, 154, 0.14)',
  danger: '#FF647C',
  dangerSurface: 'rgba(255, 100, 124, 0.14)',
  warning: '#F4C66F',
  warningSurface: 'rgba(255, 196, 107, 0.14)',
  info: '#55B8FF',
  infoSurface: 'rgba(85, 184, 255, 0.14)',
  overlay: 'rgba(4, 13, 8, 0.80)',
  inputBackground: '#102019',
  disabled: '#465064',
} as const;

const lightColors = {
  background: '#F5F8F4',
  backgroundSecondary: '#EAF1E9',
  surface: '#FFFFFF',
  surfaceElevated: '#FFFFFF',
  surfaceGlass: 'rgba(255, 255, 255, 0.76)',
  primary: '#A8324B',
  primaryLight: '#C95B70',
  primaryDark: '#84243A',
  secondary: '#287D59',
  text: '#202B24',
  textSecondary: '#59685D',
  textMuted: '#7D8C80',
  textInverse: '#FFFFFF',
  border: 'rgba(48, 92, 61, 0.10)',
  borderStrong: 'rgba(48, 92, 61, 0.18)',
  glassBorder: 'rgba(168, 50, 75, 0.13)',
  success: '#287D59',
  successSurface: 'rgba(40, 125, 89, 0.10)',
  danger: '#D9435B',
  dangerSurface: 'rgba(217, 67, 91, 0.10)',
  warning: '#B7791F',
  warningSurface: 'rgba(183, 121, 31, 0.10)',
  info: '#247CC5',
  infoSurface: 'rgba(36, 124, 197, 0.10)',
  overlay: 'rgba(14, 29, 18, 0.44)',
  inputBackground: 'rgba(255, 255, 255, 0.94)',
  disabled: '#C6CDDA',
} as const;

export const themeTokens = {
  dark: {
    ...shared,
    colors: darkColors,
    gradients: {
      primary: ['#9D2D46', '#E5B95C'],
      secondary: ['#236B4D', '#65C99A'],
      background: ['#1A3024', '#091410'],
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
        color: '#D5A94D',
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
      primary: ['#A8324B', '#E5B95C'],
      secondary: ['#287D59', '#A9D9B7'],
      background: ['#FBFCF8', '#EAF1E9'],
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
        color: '#A8324B',
        opacity: 0.20,
        radius: 16,
        offset: { width: 0, height: 6 },
        elevation: 5,
      },
    },
  },
} as const;

export type ThemeTokens = (typeof themeTokens)[ThemeMode];