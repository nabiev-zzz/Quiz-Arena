
import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
} from 'react';
import * as SecureStore from 'expo-secure-store';
import { Platform } from 'react-native';
import { setAppLanguage } from '../i18n/LocalizedText';

export type AppLanguage = 'uz' | 'ru' | 'en';
export type AppTheme = 'dark' | 'light';
export type AppVisualStyle = 'classic' | 'liquid-glass';
export type AppFontSize = 'small' | 'medium' | 'large';

interface AppSettings {
  language: AppLanguage;
  theme: AppTheme;
  visualStyle: AppVisualStyle;
  fontSize: AppFontSize;
  notifications: boolean;
  sound: boolean;
  vibration: boolean;
}

interface AppSettingsContextValue extends AppSettings {
  ready: boolean;
  setLanguage: (value: AppLanguage) => Promise<void>;
  setTheme: (value: AppTheme) => Promise<void>;
  setVisualStyle: (value: AppVisualStyle) => Promise<void>;
  setFontSize: (value: AppFontSize) => Promise<void>;
  setNotifications: (value: boolean) => Promise<void>;
  setSound: (value: boolean) => Promise<void>;
  setVibration: (value: boolean) => Promise<void>;
}

const STORAGE_KEY = 'quiz_arena_preferences';

type BrowserPreferenceStorage = {
  getItem: (key: string) => string | null;
  setItem: (key: string, value: string) => void;
};

function getBrowserPreferenceStorage() {
  return (globalThis as typeof globalThis & {
    localStorage?: BrowserPreferenceStorage;
  }).localStorage;
}

async function readPreferences() {
  if (Platform.OS === 'web') {
    return getBrowserPreferenceStorage()?.getItem(STORAGE_KEY) ?? null;
  }

  return SecureStore.getItemAsync(STORAGE_KEY);
}

async function writePreferences(value: string) {
  if (Platform.OS === 'web') {
    const storage = getBrowserPreferenceStorage();

    if (!storage) {
      throw new Error('Brauzer xotirasi mavjud emas.');
    }

    storage.setItem(STORAGE_KEY, value);
    return;
  }

  await SecureStore.setItemAsync(STORAGE_KEY, value);
}

const defaultSettings: AppSettings = {
  language: 'uz',
  theme: 'dark',
  visualStyle: 'classic',
  fontSize: 'medium',
  notifications: true,
  sound: true,
  vibration: true,
};

const AppSettingsContext =
  createContext<AppSettingsContextValue | undefined>(undefined);

export function AppSettingsProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  const [settings, setSettings] = useState<AppSettings>(defaultSettings);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    let active = true;

    const restoreSettings = async () => {
      try {
        const stored = await readPreferences();

        if (stored) {
          const parsed = JSON.parse(stored) as Partial<AppSettings>;

          if (active) {
            const restored: AppSettings = {
              ...defaultSettings,
              ...parsed,
              language: parsed.language === 'ru' || parsed.language === 'en' || parsed.language === 'uz'
                ? parsed.language
                : defaultSettings.language,
              theme: parsed.theme === 'light' || parsed.theme === 'dark'
                ? parsed.theme
                : defaultSettings.theme,
              visualStyle: parsed.visualStyle === 'liquid-glass' || parsed.visualStyle === 'classic'
                ? parsed.visualStyle
                : defaultSettings.visualStyle,
            };
            setAppLanguage(restored.language);
            setSettings(restored);
          }
        }
      } catch {
        // Saqlangan sozlamalar o'qilmasa, standart qiymatlar ishlatiladi.
      } finally {
        if (active) {
          setReady(true);
        }
      }
    };

    void restoreSettings();

    return () => {
      active = false;
    };
  }, []);

  const updateSettings = useCallback(
    async (changes: Partial<AppSettings>) => {
      const updated = { ...settings, ...changes };

      if (changes.language) {
        setAppLanguage(changes.language);
      }

      setSettings(updated);

      try {
        await writePreferences(JSON.stringify(updated));
      } catch {
        throw new Error('Sozlamalarni saqlab bo‘lmadi.');
      }
    },
    [settings],
  );

  const setLanguage = (value: AppLanguage) =>
    updateSettings({ language: value });

  const setTheme = (value: AppTheme) =>
    updateSettings({ theme: value });

  const setVisualStyle = (value: AppVisualStyle) =>
    updateSettings({ visualStyle: value });

  const setFontSize = (value: AppFontSize) =>
    updateSettings({ fontSize: value });

  const setNotifications = (value: boolean) =>
    updateSettings({ notifications: value });

  const setSound = (value: boolean) =>
    updateSettings({ sound: value });

  const setVibration = (value: boolean) =>
    updateSettings({ vibration: value });

  return (
    <AppSettingsContext.Provider
      value={{
        ...settings,
        ready,
        setLanguage,
        setTheme,
        setVisualStyle,
        setFontSize,
        setNotifications,
        setSound,
        setVibration,
      }}
    >
      {children}
    </AppSettingsContext.Provider>
  );
}

export function useAppSettings() {
  const context = useContext(AppSettingsContext);

  if (!context) {
    throw new Error(
      'useAppSettings AppSettingsProvider ichida ishlatilishi kerak',
    );
  }

  return context;
}
