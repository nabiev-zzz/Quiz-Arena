import { LocalizedText, showLocalizedAlert } from '../i18n/LocalizedText';

import Animated, { useAnimatedScrollHandler, useSharedValue, withSpring, type SharedValue } from 'react-native-reanimated';
import {
  Alert,
  ActivityIndicator,
  Linking,
  Modal,
  Pressable,
  StyleSheet,
  Switch,
  Text as NativeText,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../theme/ThemeContext';
import { useState } from 'react';
import { LocalizedTextInput } from '../i18n/LocalizedText';

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
  const { user, deleteAccount } = useAuth();
  const { tokens } = useTheme();

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
  const [deleteModalVisible, setDeleteModalVisible] = useState(false);
  const [deletePassword, setDeletePassword] = useState('');
  const [deletingAccount, setDeletingAccount] = useState(false);
  const [deleteError, setDeleteError] = useState('');
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
    background: tokens.colors.background,
    card: tokens.colors.surface,
    text: tokens.colors.text,
    muted: tokens.colors.textMuted,
    border: tokens.colors.border,
    accent: tokens.colors.primary,
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
      showLocalizedAlert(
        'Xatolik',
        'Sozlamani saqlab bo‘lmadi. Qayta urinib ko‘ring.',
      );
    }
  };


  const showPasswordInfo = () => {
    showLocalizedAlert(
      'Parolni o‘zgartirish',
      'Bu imkoniyat uchun serverda parolni yangilash API funksiyasini qo‘shamiz.',
    );
  };

  const showPrivacy = () => {
    void Linking.openURL('https://quiz-arena-website-production.up.railway.app/privacy.html');
  };

  const showHelp = () => {
    void Linking.openURL('https://quiz-arena-website-production.up.railway.app/support.html');
  };

  const submitAccountDeletion = async () => {
    if (deletePassword.length > 128) {
      setDeleteError('Parol 128 belgidan oshmasligi kerak.');
      return;
    }
    setDeletingAccount(true);
    setDeleteError('');
    try {
      await deleteAccount(deletePassword);
      setDeletePassword('');
      setDeleteModalVisible(false);
      onBack?.();
    } catch (error) {
      setDeleteError(error instanceof Error ? error.message : 'Hisobni o‘chirib bo‘lmadi. Qayta urinib ko‘ring.');
    } finally {
      setDeletingAccount(false);
    }
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
        <LocalizedText style={[styles.rowTitle, { color: colors.text }]}>
          {title}
        </LocalizedText>

        {description ? (
          <LocalizedText style={[styles.rowDescription, { color: colors.muted }]}>
            {description}
          </LocalizedText>
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

        <LocalizedText style={[styles.headerTitle, { color: colors.text }]}>
          Sozlamalar
        </LocalizedText>
      </View>

      <LocalizedText style={[styles.sectionTitle, { color: colors.muted }]}>
        KO‘RINISH
      </LocalizedText>

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

          <LocalizedText style={[styles.optionTitle, { color: colors.text }]}>
            {theme === 'dark' ? 'Qorong‘i rejim' : 'Yorug‘ rejim'}
          </LocalizedText>

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

        <LocalizedText style={[styles.helperText, { color: colors.muted }]}>
          Qorong‘i yoki yorug‘ ko‘rinishni tanlang.
        </LocalizedText>
      </View>

      <LocalizedText style={[styles.sectionTitle, { color: colors.muted }]}>
        TIL
      </LocalizedText>

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
            <LocalizedText style={styles.flag}>{item.flag}</LocalizedText>

            <LocalizedText style={[styles.optionTitle, { color: colors.text }]}>
              {item.label}
            </LocalizedText>

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

      <LocalizedText style={[styles.sectionTitle, { color: colors.muted }]}>
        SHRIFT O‘LCHAMI
      </LocalizedText>

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
              <LocalizedText
                style={[
                  styles.fontButtonText,
                  {
                    color:
                      fontSize === item.value ? '#FFFFFF' : colors.text,
                  },
                ]}
              >
                {item.label}
              </LocalizedText>
            </Pressable>
          ))}
        </View>
      </View>

      <LocalizedText style={[styles.sectionTitle, { color: colors.muted }]}>
        BILDIRISHNOMALAR
      </LocalizedText>

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

      <LocalizedText style={[styles.sectionTitle, { color: colors.muted }]}>
        HISOB VA XAVFSIZLIK
      </LocalizedText>

      <SettingRow
        icon="mail-outline"
        title="Tiklash email manzili"
        description={user?.email ? (user.emailVerified ? 'Tasdiqlangan: ' + user.email : 'Tasdiqlanmagan: ' + user.email) : 'Email manzili ulanmagan'}
        right={
          <Ionicons
            name={user?.emailVerified ? 'checkmark-circle' : 'alert-circle-outline'}
            size={20}
            color={user?.emailVerified ? '#22C55E' : colors.muted}
          />
        }
      />
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
        onPress={showPrivacy}
      />

      <SettingRow
        icon="trash-outline"
        title="Hisobni butunlay o‘chirish"
        description="Profil va hisobga bog‘langan ma’lumotlarni o‘chirish"
        right={<Ionicons name="chevron-forward" size={20} color="#EF4444" />}
        onPress={() => { setDeletePassword(''); setDeleteError(''); setDeleteModalVisible(true); }}
      />

      <LocalizedText style={[styles.sectionTitle, { color: colors.muted }]}>
        YORDAM
      </LocalizedText>

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

      <LocalizedText style={[styles.version, { color: colors.muted }]}>
        QUIZ ARENA • Sozlamalar
      </LocalizedText>

      <Modal visible={deleteModalVisible} transparent animationType="fade" onRequestClose={() => { if (!deletingAccount) setDeleteModalVisible(false); }}>
        <View style={styles.modalBackdrop}>
          <View style={[styles.deleteModal, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <View style={styles.deleteIcon}><Ionicons name="warning-outline" size={26} color="#EF4444" /></View>
            <LocalizedText style={[styles.deleteTitle, { color: colors.text }]}>Hisobni o‘chirish</LocalizedText>
            <LocalizedText style={[styles.deleteDescription, { color: colors.muted }]}>Bu amal qaytarilmaydi. Profilingiz, AI suhbatlaringiz, o‘quv natijalaringiz va Battle tarixingiz o‘chiriladi. Ayrim to‘lov qaydlari hisobdan ajratilgan, shaxsni ko‘rsatmaydigan shaklda saqlanishi mumkin.</LocalizedText>
            <LocalizedTextInput value={deletePassword} onChangeText={setDeletePassword} placeholder="Joriy parol (Google/Telegram orqali kirgan bo‘lsangiz ixtiyoriy)" placeholderTextColor={colors.muted} secureTextEntry editable={!deletingAccount} autoCapitalize="none" autoCorrect={false} returnKeyType="done" onSubmitEditing={() => void submitAccountDeletion()} style={[styles.deleteInput, { color: colors.text, borderColor: colors.border, backgroundColor: colors.background }]} />
            <Pressable disabled={deletingAccount} onPress={() => void Linking.openURL('https://quiz-arena-website-production.up.railway.app/account-deletion.html')} style={{ marginTop: 10 }}>
              <LocalizedText style={{ color: colors.accent, fontSize: 12, fontWeight: '700' }}>Email orqali tasdiqlash sahifasini ochish</LocalizedText>
            </Pressable>
            {deleteError ? <LocalizedText style={styles.deleteError}>{deleteError}</LocalizedText> : null}
            <Pressable disabled={deletingAccount} onPress={() => void submitAccountDeletion()} style={[styles.deleteConfirm, { opacity: deletingAccount ? 0.65 : 1 }]}>
              {deletingAccount ? <ActivityIndicator color="#FFFFFF" /> : <LocalizedText style={styles.deleteConfirmText}>Hisobni butunlay o‘chirish</LocalizedText>}
            </Pressable>
            <Pressable disabled={deletingAccount} onPress={() => setDeleteModalVisible(false)} style={styles.deleteCancel}>
              <LocalizedText style={[styles.deleteCancelText, { color: colors.text }]}>Bekor qilish</LocalizedText>
            </Pressable>
          </View>
        </View>
      </Modal>
    </Animated.ScrollView>
  );
}

