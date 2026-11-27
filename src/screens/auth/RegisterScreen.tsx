import { LocalizedText, LocalizedTextInput, showLocalizedAlert } from '../../i18n/LocalizedText';
import { useState } from 'react';
import {
  ActivityIndicator, Alert, KeyboardAvoidingView, Platform, Pressable,
  ScrollView, StyleSheet, Text as NativeText, TextInput as NativeTextInput, View,
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
  const { tokens } = useTheme();
  const colors = tokens.colors;
  const styles = makeStyles(colors);
  const [displayName, setDisplayName] = useState('');
  const [username, setUsername] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);

  const handleRegister = async () => {
    const cleanName = displayName.trim();
    const cleanUsername = username.trim().toLowerCase();
    const cleanEmail = email.trim().toLowerCase();
    if (cleanName.length < 2) return showLocalizedAlert('Ism xatosi', 'Ism kamida 2 ta belgidan iborat bo‘lsin.');
    if (!/^[a-zA-Z0-9_]{3,30}$/.test(cleanUsername)) return showLocalizedAlert('Username xatosi', 'Username 3–30 ta belgi bo‘lsin. Lotin harflari, raqamlar va _ ishlating.');
    if (cleanEmail && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(cleanEmail)) return showLocalizedAlert('Email xatosi', 'Email manzilini to‘g‘ri kiriting.');
    if (password.length < 8) return showLocalizedAlert('Parol xatosi', 'Parol kamida 8 ta belgidan iborat bo‘lsin.');
    if (password !== confirmPassword) return showLocalizedAlert('Parol xatosi', 'Kiritilgan parollar bir xil emas.');
    try {
      setLoading(true);
      await onRegister({
        displayName: cleanName,
        username: cleanUsername,
        ...(cleanEmail ? { email: cleanEmail } : {}),
        password,
      });
    } catch (error) {
      showLocalizedAlert('Ro‘yxatdan o‘tish amalga oshmadi', error instanceof Error ? error.message : 'Xatolik yuz berdi');
    } finally {
      setLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView style={styles.container} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled" keyboardDismissMode="on-drag" showsVerticalScrollIndicator={false}>
        <View style={styles.brandRow}>
          <View style={styles.brandMark}><LocalizedText style={styles.brandMarkText}>Z</LocalizedText></View>
          <View><LocalizedText style={styles.logo}>ZELQEN CORE</LocalizedText><LocalizedText style={styles.brandCaption}>BILIM · RAQOBAT · NATIJA</LocalizedText></View>
        </View>
        <View style={styles.hero}>
          <LocalizedText style={styles.eyebrow}>YANGI IMKONIYATLAR SARI</LocalizedText>
          <LocalizedText style={styles.title}>Hisob yaratish</LocalizedText>
          <LocalizedText style={styles.subtitle}>O‘z hisobingizni yarating va bilimlar maydoniga qo‘shiling.</LocalizedText>
        </View>
        <View style={styles.formCard}>
        <LocalizedText style={styles.label}>Ism va familiya *</LocalizedText>
        <LocalizedTextInput style={styles.input} placeholder="Masalan: Ali Valiyev" placeholderTextColor={colors.textMuted} selectionColor={colors.primary} value={displayName} onChangeText={setDisplayName} maxLength={100} autoCapitalize="words" returnKeyType="next" />

        <LocalizedText style={styles.label}>Username *</LocalizedText>
        <LocalizedTextInput style={styles.input} placeholder="Masalan: ali_2026" placeholderTextColor={colors.textMuted} selectionColor={colors.primary} value={username} onChangeText={setUsername} autoCapitalize="none" autoCorrect={false} autoComplete="username" maxLength={30} returnKeyType="next" />

        <LocalizedText style={styles.label}>Email (ixtiyoriy)</LocalizedText>
        <LocalizedTextInput style={styles.input} placeholder="example@gmail.com" placeholderTextColor={colors.textMuted} selectionColor={colors.primary} value={email} onChangeText={setEmail} keyboardType="email-address" autoCapitalize="none" autoCorrect={false} autoComplete="email" returnKeyType="next" />

        <LocalizedText style={styles.label}>Parol *</LocalizedText>
        <LocalizedTextInput style={styles.input} placeholder="Kamida 8 ta belgi" placeholderTextColor={colors.textMuted} selectionColor={colors.primary} value={password} onChangeText={setPassword} secureTextEntry autoCapitalize="none" autoComplete="new-password" returnKeyType="next" />

        <LocalizedText style={styles.label}>Parolni tasdiqlang *</LocalizedText>
        <LocalizedTextInput style={styles.input} placeholder="Parolni qayta kiriting" placeholderTextColor={colors.textMuted} selectionColor={colors.primary} value={confirmPassword} onChangeText={setConfirmPassword} secureTextEntry autoCapitalize="none" returnKeyType="done" onSubmitEditing={() => void handleRegister()} />

        <Pressable style={[styles.button, loading && styles.disabled]} onPress={() => void handleRegister()} disabled={loading}>
          {loading ? <ActivityIndicator color="#FFFFFF" /> : <LocalizedText style={styles.buttonText}>Hisob yaratish</LocalizedText>}
        </Pressable>

        </View>
        <View style={styles.footer}>
          <LocalizedText style={styles.footerText}>Hisobingiz bormi? </LocalizedText>
          <Pressable onPress={onLoginPress}><LocalizedText style={styles.link}>Kirish</LocalizedText></Pressable>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

function makeStyles(colors: ReturnType<typeof useTheme>['tokens']['colors']) {
  return StyleSheet.create({
    container: { flex: 1, backgroundColor: 'transparent' },
    content: { flexGrow: 1, justifyContent: 'center', paddingHorizontal: 24, paddingVertical: 30 },
    brandRow: { flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 26 },
    brandMark: { width: 42, height: 42, borderRadius: 15, backgroundColor: colors.primary, alignItems: 'center', justifyContent: 'center' },
    brandMarkText: { color: '#FFFFFF', fontSize: 23, fontWeight: '800' },
    logo: { color: colors.text, fontSize: 13, fontWeight: '800', letterSpacing: 3 },
    brandCaption: { color: colors.textMuted, fontSize: 9, letterSpacing: 1.4, marginTop: 3 },
    hero: { marginBottom: 18 },
    eyebrow: { color: colors.primary, fontSize: 9, fontWeight: '800', letterSpacing: 1.5, marginBottom: 9 },
    title: { color: colors.text, fontSize: 28, fontWeight: '800', letterSpacing: -0.6 },
    subtitle: { color: colors.textMuted, fontSize: 13, marginTop: 8, lineHeight: 19 },
    formCard: { backgroundColor: colors.surfaceGlass, borderWidth: 1, borderColor: colors.glassBorder, borderRadius: 28, padding: 22 },
    label: { color: colors.textSecondary, fontSize: 12, fontWeight: '700', marginBottom: 7, marginTop: 11 },
    input: { height: 54, borderRadius: 17, backgroundColor: colors.inputBackground, borderWidth: 1, borderColor: colors.border, paddingHorizontal: 14, color: colors.text, fontSize: 14 },
    button: { height: 56, backgroundColor: colors.primary, borderRadius: 18, alignItems: 'center', justifyContent: 'center', marginTop: 21 },
    buttonText: { color: '#FFFFFF', fontSize: 15, fontWeight: '800' },
    disabled: { opacity: 0.55 },
    footer: { flexDirection: 'row', justifyContent: 'center', marginTop: 20 },
    footerText: { color: colors.textMuted, fontSize: 13 },
    link: { color: colors.primary, fontSize: 13, fontWeight: '800' },
  });
}
