import { LocalizedText, showLocalizedAlert } from '../i18n/LocalizedText';
import React, { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Image, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../theme/ThemeContext';
import { GlassSurface } from '../components/ui';
import { followUser, getUserSuggestions, type UserSuggestion } from '../services/userService';

interface Props { onBack: () => void; onUserPress: (username: string) => void; }

export default function DiscoverUsersScreen({ onBack, onUserPress }: Props) {
  const { tokens, isDark } = useTheme();
  const colors = tokens.colors;
  const [people, setPeople] = useState<UserSuggestion[]>([]);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<string | null>(null);
  const styles = makeStyles(colors, isDark);

  const load = useCallback(async () => {
    try { setPeople(await getUserSuggestions()); }
    catch (error) { showLocalizedAlert('Xatolik', error instanceof Error ? error.message : 'Foydalanuvchilar yuklanmadi'); }
    finally { setLoading(false); }
  }, []);
  useEffect(() => { void load(); }, [load]);

  const follow = async (person: UserSuggestion) => {
    if (busyId) return;
    setBusyId(person.id);
    try {
      await followUser(person.id);
      setPeople((current) => current.filter((item) => item.id !== person.id));
    } catch (error) { showLocalizedAlert('Xatolik', error instanceof Error ? error.message : 'Kuzatib bo‘lmadi'); }
    finally { setBusyId(null); }
  };

  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
      <Pressable onPress={onBack} style={styles.back}><Ionicons name="arrow-back" size={21} color={colors.text} /><LocalizedText style={styles.backText}>Profilga qaytish</LocalizedText></Pressable>
      <View style={styles.headingBlock}>
        <LocalizedText style={styles.eyebrow}>ZELQEN HAMJAMIYATI</LocalizedText>
        <LocalizedText style={styles.title}>Do‘stlar ortiring</LocalizedText>
        <LocalizedText style={styles.subtitle}>Yangi insonlarni toping va ular bilan bilim almashing.</LocalizedText>
      </View>
      {loading ? <ActivityIndicator size="large" color={colors.primary} style={{ marginTop: 35 }} /> : people.map((person) => {
        const initials = person.displayName.split(' ').filter(Boolean).map((part) => part[0]).join('').slice(0, 2).toUpperCase();
        return (
          <GlassSurface key={person.id} intensity={isDark ? 30 : 38} style={styles.person}>
            <Pressable style={styles.identity} onPress={() => onUserPress(person.username)} accessibilityRole="button" accessibilityLabel={`${person.displayName} profilini ochish`}>
              {person.avatarUrl ? <Image source={{ uri: person.avatarUrl }} style={{ width: 55, height: 55, borderRadius: 19 }} /> : <View style={styles.avatarFallback}><LocalizedText style={styles.initials}>{initials || '?'}</LocalizedText></View>}
              <View style={styles.details}>
                <LocalizedText style={styles.name} numberOfLines={1}>{person.displayName}</LocalizedText>
                <LocalizedText style={styles.handle} numberOfLines={1}>@{person.username}</LocalizedText>
                <View style={styles.followersLine}><Ionicons name="people-outline" size={12} color={colors.textMuted} /><LocalizedText style={styles.followers}>{person.followersCount} kuzatuvchi</LocalizedText></View>
              </View>
              <Ionicons name="chevron-forward" size={17} color={colors.textMuted} />
            </Pressable>
            <Pressable disabled={busyId === person.id} onPress={() => void follow(person)} style={({ pressed }) => [styles.followButton, pressed && styles.followPressed, busyId === person.id && styles.followBusy]} accessibilityRole="button">
              {busyId === person.id ? <ActivityIndicator size="small" color="#FFFFFF" /> : <Ionicons name="person-add-outline" size={14} color="#FFFFFF" />}
              <LocalizedText style={styles.followText}>{busyId === person.id ? '...' : 'Kuzatish'}</LocalizedText>
            </Pressable>
          </GlassSurface>
        );
      })}
      {!loading && people.length === 0 ? <View style={styles.empty}><Ionicons name="people-outline" size={32} color={colors.primary} /><LocalizedText style={styles.emptyTitle}>Hozircha yangi foydalanuvchilar yo‘q</LocalizedText><LocalizedText style={styles.emptyText}>Keyinroq yana tekshirib ko‘ring.</LocalizedText></View> : null}
    </ScrollView>
  );
}

function makeStyles(colors: ReturnType<typeof useTheme>['tokens']['colors'], isDark: boolean) {
  return StyleSheet.create({
    screen: { flex: 1, backgroundColor: colors.background },
    content: { paddingHorizontal: 20, paddingTop: 10, paddingBottom: 140 },
    back: { flexDirection: 'row', alignItems: 'center', gap: 8, minHeight: 42, marginBottom: 17 },
    backText: { color: colors.text, fontSize: 13, fontWeight: '700' },
    headingBlock: { marginBottom: 20 },
    eyebrow: { color: colors.primary, fontSize: 9, fontWeight: '900', letterSpacing: 1.7, marginBottom: 6 },
    title: { color: colors.text, fontSize: 29, fontWeight: '900', letterSpacing: -0.8 },
    subtitle: { color: colors.textMuted, fontSize: 12, lineHeight: 18, marginTop: 6, maxWidth: 300 },
    person: { padding: 13, borderRadius: 21, borderWidth: 1, borderColor: colors.glassBorder, backgroundColor: isDark ? 'rgba(35,31,57,0.46)' : 'rgba(255,255,255,0.66)', marginBottom: 11, gap: 12 },
    identity: { minHeight: 58, flexDirection: 'row', alignItems: 'center', gap: 11 },
    avatar: { width: 55, height: 55, borderRadius: 19, backgroundColor: colors.surfaceElevated },
    avatarFallback: { width: 55, height: 55, borderRadius: 19, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.surfaceElevated },
    initials: { color: colors.text, fontSize: 18, fontWeight: '900' },
    details: { flex: 1, minWidth: 0, gap: 2 },
    name: { color: colors.text, fontSize: 14, fontWeight: '800' },
    handle: { color: colors.primary, fontSize: 11, fontWeight: '600' },
    followersLine: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 3 },
    followers: { color: colors.textMuted, fontSize: 10 },
    followButton: { alignSelf: 'flex-start', minWidth: 112, height: 36, paddingHorizontal: 13, borderRadius: 12, backgroundColor: colors.primary, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6 },
    followPressed: { opacity: 0.82, transform: [{ scale: 0.98 }] },
    followBusy: { opacity: 0.72 },
    followText: { color: '#FFFFFF', fontSize: 11, fontWeight: '800' },
    empty: { alignItems: 'center', paddingTop: 55, gap: 9 },
    emptyTitle: { color: colors.text, fontSize: 14, fontWeight: '800', textAlign: 'center' },
    emptyText: { color: colors.textMuted, fontSize: 11, textAlign: 'center' },
  });
}
