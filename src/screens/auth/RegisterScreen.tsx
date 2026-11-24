import { useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useTheme } from '../../theme/ThemeContext';

interface Props {
  onRegister: (input: {
    displayName: string;
    username: string;
    email?: string;
    password: string;
  }) => Promise<void>;
  onLoginPress: () => void;
}

export default function RegisterScreen({ onRegister, onLoginPress }: Props) {
  const { tokens, isDark } = useTheme();
  const colors = tokens.colors;
  const styles = useMemo(() => makeStyles(colors, isDark), [colors, isDark]);
  const [displayName, setDisplayName] = useState('');
  const [username, setUsername] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [loading, setLoading] = useState(false);

  const passwordStrength = password.length === 0
    ? 0
    : Math.min(4, Number(password.length >= 8) + Number(/[A-Z]/.test(password)) + Number(/[0-9]/.test(password)) + Number(/[^A-Za-z0-9]/.test(password)));
  const strengthLabel = ['', 'Zaif', 'O‘rtacha', 'Yaxshi', 'Kuchli'][passwordStrength];
  const strengthColor = passwordStrength <= 1 ? colors.danger : passwordStrength === 2 ? colors.warning : colors.success;

  const handleRegister = async () => {
    const cleanName = displayName.trim();
    const cleanUsername = username.trim().toLowerCase();
    const cleanEmail = email.trim().toLowerCase();
    if (cleanName.length < 2) return Alert.alert('Ism xatosi', 'Ism kamida 2 ta belgidan iborat bo‘lsin.');
    if (!/^[a-zA-Z0-9_]{3,30}$/.test(cleanUsername)) return Alert.alert('Username xatosi', 'Username 3–30 ta belgi bo‘lsin. Lotin harflari, raqamlar va _ ishlating.');
    if (cleanEmail && !/^[^\\s@]+@[^\\s@]+\\.[^\\s@]+$/.test(cleanEmail)) return Alert.alert('Email xatosi', 'Email manzilini to‘g‘ri kiriting.');
    if (password.length < 8) return Alert.alert('Parol xatosi', 'Parol kamida 8 ta belgidan iborat bo‘lsin.');
    if (password !== confirmPassword) return Alert.alert('Parol xatosi', 'Kiritilgan parollar bir xil emas.');
    try {
      setLoading(true);
      await onRegister({
        displayName: cleanName,
        username: cleanUsername,
        ...(cleanEmail ? { email: cleanEmail } : {}),
        password,
      });
    } catch (error) {
      Alert.alert('Ro‘yxatdan o‘tish amalga oshmadi', error instanceof Error ? error.message : 'Xatolik yuz berdi');
    } finally {
      setLoading(false);
    }
  };

  return (
    <View style={styles.screen}>
      {/* Static backdrop: it stays behind the scrolling form and never participates in scroll gestures. */}
      <View pointerEvents="none" style={styles.fixedBackdrop}>
        <View style={styles.orbTop} />
        <View style={styles.orbBottom} />
        <View style={styles.backdropGlow} />
      </View>

      <KeyboardAvoidingView
        style={styles.keyboardLayer}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      >
        <ScrollView
          contentContainerStyle={styles.scrollContent}
          keyboardShouldPersistTaps="handled"
          keyboardDismissMode="on-drag"
          showsVerticalScrollIndicator={false}
        >
          <View style={styles.header}>
            <View style={styles.brandMark}>
              <Text style={styles.brandMarkText}>Q</Text>
            </View>
            <Text style={styles.logo}>QUIZ ARENA</Text>
            <Text style={styles.eyebrow}>BILIM. RAQOBAT. NATIJA.</Text>
          </View>

          <View style={styles.glassCard}>
            <View style={styles.cardTopLine} />
            <Text style={styles.title}>O‘z hisobingni yarat</Text>
            <Text style={styles.subtitle}>Bilimlar maydoniga qo‘shilish uchun bir necha qadam kifoya.</Text>

            <Text style={styles.label}>Ism va familiya</Text>
            <TextInput
              style={styles.input}
              placeholder="Masalan: Ali Valiyev"
              placeholderTextColor={colors.textMuted}
              selectionColor={colors.primary}
              value={displayName}
              onChangeText={setDisplayName}
              maxLength={100}
              autoCapitalize="words"
              returnKeyType="next"
            />

            <Text style={styles.label}>Username</Text>
            <TextInput
              style={styles.input}
              placeholder="Masalan: ali_2026"
              placeholderTextColor={colors.textMuted}
              selectionColor={colors.primary}
              value={username}
              onChangeText={setUsername}
              autoCapitalize="none"
              autoCorrect={false}
              autoComplete="username"
              maxLength={30}
              returnKeyType="next"
            />
            <Text style={styles.helper}>3–30 belgi · lotin harflari, raqamlar va _</Text>

            <View style={styles.labelRow}>
              <Text style={styles.label}>Email</Text>
              <Text style={styles.optional}>IXTIYORIY</Text>
            </View>
            <TextInput
              style={styles.input}
              placeholder="example@gmail.com"
              placeholderTextColor={colors.textMuted}
              selectionColor={colors.primary}
              value={email}
              onChangeText={setEmail}
              keyboardType="email-address"
              autoCapitalize="none"
              autoCorrect={false}
              autoComplete="email"
              returnKeyType="next"
            />

            <Text style={styles.label}>Parol</Text>
            <View style={styles.passwordWrap}>
              <TextInput
                style={styles.passwordInput}
                placeholder="Kamida 8 ta belgi"
                placeholderTextColor={colors.textMuted}
                selectionColor={colors.primary}
                value={password}
                onChangeText={setPassword}
                secureTextEntry={!showPassword}
                autoCapitalize="none"
                autoComplete="new-password"
                returnKeyType="next"
              />
              <Pressable accessibilityRole="button" accessibilityLabel={showPassword ? 'Parolni yashirish' : 'Parolni ko‘rsatish'} hitSlop={10} onPress={() => setShowPassword(value => !value)}>
                <Text style={styles.revealText}>{showPassword ? 'YASHIR' : 'KO‘R'}</Text>
              </Pressable>
            </View>

            {password.length > 0 && (
              <View style={styles.strengthBlock}>
                <View style={styles.strengthTrack}>
                  {[1, 2, 3, 4].map(step => (
                    <View key={step} style={[styles.strengthSegment, step <= passwordStrength && { backgroundColor: strengthColor }]} />
                  ))}
                </View>
                <Text style={[styles.strengthLabel, { color: strengthColor }]}>{strengthLabel} parol</Text>
              </View>
            )}

            <Text style={styles.label}>Parolni takrorlang</Text>
            <View style={styles.passwordWrap}>
              <TextInput
                style={styles.passwordInput}
                placeholder="Parolni qayta kiriting"
                placeholderTextColor={colors.textMuted}
                selectionColor={colors.primary}
                value={confirmPassword}
                onChangeText={setConfirmPassword}
                secureTextEntry={!showConfirmPassword}
                autoCapitalize="none"
                returnKeyType="done"
                onSubmitEditing={() => void handleRegister()}
              />
              <Pressable accessibilityRole="button" accessibilityLabel={showConfirmPassword ? 'Parolni yashirish' : 'Parolni ko‘rsatish'} hitSlop={10} onPress={() => setShowConfirmPassword(value => !value)}>
                <Text style={styles.revealText}>{showConfirmPassword ? 'YASHIR' : 'KO‘R'}</Text>
              </Pressable>
            </View>
            {confirmPassword.length > 0 && (
              <Text style={[styles.matchText, { color: password === confirmPassword ? colors.success : colors.danger }]}>
                {password === confirmPassword ? 'Parollar mos' : 'Parollar mos emas'}
              </Text>
            )}

            <Pressable
              style={({ pressed }) => [styles.button, loading && styles.disabled, pressed && !loading && styles.buttonPressed]}
              onPress={() => void handleRegister()}
              disabled={loading}
              accessibilityRole="button"
            >
              {loading ? <ActivityIndicator color="#FFFFFF" /> : <Text style={styles.buttonText}>Akkaunt yaratish</Text>}
            </Pressable>

            <Text style={styles.privacyNote}>Email tasdiqlash kodi talab qilinmaydi.</Text>
          </View>

          <View style={styles.footer}>
            <Text style={styles.footerText}>Akkauntingiz bormi? </Text>
            <Pressable onPress={onLoginPress} hitSlop={8}>
              <Text style={styles.link}>Kirish</Text>
            </Pressable>
          </View>
          <Text style={styles.bottomNote}>QUIZ ARENA  ·  BARCHA HUQUQLAR HIMOYALANGAN</Text>
        </ScrollView>
      </KeyboardAvoidingView>
    </View>
  );
}

