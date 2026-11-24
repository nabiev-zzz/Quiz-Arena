import { useState } from 'react';
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

type Mode = 'password' | 'phone' | 'forgot';

interface Props {
  onLogin: (username: string, password: string) => Promise<void>;
  onRegisterPress: () => void;
  onGoogleLogin: () => Promise<void>;
  onPhoneOtpRequest: (phoneNumber: string) => Promise<void>;
  onPhoneLogin: (phoneNumber: string, code: string) => Promise<void>;
  onPasswordResetRequest: (phoneNumber: string) => Promise<void>;
  onPasswordReset: (phoneNumber: string, code: string, newPassword: string) => Promise<void>;
}

export default function LoginScreen({
  onLogin,
  onRegisterPress,
  onGoogleLogin,
  onPhoneOtpRequest,
  onPhoneLogin,
  onPasswordResetRequest,
  onPasswordReset,
}: Props) {
  const { tokens } = useTheme();
  const colors = tokens.colors;
  const styles = makeStyles(colors);
  const [mode, setMode] = useState<Mode>('password');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [phoneNumber, setPhoneNumber] = useState('+998');
  const [code, setCode] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [otpSent, setOtpSent] = useState(false);
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

  const sendCode = () => run(async () => {
    if (!/^\+?998\d{9}$/.test(phoneNumber.replace(/[\s()-]/g, ''))) {
      throw new Error('Telefon raqamni +998XXXXXXXXX formatida kiriting.');
    }
    if (mode === 'phone') await onPhoneOtpRequest(phoneNumber);
    else await onPasswordResetRequest(phoneNumber);
    setOtpSent(true);
  }, 'Tasdiqlash kodi yuborildi.');

  const submitPhone = () => run(() => onPhoneLogin(phoneNumber, code.trim()));

  const submitReset = () => run(async () => {
    if (newPassword.length < 8) throw new Error('Yangi parol kamida 8 ta belgidan iborat bo‘lsin.');
    await onPasswordReset(phoneNumber, code.trim(), newPassword);
    setMode('password');
    setOtpSent(false);
    setCode('');
    setNewPassword('');
  }, 'Parol yangilandi. Yangi parol bilan tizimga kiring.');

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
        <Text style={styles.logo}>QUIZ ARENA</Text>
        <Text style={styles.title}>
          {mode === 'forgot' ? 'Parolni tiklash' : mode === 'phone' ? 'Telefon orqali kirish' : 'Xush kelibsiz!'}
        </Text>
        <Text style={styles.subtitle}>
          {mode === 'forgot' ? 'Telefon raqamingizni tasdiqlab, yangi parol yarating.' : 'Bilimlar maydoniga qayting.'}
        </Text>

        {mode === 'password' ? (
          <>
            <Text style={styles.label}>Username</Text>
            <TextInput style={styles.input} placeholder="Username kiriting" placeholderTextColor={colors.textMuted} selectionColor={colors.primary} value={username} onChangeText={setUsername} autoCapitalize="none" autoCorrect={false} autoComplete="username" returnKeyType="next" />
            <Text style={styles.label}>Parol</Text>
            <TextInput style={styles.input} placeholder="Parolingizni kiriting" placeholderTextColor={colors.textMuted} selectionColor={colors.primary} value={password} onChangeText={setPassword} secureTextEntry autoCapitalize="none" autoComplete="current-password" returnKeyType="done" onSubmitEditing={() => void run(() => onLogin(username.trim(), password))} />
            <Pressable style={[styles.button, loading && styles.disabled]} disabled={loading} onPress={() => void run(() => onLogin(username.trim(), password))}>
              {loading ? <ActivityIndicator color="#FFFFFF" /> : <Text style={styles.buttonText}>Kirish</Text>}
            </Pressable>
            <Pressable style={styles.textButton} onPress={() => { setMode('phone'); setOtpSent(false); setCode(''); }}>
              <Text style={styles.link}>Telefon raqami orqali kirish</Text>
            </Pressable>
            <Pressable style={styles.textButton} onPress={() => { setMode('forgot'); setOtpSent(false); setCode(''); }}>
              <Text style={styles.link}>Parolni unutdingizmi?</Text>
            </Pressable>
            <Pressable style={[styles.googleButton, loading && styles.disabled]} disabled={loading} onPress={() => void run(onGoogleLogin)}>
              <Text style={styles.googleButtonText}>G  Google orqali kirish</Text>
            </Pressable>
          </>
        ) : (
          <>
            <Text style={styles.label}>Telefon raqami</Text>
            <TextInput style={styles.input} placeholder="+998 90 123 45 67" placeholderTextColor={colors.textMuted} selectionColor={colors.primary} value={phoneNumber} onChangeText={setPhoneNumber} keyboardType="phone-pad" autoComplete="tel" />
            {!otpSent ? (
              <Pressable style={[styles.button, loading && styles.disabled]} disabled={loading} onPress={() => void sendCode()}>
                {loading ? <ActivityIndicator color="#FFFFFF" /> : <Text style={styles.buttonText}>SMS kod yuborish</Text>}
              </Pressable>
            ) : (
              <>
                <Text style={styles.label}>SMS tasdiqlash kodi</Text>
                <TextInput style={styles.input} placeholder="6 xonali kod" placeholderTextColor={colors.textMuted} selectionColor={colors.primary} value={code} onChangeText={setCode} keyboardType="number-pad" maxLength={6} />
                {mode === 'forgot' && (
                  <>
                    <Text style={styles.label}>Yangi parol</Text>
                    <TextInput style={styles.input} placeholder="Kamida 8 ta belgi" placeholderTextColor={colors.textMuted} selectionColor={colors.primary} value={newPassword} onChangeText={setNewPassword} secureTextEntry autoCapitalize="none" />
                  </>
                )}
                <Pressable style={[styles.button, loading && styles.disabled]} disabled={loading} onPress={() => void (mode === 'phone' ? submitPhone() : submitReset())}>
                  {loading ? <ActivityIndicator color="#FFFFFF" /> : <Text style={styles.buttonText}>{mode === 'phone' ? 'Tasdiqlash va kirish' : 'Parolni yangilash'}</Text>}
                </Pressable>
                <Pressable style={styles.textButton} onPress={() => { setOtpSent(false); setCode(''); }}>
                  <Text style={styles.link}>Kodni qayta yuborish</Text>
                </Pressable>
              </>
            )}
            <Pressable style={styles.textButton} onPress={() => { setMode('password'); setOtpSent(false); setCode(''); }}>
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
    textButton: { alignSelf: 'center', paddingVertical: 11 },
    footer: { flexDirection: 'row', justifyContent: 'center', marginTop: 22 },
    footerText: { color: colors.textMuted, fontSize: 13 },
    link: { color: colors.primary, fontSize: 13, fontWeight: 'bold' },
  });
}
