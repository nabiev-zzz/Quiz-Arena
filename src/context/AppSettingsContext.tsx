
import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
} from 'react';
import * as SecureStore from 'expo-secure-store';

export type AppLanguage = 'uz' | 'ru' | 'en';
export type AppTheme = 'dark' | 'light';
export type AppFontSize = 'small' | 'medium' | 'large';

interface AppSettings {
  language: AppLanguage;
  theme: AppTheme;
  fontSize: AppFontSize;
  notifications: boolean;
  sound: boolean;
  vibration: boolean;
}

interface AppSettingsContextValue extends AppSettings {
  ready: boolean;
  setLanguage: (value: AppLanguage) => Promise<void>;
  setTheme: (value: AppTheme) => Promise<void>;
  setFontSize: (value: AppFontSize) => Promise<void>;
  setNotifications: (value: boolean) => Promise<void>;
  setSound: (value: boolean) => Promise<void>;
  setVibration: (value: boolean) => Promise<void>;
}

const STORAGE_KEY = 'quiz_arena_preferences';

const defaultSettings: AppSettings = {
  language: 'uz',
  theme: 'dark',
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
        const stored = await SecureStore.getItemAsync(STORAGE_KEY);

        if (stored) {
          const parsed = JSON.parse(stored) as Partial<AppSettings>;

          if (active) {
            setSettings({
              ...defaultSettings,
              ...parsed,
            });
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

      setSettings(updated);

      try {
        await SecureStore.setItemAsync(
          STORAGE_KEY,
          JSON.stringify(updated),
        );
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