function makeStyles(colors: ReturnType<typeof useTheme>['tokens']['colors'], isDark: boolean) {
  return StyleSheet.create({
    screen: { flex: 1, backgroundColor: colors.background },
    fixedBackdrop: { ...StyleSheet.absoluteFillObject, overflow: 'hidden' },
    orbTop: {
      position: 'absolute', width: 290, height: 290, borderRadius: 145,
      top: -135, right: -105, backgroundColor: isDark ? 'rgba(125, 95, 255, 0.20)' : 'rgba(125, 95, 255, 0.13)',
    },
    orbBottom: {
      position: 'absolute', width: 250, height: 250, borderRadius: 125,
      bottom: -95, left: -120, backgroundColor: isDark ? 'rgba(43, 180, 197, 0.12)' : 'rgba(43, 180, 197, 0.10)',
    },
    backdropGlow: {
      position: 'absolute', width: 190, height: 190, borderRadius: 95,
      top: '42%', right: -135, backgroundColor: isDark ? 'rgba(124, 103, 232, 0.09)' : 'rgba(124, 103, 232, 0.07)',
    },
    keyboardLayer: { flex: 1 },
    scrollContent: { flexGrow: 1, justifyContent: 'center', paddingHorizontal: 22, paddingTop: 26, paddingBottom: 28 },
    header: { alignItems: 'center', marginBottom: 22 },
    brandMark: {
      width: 42, height: 42, borderRadius: 15, alignItems: 'center', justifyContent: 'center',
      backgroundColor: colors.primary, marginBottom: 10, shadowColor: colors.primary,
      shadowOpacity: isDark ? 0.32 : 0.18, shadowRadius: 16, shadowOffset: { width: 0, height: 6 }, elevation: 5,
    },
    brandMarkText: { color: '#FFFFFF', fontSize: 25, fontWeight: '800', lineHeight: 29 },
    logo: { color: colors.text, fontSize: 13, fontWeight: '800', letterSpacing: 3.5 },
    eyebrow: { color: colors.textMuted, fontSize: 9, letterSpacing: 2.2, marginTop: 7 },
    glassCard: {
      overflow: 'hidden', borderRadius: 27, padding: 21,
      backgroundColor: colors.surfaceGlass, borderWidth: 1, borderColor: colors.glassBorder,
      shadowColor: '#000000', shadowOpacity: isDark ? 0.22 : 0.07, shadowRadius: 28,
      shadowOffset: { width: 0, height: 14 }, elevation: 8,
    },
    cardTopLine: { height: 1, backgroundColor: isDark ? 'rgba(255,255,255,0.24)' : 'rgba(255,255,255,0.95)', marginTop: -21, marginHorizontal: -21, marginBottom: 21 },
    title: { color: colors.text, fontSize: 25, fontWeight: '800', letterSpacing: -0.6 },
    subtitle: { color: colors.textMuted, fontSize: 13, lineHeight: 19, marginTop: 7, marginBottom: 14 },
    label: { color: colors.textSecondary, fontSize: 12, fontWeight: '600', marginTop: 15, marginBottom: 8 },
    labelRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
    optional: { color: colors.textMuted, fontSize: 9, letterSpacing: 1.2, marginTop: 15, marginBottom: 8 },
    input: {
      minHeight: 50, borderRadius: 14, backgroundColor: colors.inputBackground,
      borderWidth: 1, borderColor: colors.border, paddingHorizontal: 14,
      color: colors.text, fontSize: 14,
    },
    helper: { color: colors.textMuted, fontSize: 10, marginTop: 6, marginLeft: 2 },
    passwordWrap: {
      minHeight: 50, flexDirection: 'row', alignItems: 'center', borderRadius: 14,
      backgroundColor: colors.inputBackground, borderWidth: 1, borderColor: colors.border,
      paddingLeft: 14, paddingRight: 13,
    },
    passwordInput: { flex: 1, minHeight: 48, color: colors.text, fontSize: 14, paddingVertical: 0 },
    revealText: { color: colors.primary, fontSize: 9, fontWeight: '800', letterSpacing: 0.8, paddingLeft: 10 },
    strengthBlock: { flexDirection: 'row', alignItems: 'center', gap: 10, marginTop: 8 },
    strengthTrack: { flex: 1, flexDirection: 'row', gap: 4 },
    strengthSegment: { flex: 1, height: 4, borderRadius: 3, backgroundColor: colors.border },
    strengthLabel: { fontSize: 10, fontWeight: '700' },
    matchText: { fontSize: 10, marginTop: 6, marginLeft: 2 },
    button: {
      minHeight: 52, borderRadius: 15, backgroundColor: colors.primary,
      alignItems: 'center', justifyContent: 'center', marginTop: 23,
      shadowColor: colors.primary, shadowOpacity: isDark ? 0.28 : 0.16,
      shadowRadius: 15, shadowOffset: { width: 0, height: 7 }, elevation: 5,
    },
    buttonPressed: { opacity: 0.88, transform: [{ scale: 0.985 }] },
    buttonText: { color: '#FFFFFF', fontSize: 14, fontWeight: '800', letterSpacing: 0.2 },
    disabled: { opacity: 0.58 },
    privacyNote: { color: colors.textMuted, fontSize: 10, textAlign: 'center', marginTop: 12 },
    footer: { flexDirection: 'row', justifyContent: 'center', alignItems: 'center', marginTop: 22 },
    footerText: { color: colors.textMuted, fontSize: 12 },
    link: { color: colors.primary, fontSize: 12, fontWeight: '800' },
    bottomNote: { color: colors.textMuted, fontSize: 8, letterSpacing: 1.1, textAlign: 'center', marginTop: 22, opacity: 0.7 },
  });
}
