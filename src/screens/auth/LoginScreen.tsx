import { useState } from 'react';
import {
  ActivityIndicator, Alert, KeyboardAvoidingView, Platform, Pressable,
  ScrollView, StyleSheet, Text, TextInput, View,
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
      if (success) Alert.alert('QUIZ ARENA', success);
    } catch (error) {
      Alert.alert('Xatolik', error instanceof Error ? error.message : 'Xatolik yuz berdi');
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
        <Text style={styles.logo}>QUIZ ARENA</Text>
        <Text style={styles.title}>{mode === 'forgot' ? 'Parolni tiklash' : 'Xush kelibsiz!'}</Text>
        <Text style={styles.subtitle}>{mode === 'forgot' ? 'Email manzilingiz orqali parolingizni tiklang.' : 'Bilimlar maydoniga qayting.'}</Text>

        {mode === 'password' ? (
          <>
            <Text style={styles.label}>Username</Text>
            <TextInput style={styles.input} placeholder="Username kiriting" placeholderTextColor={colors.textMuted} selectionColor={colors.primary} value={username} onChangeText={setUsername} autoCapitalize="none" autoCorrect={false} autoComplete="username" returnKeyType="next" />
            <Text style={styles.label}>Parol</Text>
            <TextInput style={styles.input} placeholder="Parolingizni kiriting" placeholderTextColor={colors.textMuted} selectionColor={colors.primary} value={password} onChangeText={setPassword} secureTextEntry autoCapitalize="none" autoComplete="current-password" returnKeyType="done" onSubmitEditing={() => void run(() => onLogin(username.trim(), password))} />
            <Pressable style={[styles.button, loading && styles.disabled]} disabled={loading} onPress={() => void run(() => onLogin(username.trim(), password))}>
              {loading ? <ActivityIndicator color="#FFFFFF" /> : <Text style={styles.buttonText}>Kirish</Text>}
            </Pressable>
            <Pressable style={styles.textButton} onPress={() => { setMode('forgot'); setCodeSent(false); setCode(''); }}>
              <Text style={styles.link}>Parolni unutdingizmi?</Text>
            </Pressable>
            <Pressable style={[styles.googleButton, loading && styles.disabled]} disabled={loading} onPress={() => void run(onGoogleLogin)}>
              <Text style={styles.googleButtonText}>G  Google orqali kirish</Text>
            </Pressable>
            <Pressable style={[styles.telegramButton, loading && styles.disabled]} disabled={loading} onPress={() => void run(onTelegramLogin)}>
              <Text style={styles.telegramButtonText}>✈  Telegram orqali kirish</Text>
            </Pressable>
          </>
        ) : (
          <>
            <Text style={styles.label}>Email manzili</Text>
            <TextInput style={styles.input} placeholder="example@gmail.com" placeholderTextColor={colors.textMuted} selectionColor={colors.primary} value={email} onChangeText={value => { setEmail(value); setCodeSent(false); setCode(''); }} keyboardType="email-address" autoCapitalize="none" autoCorrect={false} autoComplete="email" />
            {!codeSent ? (
              <Pressable style={[styles.button, loading && styles.disabled]} disabled={loading} onPress={() => void sendResetCode()}>
                {loading ? <ActivityIndicator color="#FFFFFF" /> : <Text style={styles.buttonText}>Tiklash kodini yuborish</Text>}
              </Pressable>
            ) : (
              <>
                <Text style={styles.label}>Emailga kelgan 6 xonali kod</Text>
                <TextInput style={styles.input} placeholder="000000" placeholderTextColor={colors.textMuted} selectionColor={colors.primary} value={code} onChangeText={setCode} keyboardType="number-pad" maxLength={6} />
                <Text style={styles.label}>Yangi parol</Text>
                <TextInput style={styles.input} placeholder="Kamida 8 ta belgi" placeholderTextColor={colors.textMuted} selectionColor={colors.primary} value={newPassword} onChangeText={setNewPassword} secureTextEntry autoCapitalize="none" autoComplete="new-password" />
                <Pressable style={[styles.button, loading && styles.disabled]} disabled={loading} onPress={() => void submitReset()}>
                  {loading ? <ActivityIndicator color="#FFFFFF" /> : <Text style={styles.buttonText}>Parolni yangilash</Text>}
                </Pressable>
                <Pressable style={styles.textButton} onPress={() => void sendResetCode()}>
                  <Text style={styles.link}>Kodni qayta yuborish</Text>
                </Pressable>
              </>
            )}
            <Pressable style={styles.textButton} onPress={() => { setMode('password'); setCodeSent(false); setCode(''); }}>
              <Text style={styles.link}>Orqaga</Text>
            </Pressable>
          </>
        )}

        <View style={styles.footer}>
          <Text style={styles.footerText}>Hisobingiz yo‘qmi? </Text>
          <Pressable onPress={onRegisterPress}><Text style={styles.link}>Ro‘yxatdan o‘tish</Text></Pressable>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

function makeStyles(colors: ReturnType<typeof useTheme>['tokens']['colors']) {
  return StyleSheet.create({
    container: { flex: 1, backgroundColor: colors.background },
    content: { flexGrow: 1, justifyContent: 'center', paddingHorizontal: 25, paddingVertical: 35 },
    logo: { color: colors.primary, fontSize: 13, fontWeight: 'bold', letterSpacing: 4, marginBottom: 35 },
    title: { color: colors.text, fontSize: 30, fontWeight: 'bold' },
    subtitle: { color: colors.textMuted, fontSize: 14, marginTop: 9, marginBottom: 25, lineHeight: 21 },
    label: { color: colors.textSecondary, fontSize: 13, marginBottom: 9, marginTop: 15 },
    input: { height: 54, borderRadius: 14, backgroundColor: colors.inputBackground, borderWidth: 1, borderColor: colors.border, paddingHorizontal: 16, color: colors.text, fontSize: 15 },
    button: { height: 54, backgroundColor: '#7657E8', borderRadius: 14, alignItems: 'center', justifyContent: 'center', marginTop: 24 },
    disabled: { opacity: 0.6 },
    buttonText: { color: '#FFFFFF', fontSize: 16, fontWeight: 'bold' },
    googleButton: { height: 52, borderRadius: 14, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surfaceGlass, alignItems: 'center', justifyContent: 'center', marginTop: 12 },
    googleButtonText: { color: colors.text, fontSize: 15, fontWeight: '600' },
    telegramButton: { height: 52, borderRadius: 14, borderWidth: 1, borderColor: 'rgba(40, 160, 220, 0.45)', backgroundColor: 'rgba(35, 150, 210, 0.12)', alignItems: 'center', justifyContent: 'center', marginTop: 10 },
    telegramButtonText: { color: colors.text, fontSize: 15, fontWeight: '600' },
    textButton: { alignSelf: 'center', paddingVertical: 11 },
    footer: { flexDirection: 'row', justifyContent: 'center', marginTop: 22 },
    footerText: { color: colors.textMuted, fontSize: 13 },
    link: { color: colors.primary, fontSize: 13, fontWeight: 'bold' },
  });
}
