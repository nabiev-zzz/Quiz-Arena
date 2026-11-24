import { LocalizedText, LocalizedTextInput, showLocalizedAlert } from '../../i18n/LocalizedText';
import { useState } from 'react';
import {
  ActivityIndicator, Alert, KeyboardAvoidingView, Platform, Pressable,
  ScrollView, StyleSheet, NativeText, NativeTextInput, View,
} from 'react-native';
import { useTheme } from '../../theme/ThemeContext';

type Mode = 'password' | 'forgot';

interface Props {
  onLogin: (username: string, password: string) => Promise<void>;
  onRegisterPress: () => void;
  onGoogleLogin: () => Promise<void>;
  onTelegramLogin: () => Promise<void>;
  onPasswordResetRequest: (email: string) => Promise<void>;
  onPasswordReset: (email: string, code: string, newPassword: string) => Promise<void>;
}

export default function LoginScreen({ onLogin, onRegisterPress, onGoogleLogin, onTelegramLogin, onPasswordResetRequest, onPasswordReset }: Props) {
  const { tokens } = useTheme();
  const colors = tokens.colors;
  const styles = makeStyles(colors);
  const [mode, setMode] = useState<Mode>('password');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [email, setEmail] = useState('');
  const [code, setCode] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [codeSent, setCodeSent] = useState(false);
  const [loading, setLoading] = useState(false);

  const run = async (action: () => Promise<void>, success?: string) => {
    try {
      setLoading(true);
      await action();
      if (success) showLocalizedAlert('QUIZ ARENA', success);
    } catch (error) {
      showLocalizedAlert('Xatolik', error instanceof Error ? error.message : 'Xatolik yuz berdi');
    } finally {
      setLoading(false);
    }
  };

  const sendResetCode = () => run(async () => {
    const cleanEmail = email.trim().toLowerCase();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(cleanEmail)) throw new Error('Email manzilini to‘g‘ri kiriting.');
    await onPasswordResetRequest(cleanEmail);
    setEmail(cleanEmail);
    setCodeSent(true);
  }, 'Agar email hisobga bog‘langan bo‘lsa, tiklash kodi yuborildi.');

  const submitReset = () => run(async () => {
    if (!/^\d{6}$/.test(code.trim())) throw new Error('6 xonali kodni kiriting.');
    if (newPassword.length < 8) throw new Error('Yangi parol kamida 8 ta belgidan iborat bo‘lsin.');
    await onPasswordReset(email.trim().toLowerCase(), code.trim(), newPassword);
    setMode('password');
    setCodeSent(false);
    setCode('');
    setNewPassword('');
  }, 'Parol yangilandi. Yangi parol bilan tizimga kiring.');

  return (
    <KeyboardAvoidingView style={styles.container} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
        <View style={styles.brandRow}>
          <View style={styles.brandMark}><LocalizedText style={styles.brandMarkText}>Q</LocalizedText></View>
          <View><LocalizedText style={styles.logo}>QUIZ ARENA</LocalizedText><LocalizedText style={styles.brandCaption}>BILIM · RAQOBAT · NATIJA</LocalizedText></View>
        </View>
        <View style={styles.hero}>
          <LocalizedText style={styles.eyebrow}>SIZNI QAYTA KO‘RGANIMIZDAN XURSANDMIZ</LocalizedText>
          <LocalizedText style={styles.title}>{mode === 'forgot' ? 'Parolni tiklash' : 'Xush kelibsiz!'}</LocalizedText>
          <LocalizedText style={styles.subtitle}>{mode === 'forgot' ? 'Email manzilingiz orqali parolingizni tiklang.' : 'Bilimlar maydoniga qayting.'}</LocalizedText>
        </View>
        <View style={styles.formCard}>
        {mode === 'password' ? (
          <>
            <LocalizedText style={styles.label}>Username</LocalizedText>
            <LocalizedTextInput style={styles.input} placeholder="Username kiriting" placeholderTextColor={colors.textMuted} selectionColor={colors.primary} value={username} onChangeText={setUsername} autoCapitalize="none" autoCorrect={false} autoComplete="username" returnKeyType="next" />
            <LocalizedText style={styles.label}>Parol</LocalizedText>
            <LocalizedTextInput style={styles.input} placeholder="Parolingizni kiriting" placeholderTextColor={colors.textMuted} selectionColor={colors.primary} value={password} onChangeText={setPassword} secureTextEntry autoCapitalize="none" autoComplete="current-password" returnKeyType="done" onSubmitEditing={() => void run(() => onLogin(username.trim(), password))} />
            <Pressable style={[styles.button, loading && styles.disabled]} disabled={loading} onPress={() => void run(() => onLogin(username.trim(), password))}>
              {loading ? <ActivityIndicator color="#FFFFFF" /> : <LocalizedText style={styles.buttonText}>Kirish</LocalizedText>}
            </Pressable>
            <Pressable style={styles.textButton} onPress={() => { setMode('forgot'); setCodeSent(false); setCode(''); }}>
              <LocalizedText style={styles.link}>Parolni unutdingizmi?</LocalizedText>
            </Pressable>
            <Pressable style={[styles.googleButton, loading && styles.disabled]} disabled={loading} onPress={() => void run(onGoogleLogin)}>
              <LocalizedText style={styles.googleButtonText}>G  Google orqali kirish</LocalizedText>
            </Pressable>
            <Pressable style={[styles.telegramButton, loading && styles.disabled]} disabled={loading} onPress={() => void run(onTelegramLogin)}>
              <LocalizedText style={styles.telegramButtonText}>✈  Telegram orqali kirish</LocalizedText>
            </Pressable>
          </>
        ) : (
          <>
            <LocalizedText style={styles.label}>Email manzili</LocalizedText>
            <LocalizedTextInput style={styles.input} placeholder="example@gmail.com" placeholderTextColor={colors.textMuted} selectionColor={colors.primary} value={email} onChangeText={value => { setEmail(value); setCodeSent(false); setCode(''); }} keyboardType="email-address" autoCapitalize="none" autoCorrect={false} autoComplete="email" />
            {!codeSent ? (
              <Pressable style={[styles.button, loading && styles.disabled]} disabled={loading} onPress={() => void sendResetCode()}>
                {loading ? <ActivityIndicator color="#FFFFFF" /> : <LocalizedText style={styles.buttonText}>Tiklash kodini yuborish</LocalizedText>}
              </Pressable>
            ) : (
              <>
                <LocalizedText style={styles.label}>Emailga kelgan 6 xonali kod</LocalizedText>
                <LocalizedTextInput style={styles.input} placeholder="000000" placeholderTextColor={colors.textMuted} selectionColor={colors.primary} value={code} onChangeText={setCode} keyboardType="number-pad" maxLength={6} />
                <LocalizedText style={styles.label}>Yangi parol</LocalizedText>
                <LocalizedTextInput style={styles.input} placeholder="Kamida 8 ta belgi" placeholderTextColor={colors.textMuted} selectionColor={colors.primary} value={newPassword} onChangeText={setNewPassword} secureTextEntry autoCapitalize="none" autoComplete="new-password" />
                <Pressable style={[styles.button, loading && styles.disabled]} disabled={loading} onPress={() => void submitReset()}>
                  {loading ? <ActivityIndicator color="#FFFFFF" /> : <LocalizedText style={styles.buttonText}>Parolni yangilash</LocalizedText>}
                </Pressable>
                <Pressable style={styles.textButton} onPress={() => void sendResetCode()}>
                  <LocalizedText style={styles.link}>Kodni qayta yuborish</LocalizedText>
                </Pressable>
              </>
            )}
            <Pressable style={styles.textButton} onPress={() => { setMode('password'); setCodeSent(false); setCode(''); }}>
              <LocalizedText style={styles.link}>Orqaga</LocalizedText>
            </Pressable>
          </>
        )}

        </View>
        <View style={styles.footer}>
          <LocalizedText style={styles.footerText}>Hisobingiz yo‘qmi? </LocalizedText>
          <Pressable onPress={onRegisterPress}><LocalizedText style={styles.link}>Ro‘yxatdan o‘tish</LocalizedText></Pressable>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

function makeStyles(colors: ReturnType<typeof useTheme>['tokens']['colors']) {
  return StyleSheet.create({
    container: { flex: 1, backgroundColor: colors.background },
    content: { flexGrow: 1, justifyContent: 'center', paddingHorizontal: 22, paddingVertical: 28 },
    brandRow: { flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 30 },
    brandMark: { width: 42, height: 42, borderRadius: 15, backgroundColor: colors.primary, alignItems: 'center', justifyContent: 'center' },
    brandMarkText: { color: '#FFFFFF', fontSize: 23, fontWeight: '800' },
    logo: { color: colors.text, fontSize: 13, fontWeight: '800', letterSpacing: 3 },
    brandCaption: { color: colors.textMuted, fontSize: 9, letterSpacing: 1.4, marginTop: 3 },
    hero: { marginBottom: 22 },
    eyebrow: { color: colors.primary, fontSize: 9, fontWeight: '800', letterSpacing: 1.5, marginBottom: 10 },
    title: { color: colors.text, fontSize: 29, fontWeight: '800', letterSpacing: -0.7 },
    subtitle: { color: colors.textMuted, fontSize: 14, marginTop: 8, lineHeight: 21 },
    formCard: { backgroundColor: colors.surfaceGlass, borderWidth: 1, borderColor: colors.glassBorder, borderRadius: 26, padding: 18 },
    label: { color: colors.textSecondary, fontSize: 12, fontWeight: '700', marginBottom: 8, marginTop: 13 },
    input: { height: 52, borderRadius: 15, backgroundColor: colors.inputBackground, borderWidth: 1, borderColor: colors.border, paddingHorizontal: 15, color: colors.text, fontSize: 15 },
    button: { height: 52, backgroundColor: colors.primary, borderRadius: 16, alignItems: 'center', justifyContent: 'center', marginTop: 22 },
    disabled: { opacity: 0.55 },
    buttonText: { color: '#FFFFFF', fontSize: 15, fontWeight: '800' },
    googleButton: { height: 50, borderRadius: 15, borderWidth: 1, borderColor: colors.borderStrong, backgroundColor: colors.surfaceElevated, alignItems: 'center', justifyContent: 'center', marginTop: 11 },
    googleButtonText: { color: colors.text, fontSize: 14, fontWeight: '700' },
    telegramButton: { height: 50, borderRadius: 15, borderWidth: 1, borderColor: 'rgba(40, 160, 220, 0.35)', backgroundColor: 'rgba(35, 150, 210, 0.10)', alignItems: 'center', justifyContent: 'center', marginTop: 9 },
    telegramButtonText: { color: colors.text, fontSize: 14, fontWeight: '700' },
    textButton: { alignSelf: 'center', paddingVertical: 10 },
    footer: { flexDirection: 'row', justifyContent: 'center', marginTop: 20 },
    footerText: { color: colors.textMuted, fontSize: 13 },
    link: { color: colors.primary, fontSize: 13, fontWeight: '800' },
  });
}
