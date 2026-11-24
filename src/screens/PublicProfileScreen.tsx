import React, { useEffect, useState } from 'react';
import { ActivityIndicator, Alert, Image, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../theme/ThemeContext';
import { GlassSurface } from '../components/ui';
import { followUser, getPublicUserProfile, unfollowUser, type PublicUser } from '../services/userService';
import { getProfileAchievements } from '../utils/profileAchievements';

interface Props {
  username: string;
  onBack: () => void;
}

export default function PublicProfileScreen({ username, onBack }: Props) {
  const { tokens, isDark } = useTheme();
  const colors = tokens.colors;
  const [profile, setProfile] = useState<PublicUser | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let active = true;
    setLoading(true);
    getPublicUserProfile(username)
      .then((data) => { if (active) setProfile(data); })
      .catch((error) => Alert.alert('Xatolik', error instanceof Error ? error.message : 'Profilni yuklab bo‘lmadi'))
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [username]);

  const toggleFollow = async () => {
    if (!profile || busy) return;
    setBusy(true);
    try {
      const result = profile.isFollowing
        ? await unfollowUser(profile.id)
        : await followUser(profile.id);
      setProfile({ ...profile, isFollowing: result.following, followersCount: result.followersCount });
    } catch (error) {
      Alert.alert('Xatolik', error instanceof Error ? error.message : 'Amal bajarilmadi');
    } finally {
      setBusy(false);
    }
  };

  const styles = makeStyles(colors, isDark);
  if (loading) return <View style={styles.loading}><ActivityIndicator size="large" color={colors.primary} /></View>;
  if (!profile) return <View style={styles.screen}><Pressable onPress={onBack} style={styles.back}><Ionicons name="arrow-back" size={21} color={colors.text} /><Text style={styles.backText}>Orqaga</Text></Pressable><Text style={styles.empty}>Profil topilmadi</Text></View>;

  const initials = profile.displayName.split(' ').filter(Boolean).map((part) => part[0]).join('').slice(0, 2).toUpperCase();

  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
      <View style={styles.topBar}>
        <Pressable onPress={onBack} style={styles.backButton} accessibilityRole="button" accessibilityLabel="Orqaga">
          <Ionicons name="arrow-back" size={21} color={colors.text} />
        </Pressable>
        <Text style={styles.topUsername}>@{profile.username}</Text>
      </View>
      <GlassSurface intensity={isDark ? 42 : 48} style={styles.hero}>
        <View style={styles.compactIdentityRow}>
          <View style={[styles.compactAvatarRing, profile.profileFrame === 'aurora' ? styles.frameAurora : profile.profileFrame === 'royal' ? styles.frameRoyal : profile.profileFrame === 'ocean' ? styles.frameOcean : null]}>
            {profile.avatarUrl ? <Image source={{ uri: profile.avatarUrl }} style={styles.compactAvatar} /> : <View style={styles.compactAvatarFallback}><Text style={styles.compactInitials}>{initials || '?'}</Text></View>}
          </View>
          <View style={styles.compactIdentityText}>
            <Text style={styles.compactName} numberOfLines={1}>{profile.displayName}</Text>
            <View style={styles.compactMeta}>
              <Text style={styles.username}>@{profile.username}</Text>
              <Text style={[styles.rankBadge, { color: profile.rankTier === 'Gold' ? '#F5C542' : profile.rankTier === 'Silver' ? '#A8B0BD' : '#CD7F32' }]}>{(profile.rankTier || 'Bronze').toUpperCase()}</Text>
            </View>
          </View>
        </View>
        <View style={styles.counts}>
          <View style={styles.count}><Text style={styles.countNumber}>{profile.followersCount}</Text><Text style={styles.countLabel}>Kuzatuvchilar</Text></View>
          <View style={styles.separator} />
          <View style={styles.count}><Text style={styles.countNumber}>{profile.followingCount ?? 0}</Text><Text style={styles.countLabel}>Kuzatilganlar</Text></View>
        </View>
      </GlassSurface>
      {!profile.isSelf && (
        <View style={styles.actionRow}>
          <Pressable disabled={busy} onPress={toggleFollow} style={[styles.followButton, profile.isFollowing && styles.followingButton]}>
            <Ionicons name={profile.isFollowing ? 'checkmark' : 'person-add-outline'} size={16} color={profile.isFollowing ? colors.text : '#FFFFFF'} />
            <Text style={[styles.followButtonText, profile.isFollowing && styles.followingText]}>{busy ? '...' : profile.isFollowing ? 'Kuzatilmoqda' : 'Kuzatish'}</Text>
          </Pressable>
          <Pressable onPress={() => Alert.alert('Battle taklifi', 'Battle takliflarini yuborish imkoniyati hozircha ulanmagan.')} style={styles.battleButton}>
            <Ionicons name="flash-outline" size={16} color={colors.text} />
            <Text style={styles.battleButtonText}>Battle taklifi</Text>
          </Pressable>
        </View>
      )}
      <Text style={styles.sectionTitle}>Natijalar</Text>
      <View style={styles.stats}>
        <GlassSurface intensity={isDark ? 30 : 38} style={styles.stat}><Text style={styles.statValue}>{profile.xp}</Text><Text style={styles.statLabel}>XP</Text></GlassSurface>
        <GlassSurface intensity={isDark ? 30 : 38} style={styles.stat}><Text style={styles.statValue}>{profile.level}</Text><Text style={styles.statLabel}>Daraja</Text></GlassSurface>
        <GlassSurface intensity={isDark ? 30 : 38} style={styles.stat}><Text style={styles.statValue}>{profile.rankPoints ?? 0}</Text><Text style={styles.statLabel}>RP</Text></GlassSurface>
      </View>
      <Text style={styles.sectionTitle}>Erishgan yutuqlari</Text>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 9 }}>
        {getProfileAchievements(profile.xp ?? 0, profile.level ?? 1, profile.rankPoints ?? 0).filter((item) => item.unlocked).map((achievement) => (
          <GlassSurface key={achievement.id} intensity={isDark ? 30 : 38} style={styles.achievementCard}>
            <Ionicons name={achievement.icon} size={20} color="#EFCB78" />
            <Text style={styles.rankName}>{achievement.title}</Text>
            <Text style={styles.rankHint}>{achievement.description}</Text>
          </GlassSurface>
        ))}
        {getProfileAchievements(profile.xp ?? 0, profile.level ?? 1, profile.rankPoints ?? 0).every((item) => !item.unlocked) ? <Text style={styles.rankHint}>Hozircha yutuqlar yo‘q</Text> : null}
      </ScrollView>
      <GlassSurface intensity={isDark ? 30 : 38} style={styles.rankCard}>
        <Ionicons name="medal-outline" size={22} color="#EFCB78" />
        <View style={styles.rankText}><Text style={styles.rankName}>{profile.rankTier || 'Bronze'} ligasi</Text><Text style={styles.rankHint}>QUIZ ARENA rank</Text></View>
      </GlassSurface>
      <Text style={styles.sectionTitle}>Profil bezaklari</Text>
      <GlassSurface intensity={isDark ? 30 : 38} style={styles.cosmeticRow}>
        <Ionicons name="color-palette-outline" size={21} color="#BBA8FF" />
        <View style={styles.rankText}><Text style={styles.rankName}>Avatar bezagi</Text><Text style={styles.rankHint}>{profile.avatarDecoration || 'Standart'}</Text></View>
      </GlassSurface>
      <GlassSurface intensity={isDark ? 30 : 38} style={styles.cosmeticRow}>
        <Ionicons name="albums-outline" size={21} color="#8BCDF7" />
        <View style={styles.rankText}><Text style={styles.rankName}>Profil ramkasi</Text><Text style={styles.rankHint}>{profile.profileFrame || 'Standart'}</Text></View>
      </GlassSurface>
    </ScrollView>
  );
}