const styles = StyleSheet.create({
  content: {
    paddingHorizontal: 20,
    paddingTop: 14,
    paddingBottom: 128,
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
    fontSize: 23,
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
    borderRadius: 21,
    borderWidth: 1,
    padding: 16,
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
    borderRadius: 18,
    borderWidth: 1,
    paddingHorizontal: 14,
    paddingVertical: 13,
    marginBottom: 9,
    gap: 12,
  },
  rowIcon: {
    width: 42,
    height: 42,
    borderRadius: 14,
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
  modalBackdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.62)', justifyContent: 'center', padding: 22 },
  deleteModal: { borderWidth: 1, borderRadius: 24, padding: 22 },
  deleteIcon: { width: 52, height: 52, borderRadius: 16, backgroundColor: 'rgba(239,68,68,0.12)', alignItems: 'center', justifyContent: 'center', marginBottom: 14 },
  deleteTitle: { fontSize: 20, fontWeight: '800', marginBottom: 9 },
  deleteDescription: { fontSize: 13, lineHeight: 20, marginBottom: 16 },
  deleteInput: { minHeight: 48, borderWidth: 1, borderRadius: 12, paddingHorizontal: 13, fontSize: 15 },
  deleteError: { color: '#EF4444', fontSize: 12, marginTop: 8 },
  deleteConfirm: { minHeight: 48, borderRadius: 12, backgroundColor: '#DC2626', alignItems: 'center', justifyContent: 'center', marginTop: 14 },
  deleteConfirmText: { color: '#FFFFFF', fontSize: 14, fontWeight: '800' },
  deleteCancel: { minHeight: 44, alignItems: 'center', justifyContent: 'center', marginTop: 6 },
  deleteCancelText: { fontSize: 14, fontWeight: '700' },
  securityInput: {
    minHeight: 48,
    borderRadius: 12,
    borderWidth: 1,
    paddingHorizontal: 13,
    fontSize: 14,
  },
  securityButton: {
    minHeight: 46,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 10,
  },
  securityButtonText: { color: '#FFFFFF', fontWeight: '700', fontSize: 14 },
  version: {
    fontSize: 11,
    textAlign: 'center',
    marginTop: 30,
  },
});
