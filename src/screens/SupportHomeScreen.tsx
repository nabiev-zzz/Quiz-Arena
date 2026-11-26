import React from 'react';
import { Linking, Platform, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LocalizedText } from '../i18n/LocalizedText';
import { useTheme } from '../theme/ThemeContext';

interface SupportHomeScreenProps {
  onBack: () => void;
  onOpenChat: (prompt?: string) => void;
}

export default function SupportHomeScreen({ onBack, onOpenChat }: SupportHomeScreenProps) {
  const { tokens } = useTheme();
  const colors = tokens.colors;
  const styles = makeStyles(colors);

  const openEmail = () => {
    const subject = encodeURIComponent('ZELQEN CORE — Qo‘llab-quvvatlash');
    const body = encodeURIComponent('Salom, ZELQEN CORE jamoasi!\n\nMurojaatim:\n');
    const mailto = `mailto:zelqencoresupport@gmail.com?subject=${subject}&body=${body}`;
    const gmail = `https://mail.google.com/mail/?view=cm&fs=1&to=zelqencoresupport%40gmail.com&su=${subject}&body=${body}`;
    void Linking.openURL(Platform.OS === 'web' ? gmail : mailto).catch(() => undefined);
  };

  const quickQuestions = [
    { icon: 'flash-outline' as const, title: 'Battle xonasiga qanday qo‘shilaman?', prompt: 'Battle xonasiga qanday qo‘shilaman?' },
    { icon: 'wallet-outline' as const, title: 'ZC balansimni qayerdan ko‘raman?', prompt: 'ZC balansimni qayerdan ko‘raman?' },
    { icon: 'person-circle-outline' as const, title: 'Akkauntimga kira olmayapman', prompt: 'Akkauntimga kira olmayapman. Yordam bering.' },
    { icon: 'help-circle-outline' as const, title: 'Testlar va natijalar haqida', prompt: 'Testlar va natijalar bo‘yicha yordam kerak.' },
  ];

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Pressable accessibilityRole="button" accessibilityLabel="Orqaga" testID="support-home-back" onPress={onBack} style={styles.backButton}>
          <Ionicons name="chevron-back" size={23} color={colors.text} />
        </Pressable>
        <View style={{ flex: 1 }}>
          <LocalizedText style={styles.headerTitle}>Savol berish va yordam</LocalizedText>
          <LocalizedText style={styles.headerSubtitle}>ZELQEN CORE yordam markazi</LocalizedText>
        </View>
      </View>
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        <View style={styles.hero}>
          <View style={styles.heroIcon}><Ionicons name="headset" size={30} color="#FFFFFF" /></View>
          <LocalizedText style={styles.heroTitle}>Sizga qanday yordam bera olamiz?</LocalizedText>
          <LocalizedText style={styles.heroText}>Ilova, akkaunt, testlar, Battle yoki to‘lov bilan bog‘liq savollaringizga yordam beramiz.</LocalizedText>
          <Pressable accessibilityRole="button" testID="support-home-chat" onPress={() => onOpenChat()} style={({ pressed }) => [styles.primaryButton, pressed && styles.pressed]}>
            <Ionicons name="chatbubbles-outline" size={20} color="#FFFFFF" />
            <LocalizedText style={styles.primaryButtonText}>AI yordamchi bilan suhbat</LocalizedText>
            <Ionicons name="arrow-forward" size={18} color="#FFFFFF" />
          </Pressable>
        </View>

        <LocalizedText style={styles.sectionTitle}>TEZKOR SAVOLLAR</LocalizedText>
        <View style={styles.questionList}>
          {quickQuestions.map((item, index) => (
            <Pressable key={item.prompt} accessibilityRole="button" testID={`support-faq-${index + 1}`} onPress={() => onOpenChat(item.prompt)} style={({ pressed }) => [styles.questionRow, pressed && styles.pressed]}>
              <View style={styles.questionIcon}><Ionicons name={item.icon} size={20} color={colors.primary} /></View>
              <LocalizedText style={styles.questionText}>{item.title}</LocalizedText>
              <Ionicons name="chevron-forward" size={19} color={colors.textMuted} />
            </Pressable>
          ))}
        </View>

        <LocalizedText style={styles.sectionTitle}>BEVOSITA MUROJAAT</LocalizedText>
        <Pressable accessibilityRole="button" testID="support-home-email" onPress={openEmail} style={({ pressed }) => [styles.emailCard, pressed && styles.pressed]}>
          <View style={styles.emailIcon}><Ionicons name="mail-outline" size={22} color="#FFFFFF" /></View>
          <View style={{ flex: 1 }}>
            <LocalizedText style={styles.emailTitle}>Qo‘llab-quvvatlash</LocalizedText>
            <LocalizedText style={styles.emailAddress}>zelqencoresupport@gmail.com</LocalizedText>
          </View>
          <Ionicons name="open-outline" size={19} color={colors.textMuted} />
        </Pressable>
        <LocalizedText style={styles.note}>Maxfiy parol, SMS kod yoki bank karta ma’lumotlarini yubormang.</LocalizedText>
      </ScrollView>
    </View>
  );
}

