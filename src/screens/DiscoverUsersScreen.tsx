import { LocalizedText, showLocalizedAlert } from '../i18n/LocalizedText';
import React, { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Alert, Image, Pressable, ScrollView, StyleSheet, NativeText, View } from 'react-native';
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
      <LocalizedText style={styles.title}>Do‘stlar ortiring</LocalizedText>
      <LocalizedText style={styles.subtitle}>QUIZ ARENA hamjamiyatidagi foydalanuvchilar</LocalizedText>
      {loading ? <ActivityIndicator size="large" color={colors.primary} style={{ marginTop: 35 }} /> : people.map((person) => {
        const initials = person.displayName.split(' ').filter(Boolean).map((part) => part[0]).join('').slice(0, 2).toUpperCase();
        return (
          <GlassSurface key={person.id} intensity={isDark ? 30 : 38} style={styles.person}>
            <Pressable style={styles.identity} onPress={() => onUserPress(person.username)}>
              {person.avatarUrl ? <Image source={{ uri: person.avatarUrl }} style={styles.avatar} /> : <View style={styles.avatarFallback}><LocalizedText style={styles.initials}>{initials || '?'}</LocalizedText></View>}
              <View style={styles.details}><LocalizedText style={styles.name} numberOfLines={1}>{person.displayName}</LocalizedText><LocalizedText style={styles.handle}>@{person.username}</LocalizedText><LocalizedText style={styles.followers}>{person.followersCount} kuzatuvchi</LocalizedText></View>
            </Pressable>
            <Pressable disabled={busyId === person.id} onPress={() => void follow(person)} style={styles.followButton}>
              <Ionicons name="person-add-outline" size={15} color="#FFFFFF" /><LocalizedText style={styles.followText}>{busyId === person.id ? '...' : 'Kuzatish'}</LocalizedText>
            </Pressable>
          </GlassSurface>
        );
      })}
      {!loading && people.length === 0 ? <LocalizedText style={styles.empty}>Hozircha tavsiya qilinadigan foydalanuvchi yo‘q.</LocalizedText> : null}
    </ScrollView>
  );
}

function makeStyles(colors: ReturnType<typeof useTheme>['tokens']['colors'], isDark: boolean) {
  return StyleSheet.create({
    screen: { flex: 1, backgroundColor: colors.background },
    content: { padding: 18, paddingBottom: 130 },
    back: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: 10, marginBottom: 15 },
    backText: { color: colors.text, fontSize: 13, fontWeight: '700' },
    title: { color: colors.text, fontSize: 25, fontWeight: '800' },
    subtitle: { color: colors.textMuted, fontSize: 12, marginTop: 5, marginBottom: 17 },
    person: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 10, padding: 12, borderRadius: 18, borderWidth: 1, borderColor: colors.glassBorder, backgroundColor: isDark ? 'rgba(35,31,57,0.4)' : 'rgba(255,255,255,0.56)', marginBottom: 9 },
    identity: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 10 },
    avatar: { width: 47, height: 47, borderRadius: 24 },
    avatarFallback: { width: 47, height: 47, borderRadius: 24, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.surfaceElevated },
    initials: { color: colors.text, fontWeight: '800' },
    details: { flex: 1 },
    name: { color: colors.text, fontSize: 13, fontWeight: '800' },
    handle: { color: colors.primary, fontSize: 11, marginTop: 2 },
    followers: { color: colors.textMuted, fontSize: 10, marginTop: 3 },
    followButton: { paddingHorizontal: 12, height: 36, borderRadius: 12, backgroundColor: colors.primary, flexDirection: 'row', alignItems: 'center', gap: 5 },
    followText: { color: '#FFFFFF', fontSize: 11, fontWeight: '800' },
    empty: { color: colors.textMuted, textAlign: 'center', marginTop: 30, fontSize: 12 },
  });
}
