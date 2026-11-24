import React, { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Alert, Image, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { GlassSurface } from '../components/ui';
import { useTheme } from '../theme/ThemeContext';
import { getFriends, type FriendUser } from '../services/userService';

interface Props {
  onBack: () => void;
  onUserPress: (username: string) => void;
  onDiscover: () => void;
}

export default function FriendsScreen({ onBack, onUserPress, onDiscover }: Props) {
  const { tokens, isDark } = useTheme();
  const colors = tokens.colors;
  const styles = makeStyles(colors, isDark);
  const [friends, setFriends] = useState<FriendUser[]>([]);
  const [loading, setLoading] = useState(true);

  const loadFriends = useCallback(async () => {
    setLoading(true);
    try {
      setFriends(await getFriends());
    } catch (error) {
      Alert.alert('Xatolik', error instanceof Error ? error.message : 'Do‘stlar yuklanmadi');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void loadFriends(); }, [loadFriends]);

  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
      <View style={styles.header}>
        <Pressable onPress={onBack} style={styles.backButton} accessibilityRole="button" accessibilityLabel="Profilga qaytish">
          <Ionicons name="arrow-back" size={21} color={colors.text} />
        </Pressable>
        <View style={styles.headerText}>
          <Text style={styles.eyebrow}>YOUR COMMUNITY</Text>
          <Text style={styles.title}>Do‘stlarim</Text>
        </View>
        <View style={styles.countPill}><Ionicons name="people" size={14} color={colors.primary} /><Text style={styles.countText}>{friends.length}</Text></View>
      </View>

      <GlassSurface intensity={isDark ? 34 : 42} style={styles.hero}>
        <View style={styles.heroIcon}><Ionicons name="people-outline" size={25} color="#D8CCFF" /></View>
        <View style={styles.heroCopy}>
          <Text style={styles.heroTitle}>Birga o‘rganing. Birga yuksaling.</Text>
          <Text style={styles.heroSubtitle}>O‘zaro kuzatadigan foydalanuvchilar shu yerda ko‘rinadi.</Text>
        </View>
        <Pressable onPress={onDiscover} style={styles.discoverButton}>
          <Ionicons name="person-add-outline" size={16} color="#FFFFFF" />
          <Text style={styles.discoverText}>Do‘st topish</Text>
        </Pressable>
      </GlassSurface>

      <View style={styles.sectionRow}>
        <Text style={styles.sectionTitle}>Sizning do‘stlaringiz</Text>
        <Pressable onPress={() => void loadFriends()} hitSlop={8}><Ionicons name="refresh" size={18} color={colors.textMuted} /></Pressable>
      </View>

      {loading ? <ActivityIndicator size="large" color={colors.primary} style={styles.loader} /> : friends.map((friend) => {
        const initials = friend.displayName.split(' ').filter(Boolean).map((part) => part[0]).join('').slice(0, 2).toUpperCase();
        return (
          <GlassSurface key={friend.id} intensity={isDark ? 30 : 38} style={styles.friendCard}>
            <Pressable style={styles.identity} onPress={() => onUserPress(friend.username)}>
              {friend.avatarUrl ? <Image source={{ uri: friend.avatarUrl }} style={styles.avatar} /> : <View style={styles.avatarFallback}><Text style={styles.initials}>{initials || '?'}</Text></View>}
              <View style={styles.details}>
                <Text style={styles.name} numberOfLines={1}>{friend.displayName}</Text>
                <Text style={styles.username}>@{friend.username}</Text>
                <Text style={styles.meta}>{friend.rankTier ?? 'Bronze'} · {friend.followersCount} kuzatuvchi</Text>
              </View>
            </Pressable>
            <View style={styles.friendBadge}><Ionicons name="checkmark-circle" size={15} color="#78D7BD" /><Text style={styles.friendBadgeText}>Do‘st</Text></View>
            <Pressable onPress={() => onUserPress(friend.username)} style={styles.openButton} accessibilityRole="button" accessibilityLabel={friend.displayName + ' profilini ochish'}>
              <Ionicons name="chevron-forward" size={18} color={colors.textMuted} />
            </Pressable>
          </GlassSurface>
        );
      })}

      {!loading && friends.length === 0 ? (
        <View style={styles.empty}>
          <View style={styles.emptyIcon}><Ionicons name="people-outline" size={34} color={colors.primary} /></View>
          <Text style={styles.emptyTitle}>Hali do‘stlaringiz yo‘q</Text>
          <Text style={styles.emptyText}>Boshqa foydalanuvchilarni kuzating. Ular ham sizni kuzatsa, shu yerda do‘st bo‘lib ko‘rinasiz.</Text>
          <Pressable onPress={onDiscover} style={styles.emptyButton}><Ionicons name="search" size={16} color="#FFFFFF" /><Text style={styles.emptyButtonText}>Foydalanuvchilarni topish</Text></Pressable>
        </View>
      ) : null}
    </ScrollView>
  );
}

function makeStyles(colors: ReturnType<typeof useTheme>['tokens']['colors'], isDark: boolean) {
  return StyleSheet.create({
    screen: { flex: 1, backgroundColor: colors.background },
    content: { padding: 18, paddingBottom: 130 },
    header: { flexDirection: 'row', alignItems: 'center', marginBottom: 20, gap: 12 },
    backButton: { width: 42, height: 42, borderRadius: 15, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.surfaceGlass, borderWidth: 1, borderColor: colors.glassBorder },
    headerText: { flex: 1 },
    eyebrow: { color: colors.textMuted, fontSize: 9, fontWeight: '800', letterSpacing: 1.6 },
    title: { color: colors.text, fontSize: 25, fontWeight: '900', marginTop: 2 },
    countPill: { flexDirection: 'row', alignItems: 'center', gap: 5, paddingHorizontal: 12, paddingVertical: 8, borderRadius: 20, backgroundColor: isDark ? 'rgba(170,145,255,0.14)' : 'rgba(123,99,204,0.10)', borderWidth: 1, borderColor: colors.glassBorder },
    countText: { color: colors.text, fontWeight: '800', fontSize: 12 },
    hero: { padding: 16, borderRadius: 23, borderWidth: 1, borderColor: colors.glassBorder, backgroundColor: isDark ? 'rgba(68,53,111,0.34)' : 'rgba(255,255,255,0.65)', marginBottom: 25 },
    heroIcon: { width: 46, height: 46, borderRadius: 16, alignItems: 'center', justifyContent: 'center', backgroundColor: isDark ? 'rgba(178,155,255,0.18)' : 'rgba(123,99,204,0.12)', marginBottom: 12 },
    heroCopy: { marginBottom: 14 },
    heroTitle: { color: colors.text, fontSize: 16, fontWeight: '800' },
    heroSubtitle: { color: colors.textMuted, fontSize: 11, lineHeight: 17, marginTop: 5 },
    discoverButton: { alignSelf: 'flex-start', flexDirection: 'row', alignItems: 'center', gap: 7, paddingHorizontal: 14, height: 39, borderRadius: 13, backgroundColor: colors.primary },
    discoverText: { color: '#FFFFFF', fontSize: 11, fontWeight: '800' },
    sectionRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 },
    sectionTitle: { color: colors.text, fontSize: 16, fontWeight: '800' },
    loader: { marginTop: 35 },
    friendCard: { flexDirection: 'row', alignItems: 'center', gap: 8, padding: 12, borderRadius: 19, borderWidth: 1, borderColor: colors.glassBorder, backgroundColor: isDark ? 'rgba(35,31,57,0.42)' : 'rgba(255,255,255,0.62)', marginBottom: 9 },
    identity: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 11 },
    avatar: { width: 49, height: 49, borderRadius: 25 },
    avatarFallback: { width: 49, height: 49, borderRadius: 25, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.surfaceElevated },
    initials: { color: colors.text, fontWeight: '900', fontSize: 14 },
    details: { flex: 1 },
    name: { color: colors.text, fontSize: 13, fontWeight: '800' },
    username: { color: colors.primary, fontSize: 10, marginTop: 2 },
    meta: { color: colors.textMuted, fontSize: 9, marginTop: 4 },
    friendBadge: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 8, paddingVertical: 6, borderRadius: 10, backgroundColor: 'rgba(120,215,189,0.10)' },
    friendBadgeText: { color: '#78D7BD', fontSize: 9, fontWeight: '800' },
    openButton: { width: 25, alignItems: 'center' },
    empty: { alignItems: 'center', paddingHorizontal: 22, paddingTop: 35 },
    emptyIcon: { width: 72, height: 72, borderRadius: 25, alignItems: 'center', justifyContent: 'center', backgroundColor: isDark ? 'rgba(170,145,255,0.12)' : 'rgba(123,99,204,0.09)', marginBottom: 16 },
    emptyTitle: { color: colors.text, fontSize: 17, fontWeight: '900' },
    emptyText: { color: colors.textMuted, fontSize: 11, lineHeight: 18, textAlign: 'center', marginTop: 8 },
    emptyButton: { flexDirection: 'row', alignItems: 'center', gap: 8, height: 43, paddingHorizontal: 15, borderRadius: 14, backgroundColor: colors.primary, marginTop: 18 },
    emptyButtonText: { color: '#FFFFFF', fontSize: 11, fontWeight: '800' },
  });
}