function makeStyles(colors: ReturnType<typeof useTheme>['tokens']['colors']) {
  return StyleSheet.create({
    container: { flex: 1, backgroundColor: colors.background },
    header: { minHeight: 76, paddingHorizontal: 16, flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: colors.surface, borderBottomWidth: 1, borderBottomColor: colors.border },
    backButton: { width: 44, height: 44, borderRadius: 14, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.background },
    headerTitle: { color: colors.text, fontSize: 17, fontWeight: '900' },
    headerSubtitle: { color: colors.textMuted, fontSize: 12, marginTop: 4 },
    content: { padding: 17, paddingBottom: 35 },
    hero: { borderRadius: 22, padding: 20, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, marginBottom: 25 },
    heroIcon: { width: 54, height: 54, borderRadius: 17, backgroundColor: '#6759E8', alignItems: 'center', justifyContent: 'center', marginBottom: 15 },
    heroTitle: { color: colors.text, fontSize: 21, fontWeight: '900', lineHeight: 27 },
    heroText: { color: colors.textMuted, fontSize: 13, lineHeight: 20, marginTop: 8 },
    primaryButton: { minHeight: 50, borderRadius: 14, backgroundColor: '#6759E8', paddingHorizontal: 13, marginTop: 18, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 9 },
    primaryButtonText: { color: '#FFFFFF', fontSize: 13, fontWeight: '800', flex: 1 },
    sectionTitle: { color: colors.textMuted, fontSize: 11, fontWeight: '900', letterSpacing: 1.2, marginBottom: 11, marginTop: 5 },
    questionList: { gap: 9, marginBottom: 24 },
    questionRow: { minHeight: 62, borderRadius: 14, paddingHorizontal: 12, flexDirection: 'row', alignItems: 'center', gap: 11, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border },
    questionIcon: { width: 38, height: 38, borderRadius: 12, backgroundColor: colors.primary + '20', alignItems: 'center', justifyContent: 'center' },
    questionText: { flex: 1, color: colors.text, fontSize: 13, fontWeight: '700' },
    emailCard: { minHeight: 72, borderRadius: 15, paddingHorizontal: 13, flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border },
    emailIcon: { width: 42, height: 42, borderRadius: 13, backgroundColor: '#6759E8', alignItems: 'center', justifyContent: 'center' },
    emailTitle: { color: colors.text, fontSize: 14, fontWeight: '900' },
    emailAddress: { color: colors.textMuted, fontSize: 11, marginTop: 4 },
    note: { color: colors.textMuted, fontSize: 11, textAlign: 'center', lineHeight: 17, marginTop: 19 },
    pressed: { opacity: 0.72, transform: [{ scale: 0.99 }] },
  });
}