function makeStyles(colors: ReturnType<typeof useTheme>['tokens']['colors'], isDark: boolean) {
  return StyleSheet.create({
    screen: { flex: 1, backgroundColor: isDark ? '#0A0C1C' : colors.background },
    content: { paddingHorizontal: 6, paddingTop: 10, paddingBottom: 130 },
    loading: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: colors.background },
    topBar: { flexDirection: 'row', alignItems: 'center', gap: 12, minHeight: 42, marginBottom: 10 },
    backButton: { width: 34, height: 34, alignItems: 'center', justifyContent: 'center' },
    topUsername: { color: colors.text, fontSize: 16, fontWeight: '600' },
    empty: { color: colors.textMuted, textAlign: 'center', marginTop: 40 },
    hero: { paddingHorizontal: 10, paddingVertical: 10, borderRadius: 16, borderWidth: 0.5, borderColor: 'rgba(255,255,255,0.18)', backgroundColor: isDark ? 'rgba(255,255,255,0.06)' : 'rgba(255,255,255,0.58)' },
    compactIdentityRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
    compactIdentityText: { flex: 1, minWidth: 0, gap: 4 },
    compactAvatarRing: { width: 48, height: 48, borderRadius: 24, padding: 1, borderWidth: 1, borderColor: 'rgba(255,255,255,0.2)', flexShrink: 0 },
    compactAvatar: { width: '100%', height: '100%', borderRadius: 24 },
    compactAvatarFallback: { flex: 1, borderRadius: 24, alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(137,116,220,0.24)' },
    compactInitials: { color: '#FFFFFF', fontSize: 15, fontWeight: '700' },
    compactName: { color: colors.text, fontSize: 14, fontWeight: '600' },
    compactMeta: { flexDirection: 'row', alignItems: 'center', gap: 9 },
    rankBadge: { fontSize: 9, fontWeight: '800', letterSpacing: 0.8 },
    frameAurora: { borderColor: '#A78BFA', borderWidth: 4 },
    frameRoyal: { borderColor: '#EFCB78', borderWidth: 4 },
    frameOcean: { borderColor: '#60A5FA', borderWidth: 4 },
    avatar: { width: '100%', height: '100%', borderRadius: 50 },
    avatarFallback: { flex: 1, borderRadius: 50, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.surfaceElevated },
    initials: { color: colors.text, fontSize: 29, fontWeight: '800' },
    decoration: { position: 'absolute', right: -3, bottom: 0, width: 30, height: 30, borderRadius: 15, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.glassBorder },
    name: { color: colors.text, fontSize: 20, fontWeight: '800', textAlign: 'left' },
    username: { color: colors.primary, fontSize: 12, marginTop: 4, fontWeight: '700' },
    bio: { color: colors.textSecondary, fontSize: 12, lineHeight: 18, textAlign: 'left', marginTop: 8 },
    counts: { flexDirection: 'row', alignItems: 'center', width: '100%', marginTop: 10, paddingTop: 9, borderTopWidth: 0.5, borderTopColor: 'rgba(255,255,255,0.12)' },
    count: { flex: 1, alignItems: 'center' },
    countNumber: { color: colors.text, fontSize: 19, fontWeight: '800' },
    countLabel: { color: colors.textMuted, fontSize: 11, marginTop: 3 },
    separator: { width: 1, height: 30, backgroundColor: colors.border },
    actionRow: { flexDirection: 'row', gap: 9, marginTop: 10, marginBottom: 4 },
    followButton: { flex: 1, minWidth: 0, height: 44, borderRadius: 14, backgroundColor: '#7657E8', flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8 },
    followingButton: { backgroundColor: 'rgba(255,255,255,0.10)', borderWidth: 0.5, borderColor: 'rgba(255,255,255,0.18)' },
    followButtonText: { color: '#FFFFFF', fontSize: 13, fontWeight: '700' },
    followingText: { color: colors.text },
    battleButton: { flex: 1, minWidth: 0, height: 44, borderRadius: 14, backgroundColor: 'rgba(255,255,255,0.07)', borderWidth: 0.5, borderColor: 'rgba(255,255,255,0.18)', flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8 },
    battleButtonText: { color: colors.text, fontSize: 13, fontWeight: '600' },
    sectionTitle: { color: colors.text, fontSize: 18, fontWeight: '800', marginTop: 24, marginBottom: 11 },
    stats: { flexDirection: 'row', gap: 9 },
    stat: { flex: 1, alignItems: 'center', paddingVertical: 17, borderRadius: 18, borderWidth: 1, borderColor: colors.glassBorder, backgroundColor: isDark ? 'rgba(35,31,57,0.4)' : 'rgba(255,255,255,0.52)' },
    statValue: { color: colors.text, fontSize: 21, fontWeight: '800' },
    statLabel: { color: colors.textMuted, fontSize: 11, marginTop: 4 },
    achievementCard: { width: 142, minHeight: 94, padding: 12, borderRadius: 16, borderWidth: 1, borderColor: colors.glassBorder, backgroundColor: isDark ? 'rgba(35,31,57,0.4)' : 'rgba(255,255,255,0.52)' },
    rankCard: { flexDirection: 'row', alignItems: 'center', gap: 13, padding: 16, borderRadius: 18, borderWidth: 1, borderColor: colors.glassBorder, marginTop: 12, backgroundColor: isDark ? 'rgba(35,31,57,0.4)' : 'rgba(255,255,255,0.52)' },
    rankText: { flex: 1 },
    rankName: { color: colors.text, fontSize: 14, fontWeight: '700' },
    rankHint: { color: colors.textMuted, fontSize: 11, marginTop: 4 },
    cosmeticRow: { flexDirection: 'row', alignItems: 'center', gap: 13, padding: 15, borderRadius: 17, borderWidth: 1, borderColor: colors.glassBorder, marginBottom: 9, backgroundColor: isDark ? 'rgba(35,31,57,0.4)' : 'rgba(255,255,255,0.52)' },
  });
}
