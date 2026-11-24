
import React from 'react';
import Animated, { useAnimatedScrollHandler, useSharedValue, withSpring, type SharedValue } from 'react-native-reanimated';
import {
  Alert,
  Pressable,
  StyleSheet,
  Switch,
  Text,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';

import {
  useAppSettings,
  AppLanguage,
  AppTheme,
  AppFontSize,
} from '../context/AppSettingsContext';

interface SettingsScreenProps {
  onBack?: () => void;
  dockStretch?: SharedValue<number>;
}

export default function SettingsScreen({
  onBack,
  dockStretch,
}: SettingsScreenProps) {
  const {
    language,
    theme,
    fontSize,
    notifications,
    sound,
    vibration,
    setLanguage,
    setTheme,
    setFontSize,
    setNotifications,
    setSound,
    setVibration,
  } = useAppSettings();

  const isDark = theme === 'dark';
  const lastDockScrollY = useSharedValue(0);
  const dockScrollHandler = useAnimatedScrollHandler({
    onScroll: (event) => {
      if (!dockStretch) return;
      const nextY = event.contentOffset.y;
      const delta = nextY - lastDockScrollY.value;
      lastDockScrollY.value = nextY;
      dockStretch.value = withSpring(Math.max(-1, Math.min(1, delta / 30)), { damping: 11, stiffness: 160, mass: 0.7 });
    },
    onEndDrag: () => { if (dockStretch) dockStretch.value = withSpring(0, { damping: 11, stiffness: 160, mass: 0.7 }); },
    onMomentumEnd: () => { if (dockStretch) dockStretch.value = withSpring(0, { damping: 11, stiffness: 160, mass: 0.7 }); },
  });

  const colors = {
    background: isDark ? '#0B1020' : '#F3F5FA',
    card: isDark ? '#151D33' : '#FFFFFF',
    text: isDark ? '#FFFFFF' : '#172033',
    muted: isDark ? '#929BB0' : '#667085',
    border: isDark ? '#293553' : '#E1E5ED',
    accent: '#8B5CF6',
  };

  const languages: {
    code: AppLanguage;
    flag: string;
    label: string;
  }[] = [
    { code: 'uz', flag: '🇺🇿', label: 'O‘zbekcha' },
    { code: 'ru', flag: '🇷🇺', label: 'Русский' },
    { code: 'en', flag: '🇬🇧', label: 'English' },
  ];

  const fontOptions: {
    value: AppFontSize;
    label: string;
  }[] = [
    { value: 'small', label: 'Kichik' },
    { value: 'medium', label: 'O‘rtacha' },
    { value: 'large', label: 'Katta' },
  ];

  const handleChange = async (
    action: () => Promise<void>,
  ) => {
    try {
      await action();
    } catch {
      Alert.alert(
        'Xatolik',
        'Sozlamani saqlab bo‘lmadi. Qayta urinib ko‘ring.',
      );
    }
  };

  const showPasswordInfo = () => {
    Alert.alert(
      'Parolni o‘zgartirish',
      'Bu imkoniyat uchun serverda parolni yangilash API funksiyasini qo‘shamiz.',
    );
  };

  const showPrivacy = () => {
    Alert.alert(
      'Maxfiylik va xavfsizlik',
      'Hisobingiz xavfsizligi va shaxsiy ma’lumotlaringizni himoya qilish bo‘limi.',
    );
  };

  const showHelp = () => {
    Alert.alert(
      'Yordam',
      'Yordam xizmati bilan bog‘lanish imkoniyatini keyingi bosqichda qo‘shamiz.',
    );
  };

  const SettingRow = ({
    icon,
    title,
    description,
    right,
    onPress,
  }: {
    icon: keyof typeof Ionicons.glyphMap;
    title: string;
    description?: string;
    right?: React.ReactNode;
    onPress?: () => void;
  }) => (
    <Pressable
      style={[
        styles.row,
        {
          backgroundColor: colors.card,
          borderColor: colors.border,
        },
      ]}
      onPress={onPress}
      disabled={!onPress}
    >
      <View style={styles.rowIcon}>
        <Ionicons name={icon} size={21} color={colors.accent} />
      </View>

      <View style={styles.rowContent}>
        <Text style={[styles.rowTitle, { color: colors.text }]}>
          {title}
        </Text>

        {description ? (
          <Text style={[styles.rowDescription, { color: colors.muted }]}>
            {description}
          </Text>
        ) : null}
      </View>

      {right}
    </Pressable>
  );

  return (
    <Animated.ScrollView
      onScroll={dockScrollHandler}
      scrollEventThrottle={16}
      style={{ flex: 1, backgroundColor: colors.background }}
      contentContainerStyle={styles.content}
      showsVerticalScrollIndicator={false}
    >
      <View style={styles.header}>
        <Pressable
          style={[
            styles.backButton,
            { backgroundColor: colors.card },
          ]}
          onPress={onBack}
        >
          <Ionicons name="arrow-back" size={22} color={colors.text} />
        </Pressable>

        <Text style={[styles.headerTitle, { color: colors.text }]}>
          Sozlamalar
        </Text>
      </View>

      <Text style={[styles.sectionTitle, { color: colors.muted }]}>
        KO‘RINISH
      </Text>

      <View
        style={[
          styles.groupCard,
          { backgroundColor: colors.card, borderColor: colors.border },
        ]}
      >
        <View style={styles.optionHeader}>
          <Ionicons
            name={theme === 'dark' ? 'moon' : 'sunny'}
            size={22}
            color={colors.accent}
          />

          <Text style={[styles.optionTitle, { color: colors.text }]}>
            {theme === 'dark' ? 'Dark Mode' : 'Light Mode'}
          </Text>

          <Switch
            value={theme === 'dark'}
            onValueChange={(value) =>
              void handleChange(() =>
                setTheme(value ? 'dark' : 'light'),
              )
            }
            trackColor={{ false: '#AAB2C5', true: '#8B5CF6' }}
            thumbColor="#FFFFFF"
          />
        </View>

        <Text style={[styles.helperText, { color: colors.muted }]}>
          Qorong‘i yoki yorug‘ ko‘rinishni tanlang.
        </Text>
      </View>

      <Text style={[styles.sectionTitle, { color: colors.muted }]}>
        TIL
      </Text>

      <View
        style={[
          styles.groupCard,
          { backgroundColor: colors.card, borderColor: colors.border },
        ]}
      >
        {languages.map((item) => (
          <Pressable
            key={item.code}
            style={styles.languageRow}
            onPress={() =>
              void handleChange(() => setLanguage(item.code))
            }
          >
            <Text style={styles.flag}>{item.flag}</Text>

            <Text style={[styles.optionTitle, { color: colors.text }]}>
              {item.label}
            </Text>

            <View style={{ flex: 1 }} />

            {language === item.code ? (
              <Ionicons
                name="checkmark-circle"
                size={22}
                color={colors.accent}
              />
            ) : (
              <View
                style={[
                  styles.radio,
                  { borderColor: colors.muted },
                ]}
              />
            )}
          </Pressable>
        ))}
      </View>

      <Text style={[styles.sectionTitle, { color: colors.muted }]}>
        SHRIFT O‘LCHAMI
      </Text>

      <View
        style={[
          styles.groupCard,
          { backgroundColor: colors.card, borderColor: colors.border },
        ]}
      >
        <View style={styles.fontOptions}>
          {fontOptions.map((item) => (
            <Pressable
              key={item.value}
              onPress={() =>
                void handleChange(() => setFontSize(item.value))
              }
              style={[
                styles.fontButton,
                {
                  backgroundColor:
                    fontSize === item.value
                      ? colors.accent
                      : colors.background,
                },
              ]}
            >
              <Text
                style={[
                  styles.fontButtonText,
                  {
                    color:
                      fontSize === item.value ? '#FFFFFF' : colors.text,
                  },
                ]}
              >
                {item.label}
              </Text>
            </Pressable>
          ))}
        </View>
      </View>

      <Text style={[styles.sectionTitle, { color: colors.muted }]}>
        BILDIRISHNOMALAR
      </Text>

      <SettingRow
        icon="notifications-outline"
        title="Bildirishnomalar"
        description="Ilova xabarlari"
        right={
          <Switch
            value={notifications}
            onValueChange={(value) =>
              void handleChange(() => setNotifications(value))
            }
            trackColor={{ false: '#AAB2C5', true: '#8B5CF6' }}
            thumbColor="#FFFFFF"
          />
        }
      />

      <SettingRow
        icon="volume-high-outline"
        title="Ovoz"
        description="Tovush effektlari"
        right={
          <Switch
            value={sound}
            onValueChange={(value) =>
              void handleChange(() => setSound(value))
            }
            trackColor={{ false: '#AAB2C5', true: '#8B5CF6' }}
            thumbColor="#FFFFFF"
          />
        }
      />

      <SettingRow
        icon="phone-portrait-outline"
        title="Tebranish"
        description="Javob berishdagi tebranish"
        right={
          <Switch
            value={vibration}
            onValueChange={(value) =>
              void handleChange(() => setVibration(value))
            }
            trackColor={{ false: '#AAB2C5', true: '#8B5CF6' }}
            thumbColor="#FFFFFF"
          />
        }
      />

      <Text style={[styles.sectionTitle, { color: colors.muted }]}>
        HISOB VA XAVFSIZLIK
      </Text>

      <SettingRow
        icon="lock-closed-outline"
        title="Parolni o‘zgartirish"
        description="Hisobingiz parolini yangilang"
        right={
          <Ionicons
            name="chevron-forward"
            size={20}
            color={colors.muted}
          />
        }
        onPress={showPasswordInfo}
      />

      <SettingRow
        icon="shield-checkmark-outline"
        title="Maxfiylik va xavfsizlik"
        description="Hisob va shaxsiy ma’lumotlar"
        right={
          <Ionicons
            name="chevron-forward"
            size={20}
            color={colors.muted}
          />
        }
        onPress={showPrivacy}
      />

      <SettingRow
        icon="document-text-outline"
        title="Maxfiylik siyosati"
        description="Ma’lumotlardan foydalanish qoidalari"
        right={
          <Ionicons
            name="chevron-forward"
            size={20}
            color={colors.muted}
          />
        }
        onPress={() =>
          Alert.alert(
            'Maxfiylik siyosati',
            'Rasmiy maxfiylik siyosati sahifasini keyingi bosqichda qo‘shamiz.',
          )
        }
      />

      <Text style={[styles.sectionTitle, { color: colors.muted }]}>
        YORDAM
      </Text>

      <SettingRow
        icon="help-circle-outline"
        title="Savol berish va yordam"
        description="Yordam xizmatiga murojaat"
        right={
          <Ionicons
            name="chevron-forward"
            size={20}
            color={colors.muted}
          />
        }
        onPress={showHelp}
      />

      <Text style={[styles.version, { color: colors.muted }]}>
        QUIZ ARENA • Sozlamalar
      </Text>
    </Animated.ScrollView>
  );
}

const styles = StyleSheet.create({
  content: {
    paddingHorizontal: 18,
    paddingTop: 10,
    paddingBottom: 48,
  },
  header: {
    minHeight: 48,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    marginBottom: 22,
  },
  backButton: {
    width: 46,
    height: 46,
    borderRadius: 15,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitle: {
    fontSize: 24,
    fontWeight: '800',
  },
  sectionTitle: {
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 1.2,
    marginTop: 21,
    marginBottom: 11,
  },
  groupCard: {
    borderRadius: 18,
    borderWidth: 1,
    padding: 15,
    marginBottom: 5,
  },
  optionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  optionTitle: {
    fontSize: 15,
    fontWeight: '700',
  },
  helperText: {
    fontSize: 12,
    marginTop: 7,
    marginLeft: 34,
  },
  languageRow: {
    minHeight: 52,
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    gap: 12,
  },
  flag: {
    fontSize: 22,
  },
  radio: {
    width: 19,
    height: 19,
    borderRadius: 10,
    borderWidth: 2,
  },
  fontOptions: {
    flexDirection: 'row',
    gap: 8,
  },
  fontButton: {
    flex: 1,
    minHeight: 46,
    paddingVertical: 11,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  fontButtonText: {
    fontSize: 12,
    fontWeight: '700',
  },
  row: {
    minHeight: 70,
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 17,
    borderWidth: 1,
    paddingHorizontal: 14,
    paddingVertical: 13,
    marginBottom: 9,
    gap: 12,
  },
  rowIcon: {
    width: 42,
    height: 42,
    borderRadius: 13,
    backgroundColor: 'rgba(139,92,246,0.13)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  rowContent: {
    flex: 1,
  },
  rowTitle: {
    fontSize: 14,
    fontWeight: '700',
  },
  rowDescription: {
    fontSize: 12,
    lineHeight: 17,
    marginTop: 4,
  },
  version: {
    fontSize: 11,
    textAlign: 'center',
    marginTop: 30,
  },
});
