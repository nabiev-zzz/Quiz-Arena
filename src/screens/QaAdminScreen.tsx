import React, { useState } from 'react';
import { ActivityIndicator, Alert, Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../theme/ThemeContext';
import { grantQaTester } from '../services/subscriptionService';

export default function QaAdminScreen({ onBack }: { onBack: () => void }) {
  const { tokens } = useTheme();
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<Awaited<ReturnType<typeof grantQaTester>> | null>(null);
  const runGrant = async () => {
    if (loading) return;
    Alert.alert('QA akkauntini sozlash', 'qa_tester_zelqen hisobiga 100 000 ZC va 365 kunlik LEGENDA+ berilsinmi?', [
      { text: 'Bekor qilish', style: 'cancel' },
      { text: 'Tasdiqlash', onPress: () => { void (async () => {
        setLoading(true);
        try {
          const data = await grantQaTester();
          setResult(data);
          Alert.alert('Muvaffaqiyatli', 'QA tester akkaunti sozlandi.');
        } catch (error) {
          Alert.alert('Xatolik', error instanceof Error ? error.message : 'So‘rov bajarilmadi');
        } finally { setLoading(false); }
      })(); } },
    ]);
  };
  return (
    <View style={[styles.container, { backgroundColor: tokens.colors.background }]}>
      <View style={styles.header}>
        <Pressable onPress={onBack} style={[styles.back, { backgroundColor: tokens.colors.surface }]}><Ionicons name="arrow-back" size={21} color={tokens.colors.text} /></Pressable>
        <Text style={[styles.title, { color: tokens.colors.text }]}>QA boshqaruvi</Text>
      </View>
      <View style={[styles.card, { backgroundColor: tokens.colors.surface, borderColor: tokens.colors.glassBorder }]}>
        <View style={styles.icon}><Ionicons name="flask" size={26} color="#A78BFA" /></View>
        <Text style={[styles.heading, { color: tokens.colors.text }]}>QA tester akkaunti</Text>
        <Text style={[styles.username, { color: tokens.colors.primary }]}>@qa_tester_zelqen</Text>
        <View style={styles.detail}><Text style={[styles.label, { color: tokens.colors.textMuted }]}>ZC balansi uchun qo‘shimcha</Text><Text style={[styles.value, { color: tokens.colors.text }]}>100 000 ZC</Text></View>
        <View style={styles.detail}><Text style={[styles.label, { color: tokens.colors.textMuted }]}>Obuna</Text><Text style={[styles.value, { color: tokens.colors.text }]}>LEGENDA+ · 365 kun</Text></View>
        <View style={styles.detail}><Text style={[styles.label, { color: tokens.colors.textMuted }]}>Huquq</Text><Text style={[styles.value, { color: tokens.colors.text }]}>Oddiy foydalanuvchi (user)</Text></View>
        <Pressable disabled={loading} onPress={runGrant} style={[styles.button, { backgroundColor: tokens.colors.primary, opacity: loading ? 0.7 : 1 }]}>{loading ? <ActivityIndicator color="#fff" /> : <><Ionicons name="gift-outline" size={18} color="#fff" /><Text style={styles.buttonText}>QA akkauntini sozlash</Text></>}</Pressable>
        {result && <View style={styles.success}><Text style={styles.successTitle}>Sozlandi</Text><Text style={styles.successText}>@{result.username} · {Number(result.zcBalance).toLocaleString('uz-UZ')} ZC</Text><Text style={styles.successText}>LEGENDA+ faol · {new Date(result.expiresAt).toLocaleDateString('uz-UZ')} gacha</Text><Text style={styles.successText}>Role: {result.role}</Text></View>}
      </View>
      <Text style={[styles.note, { color: tokens.colors.textMuted }]}>Bu amal faqat faol administrator uchun ochiq. Qayta bosish takroriy ZC yoki obuna bermaydi.</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, paddingHorizontal: 18, paddingTop: 16 },
  header: { flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 22 },
  back: { width: 40, height: 40, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  title: { fontSize: 19, fontWeight: '900' },
  card: { borderWidth: 1, borderRadius: 20, padding: 18 },
  icon: { width: 48, height: 48, borderRadius: 15, backgroundColor: 'rgba(167,139,250,0.14)', alignItems: 'center', justifyContent: 'center', marginBottom: 12 },
  heading: { fontSize: 17, fontWeight: '900' },
  username: { fontSize: 13, fontWeight: '800', marginTop: 4, marginBottom: 18 },
  detail: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 12, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: 'rgba(140,130,170,0.25)', gap: 10 },
  label: { fontSize: 11, flex: 1 },
  value: { fontSize: 12, fontWeight: '800', textAlign: 'right' },
  button: { minHeight: 48, borderRadius: 13, marginTop: 18, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 9 },
  buttonText: { color: '#fff', fontSize: 13, fontWeight: '900' },
  success: { marginTop: 16, padding: 13, borderRadius: 12, backgroundColor: 'rgba(39,185,138,0.12)', gap: 4 },
  successTitle: { color: '#27B98A', fontSize: 13, fontWeight: '900', marginBottom: 3 },
  successText: { color: '#27B98A', fontSize: 11, fontWeight: '700' },
  note: { fontSize: 11, lineHeight: 17, marginTop: 14 },
});
