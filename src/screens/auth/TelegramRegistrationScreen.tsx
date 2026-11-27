import { useState } from 'react';
import { ActivityIndicator, Linking, Pressable, StyleSheet, TextInput, View } from 'react-native';
import { LocalizedText, showLocalizedAlert } from '../../i18n/LocalizedText';
import { useTheme } from '../../theme/ThemeContext';
import type { AuthResponse } from '../../services/authService';

interface Props {
  onCreateSession: () => Promise<{ sessionId: string; botUrl: string; expiresIn: number }>;
  onVerify: (sessionId: string, code: string) => Promise<AuthResponse>;
  onContinue: (result: AuthResponse) => Promise<void>;
  onBack: () => void;
}

export default function TelegramRegistrationScreen({ onCreateSession, onVerify, onContinue, onBack }: Props) {
  const { tokens } = useTheme();
  const [sessionId, setSessionId] = useState('');
  const [code, setCode] = useState('');
  const [result, setResult] = useState<AuthResponse | null>(null);
  const [loading, setLoading] = useState(false);

  const start = async () => {
    try {
      setLoading(true);
      const session = await onCreateSession();
      setSessionId(session.sessionId);
      await Linking.openURL(session.botUrl);
    } catch (error) {
      showLocalizedAlert('Telegram', error instanceof Error ? error.message : 'Botni ochib bo‘lmadi');
    } finally { setLoading(false); }
  };

  const verify = async () => {
    if (!/^\d{6}$/.test(code.trim())) {
      showLocalizedAlert('Kod', 'Telegram chatiga kelgan 6 xonali kodni kiriting.');
      return;
    }
    try {
      setLoading(true);
      setResult(await onVerify(sessionId, code.trim()));
    } catch (error) {
      showLocalizedAlert('Tasdiqlash amalga oshmadi', error instanceof Error ? error.message : 'Kod noto‘g‘ri yoki muddati tugagan');
    } finally { setLoading(false); }
  };

  const colors = tokens.colors;
  return (
    <View style={styles.container}>
      <View style={[styles.card, { backgroundColor: colors.surfaceGlass, borderColor: colors.glassBorder }]}>
        <LocalizedText style={[styles.brand, { color: colors.text }]}>ZELQEN CORE</LocalizedText>
        {result ? (
          <>
            <LocalizedText style={[styles.title, { color: colors.text }]}>Muvaffaqiyatli tasdiqlandi!</LocalizedText>
            <LocalizedText style={[styles.subtitle, { color: colors.textMuted }]}>Telegram raqamingiz tasdiqlandi. Endi ilovaga xavfsiz kirishingiz mumkin.</LocalizedText>
            <Pressable disabled={loading} style={styles.primary} onPress={() => { void onContinue(result); }}>
              <LocalizedText style={styles.primaryText}>Ilovada davom etish</LocalizedText>
            </Pressable>
          </>
        ) : (
          <>
            <LocalizedText style={[styles.title, { color: colors.text }]}>Telegram orqali ro‘yxatdan o‘tish</LocalizedText>
            <LocalizedText style={[styles.subtitle, { color: colors.textMuted }]}>Botni oching, o‘z telefon raqamingizni ulashing. Telegram chatiga yuborilgan 6 xonali kodni shu yerga kiriting.</LocalizedText>
            {!sessionId ? (
              <Pressable disabled={loading} style={styles.primary} onPress={() => void start()}>
                {loading ? <ActivityIndicator color="#FFFFFF" /> : <LocalizedText style={styles.primaryText}>Telegram botni ochish</LocalizedText>}
              </Pressable>
            ) : (
              <>
                <LocalizedText style={[styles.label, { color: colors.textSecondary }]}>Telegram chatiga kelgan kod</LocalizedText>
                <TextInput value={code} onChangeText={setCode} keyboardType="number-pad" maxLength={6} placeholder="000000" placeholderTextColor={colors.textMuted} style={[styles.input, { color: colors.text, backgroundColor: colors.inputBackground, borderColor: colors.border }]} />
                <Pressable disabled={loading} style={styles.primary} onPress={() => void verify()}>
                  {loading ? <ActivityIndicator color="#FFFFFF" /> : <LocalizedText style={styles.primaryText}>Kodni tasdiqlash</LocalizedText>}
                </Pressable>
                <Pressable disabled={loading} onPress={() => void start()} style={styles.secondary}><LocalizedText style={{ color: colors.primary, fontWeight: '700' }}>Botni qayta ochish</LocalizedText></Pressable>
              </>
            )}
          </>
        )}
        <Pressable onPress={onBack} disabled={loading} style={styles.secondary}><LocalizedText style={{ color: colors.primary, fontWeight: '700' }}>Orqaga</LocalizedText></Pressable>
      </View>
    </View>
  );
}
const styles = StyleSheet.create({
  container: { flex: 1, justifyContent: 'center', padding: 24 },
  card: { borderWidth: 1, borderRadius: 26, padding: 22 },
  brand: { fontSize: 12, fontWeight: '900', letterSpacing: 3, marginBottom: 24 },
  title: { fontSize: 24, fontWeight: '900', marginBottom: 10 },
  subtitle: { fontSize: 14, lineHeight: 21, marginBottom: 22 },
  label: { fontSize: 12, fontWeight: '800', marginBottom: 8 },
  input: { height: 58, borderWidth: 1, borderRadius: 15, paddingHorizontal: 16, fontSize: 22, letterSpacing: 8, textAlign: 'center' },
  primary: { minHeight: 54, borderRadius: 16, backgroundColor: '#7657E8', alignItems: 'center', justifyContent: 'center', marginTop: 16 },
  primaryText: { color: '#FFFFFF', fontSize: 14, fontWeight: '900' },
  secondary: { alignItems: 'center', paddingVertical: 14 },
});
