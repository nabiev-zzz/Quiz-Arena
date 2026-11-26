import { LocalizedText, showLocalizedAlert } from '../i18n/LocalizedText';
import React, { useEffect, useState } from 'react';
import { ActivityIndicator, Alert, Image, Pressable, ScrollView, StyleSheet, Text as NativeText, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import AnimatedBadge from '../components/AnimatedBadge';
import ProfileEffect from '../components/ProfileEffect';
import ProfileAtmosphere from '../components/ProfileAtmosphere';
import { useTheme } from '../theme/ThemeContext';
import { GlassSurface } from '../components/ui';
import { followUser, getPublicUserProfile, unfollowUser, type PublicUser } from '../services/userService';
import { getProfileAchievements } from '../utils/profileAchievements';

interface Props {
  username: string;
  onBack: () => void;
  onMessagePress: (userId: string) => void;
}

export default function PublicProfileScreen({ username, onBack, onMessagePress }: Props) {
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
      .catch((error) => showLocalizedAlert('Xatolik', error instanceof Error ? error.message : 'Profilni yuklab bo‘lmadi'))
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
      showLocalizedAlert('Xatolik', error instanceof Error ? error.message : 'Amal bajarilmadi');
    } finally {
      setBusy(false);
    }
  };

  const styles = makeStyles(colors, isDark);
  if (loading) return <View style={styles.loading}><ActivityIndicator size="large" color={colors.primary} /></View>;
  if (!profile) return <View style={styles.screen}><Pressable onPress={onBack} style={styles.back}><Ionicons name="arrow-back" size={21} color={colors.text} /><LocalizedText style={styles.backText}>Orqaga</LocalizedText></Pressable><LocalizedText style={styles.empty}>Profil topilmadi</LocalizedText></View>;

  const initials = profile.displayName.split(' ').filter(Boolean).map((part) => part[0]).join('').slice(0, 2).toUpperCase();

  return (
    <View style={styles.screen}>
    <ProfileAtmosphere value={profile.profileFrame} />
    <ScrollView style={styles.scroll} contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
      <Pressable onPress={onBack} style={styles.back}><Ionicons name="arrow-back" size={21} color={colors.text} /><LocalizedText style={styles.backText}>Orqaga</LocalizedText></Pressable>
      <GlassSurface intensity={isDark ? 34 : 42} style={styles.hero}>
        <View style={styles.identityRow}>
          <ProfileEffect value={profile.profileFrame} variant="hero" style={styles.avatarEffectStage}>
          <View style={[styles.avatarRing, profile.profileFrame === 'aurora' ? styles.frameAurora : profile.profileFrame === 'royal' ? styles.frameRoyal : profile.profileFrame === 'ocean' ? styles.frameOcean : profile.profileFrame === 'neon3d' ? styles.frameNeon3d : profile.profileFrame === 'inferno3d' ? styles.frameInferno3d : profile.profileFrame === 'frost3d' ? styles.frameFrost3d : profile.profileFrame === 'galaxy3d' ? styles.frameGalaxy3d : null]}>
            {profile.avatarUrl ? <Image source={{ uri: profile.avatarUrl }} style={styles.avatar} /> : <View style={styles.avatarFallback}><LocalizedText style={styles.initials}>{initials || '?'}</LocalizedText></View>}
            {profile.avatarDecoration ? <View style={styles.decoration}><Ionicons name={profile.avatarDecoration === 'crown' ? 'ribbon' : profile.avatarDecoration === 'laurel' ? 'leaf' : 'sparkles'} size={17} color="#F3C96A" /></View> : null}
            {profile.profileBadge ? <View style={styles.profileBadge}><AnimatedBadge value={profile.profileBadge} size={34} /></View> : null}
          </View>
          </ProfileEffect>
          <View style={styles.identityText}>
            <LocalizedText style={styles.name}>{profile.displayName}</LocalizedText>
            <LocalizedText style={styles.username}>@{profile.username}</LocalizedText>
            {!!profile.bio && <LocalizedText style={styles.bio}>{profile.bio}</LocalizedText>}
          </View>
        </View>
        <View style={styles.counts}>
          <View style={styles.count}><LocalizedText style={styles.countNumber}>{profile.followersCount}</LocalizedText><LocalizedText style={styles.countLabel}>Kuzatuvchilar</LocalizedText></View>
          <View style={styles.separator} />
          <View style={styles.count}><LocalizedText style={styles.countNumber}>{profile.followingCount ?? 0}</LocalizedText><LocalizedText style={styles.countLabel}>Kuzatilayotganlar</LocalizedText></View>
        </View>
        {!profile.isSelf && (
          <View style={styles.socialActions}>
          <Pressable onPress={() => onMessagePress(profile.id)} style={styles.messageButton}>
            <Ionicons name="paper-plane-outline" size={16} color={colors.primary} />
            <LocalizedText style={styles.messageButtonText}>Xabar yuborish</LocalizedText>
          </Pressable>
          <Pressable disabled={busy} onPress={toggleFollow} style={[styles.followButton, profile.isFollowing && styles.followingButton]}>
            <Ionicons name={profile.isFollowing ? 'checkmark' : 'person-add-outline'} size={17} color={profile.isFollowing ? colors.text : '#FFFFFF'} />
            <LocalizedText style={[styles.followButtonText, profile.isFollowing && styles.followingText]}>{busy ? '...' : profile.isFollowing ? 'Kuzatilmoqda' : 'Kuzatish'}</LocalizedText>
          </Pressable>
          </View>
        )}
      </GlassSurface>
      <LocalizedText style={styles.sectionTitle}>Natijalar</LocalizedText>
      <View style={styles.stats}>
        <GlassSurface intensity={isDark ? 30 : 38} style={styles.stat}><LocalizedText style={styles.statValue}>{profile.xp}</LocalizedText><LocalizedText style={styles.statLabel}>XP</LocalizedText></GlassSurface>
        <GlassSurface intensity={isDark ? 30 : 38} style={styles.stat}><LocalizedText style={styles.statValue}>{profile.level}</LocalizedText><LocalizedText style={styles.statLabel}>Daraja</LocalizedText></GlassSurface>
        <GlassSurface intensity={isDark ? 30 : 38} style={styles.stat}><LocalizedText style={styles.statValue}>{profile.rankPoints ?? 0}</LocalizedText><LocalizedText style={styles.statLabel}>RP</LocalizedText></GlassSurface>
      </View>
      <LocalizedText style={styles.sectionTitle}>Erishgan yutuqlari</LocalizedText>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 9 }}>
        {getProfileAchievements(profile.xp ?? 0, profile.level ?? 1, profile.rankPoints ?? 0).filter((item) => item.unlocked).map((achievement) => (
          <GlassSurface key={achievement.id} intensity={isDark ? 30 : 38} style={styles.achievementCard}>
            <Ionicons name={achievement.icon} size={20} color="#EFCB78" />
            <LocalizedText style={styles.rankName}>{achievement.title}</LocalizedText>
            <LocalizedText style={styles.rankHint}>{achievement.description}</LocalizedText>
          </GlassSurface>
        ))}
        {getProfileAchievements(profile.xp ?? 0, profile.level ?? 1, profile.rankPoints ?? 0).every((item) => !item.unlocked) ? <LocalizedText style={styles.rankHint}>Hozircha yutuqlar yo‘q</LocalizedText> : null}
      </ScrollView>
      <GlassSurface intensity={isDark ? 30 : 38} style={styles.rankCard}>
        <Ionicons name="medal-outline" size={22} color="#EFCB78" />
        <View style={styles.rankText}><LocalizedText style={styles.rankName}>{profile.rankTier || 'Bronze'} ligasi</LocalizedText><LocalizedText style={styles.rankHint}>QUIZ ARENA rank</LocalizedText></View>
      </GlassSurface>
      <LocalizedText style={styles.sectionTitle}>Profil bezaklari</LocalizedText>
      <GlassSurface intensity={isDark ? 30 : 38} style={styles.cosmeticRow}>
        <Ionicons name="color-palette-outline" size={21} color="#BBA8FF" />
        <View style={styles.rankText}><LocalizedText style={styles.rankName}>Avatar bezagi</LocalizedText><LocalizedText style={styles.rankHint}>{profile.avatarDecoration || 'Standart'}</LocalizedText></View>
      </GlassSurface>
      <GlassSurface intensity={isDark ? 30 : 38} style={styles.cosmeticRow}>
        {profile.profileBadge ? <AnimatedBadge value={profile.profileBadge} size={38} /> : <Ionicons name="medal-outline" size={21} color="#EFCB78" />}
        <View style={styles.rankText}><LocalizedText style={styles.rankName}>Profil nishoni</LocalizedText><LocalizedText style={styles.rankHint}>{profile.profileBadge ? profile.profileBadge.toUpperCase() : 'Hozircha yo‘q'}</LocalizedText></View>
      </GlassSurface>
      <GlassSurface intensity={isDark ? 30 : 38} style={styles.cosmeticRow}>
        <Ionicons name="albums-outline" size={21} color="#8BCDF7" />
        <View style={styles.rankText}><LocalizedText style={styles.rankName}>Profil ramkasi</LocalizedText><LocalizedText style={styles.rankHint}>{profile.profileFrame || 'Standart'}</LocalizedText></View>
      </GlassSurface>
    </ScrollView>
    </View>
  );
}

function makeStyles(colors: ReturnType<typeof useTheme>['tokens']['colors'], isDark: boolean) {
  return StyleSheet.create({
    screen: { flex: 1, backgroundColor: colors.background, position: 'relative' },
    scroll: { flex: 1, backgroundColor: 'transparent' },
    content: { padding: 18, paddingBottom: 130 },
    loading: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: colors.background },
    back: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: 10, marginBottom: 12 },
    backText: { color: colors.text, fontSize: 14, fontWeight: '700' },
    empty: { color: colors.textMuted, textAlign: 'center', marginTop: 40 },
    hero: { alignItems: 'center', padding: 22, borderRadius: 27, borderWidth: 1, borderColor: colors.glassBorder, backgroundColor: isDark ? 'rgba(35,31,57,0.46)' : 'rgba(255,255,255,0.54)' },
    avatarEffectStage: { width: 184, height: 184, alignItems: 'center', justifyContent: 'center' },
    identityRow: { flexDirection: 'row', alignItems: 'center', gap: 15, width: '100%' },
    identityText: { flex: 1, minWidth: 0, alignItems: 'flex-start' },
    avatarRing: { width: 142, height: 142, borderRadius: 71, padding: 4, borderWidth: 2, borderColor: 'rgba(157,133,232,0.65)', flexShrink: 0 },
    frameAurora: { borderColor: '#A78BFA', borderWidth: 4 },
    frameRoyal: { borderColor: '#EFCB78', borderWidth: 4 },
    frameOcean: { borderColor: '#60A5FA', borderWidth: 4 },
    frameNeon3d: { borderColor: '#D8B4FE', borderWidth: 5, shadowColor: '#A855F7', shadowOpacity: 1, shadowRadius: 17, shadowOffset: { width: 0, height: 0 }, elevation: 14 },
    frameInferno3d: { borderColor: '#FDBA74', borderWidth: 5, shadowColor: '#F97316', shadowOpacity: 1, shadowRadius: 17, shadowOffset: { width: 0, height: 0 }, elevation: 14 },
    frameFrost3d: { borderColor: '#BAE6FD', borderWidth: 5, shadowColor: '#38BDF8', shadowOpacity: 1, shadowRadius: 17, shadowOffset: { width: 0, height: 0 }, elevation: 14 },
    frameGalaxy3d: { borderColor: '#C4B5FD', borderWidth: 5, shadowColor: '#818CF8', shadowOpacity: 1, shadowRadius: 18, shadowOffset: { width: 0, height: 0 }, elevation: 16 },
    avatar: { width: '100%', height: '100%', borderRadius: 50 },
    avatarFallback: { flex: 1, borderRadius: 50, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.surfaceElevated },
    initials: { color: colors.text, fontSize: 39, fontWeight: '800' },
    decoration: { position: 'absolute', right: -3, bottom: 0, width: 30, height: 30, borderRadius: 15, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.glassBorder },
    profileBadge: { position: 'absolute', left: -3, top: -3, width: 30, height: 30, borderRadius: 15, alignItems: 'center', justifyContent: 'center', backgroundColor: '#44351D', borderWidth: 2, borderColor: '#D6B66A' },
    name: { color: colors.text, fontSize: 20, fontWeight: '800', textAlign: 'left' },
    username: { color: colors.primary, fontSize: 12, marginTop: 4, fontWeight: '700' },
    bio: { color: colors.textSecondary, fontSize: 12, lineHeight: 18, textAlign: 'left', marginTop: 8 },
    counts: { flexDirection: 'row', alignItems: 'center', width: '100%', marginTop: 21, marginBottom: 16 },
    count: { flex: 1, alignItems: 'center' },
    countNumber: { color: colors.text, fontSize: 19, fontWeight: '800' },
    countLabel: { color: colors.textMuted, fontSize: 11, marginTop: 3 },
    separator: { width: 1, height: 30, backgroundColor: colors.border },
    socialActions: { flexDirection: 'row', gap: 9, marginTop: 14 },
    messageButton: { flex: 1, minHeight: 44, borderRadius: 14, borderWidth: 1, borderColor: colors.glassBorder, backgroundColor: isDark ? 'rgba(137,111,255,0.12)' : 'rgba(137,111,255,0.08)', flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 7 },
    messageButtonText: { color: colors.primary, fontSize: 11, fontWeight: '900' },
    followButton: { flex: 1, width: '100%', height: 46, borderRadius: 14, backgroundColor: colors.primary, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, marginTop: 0 },
    followingButton: { backgroundColor: colors.surfaceElevated, borderWidth: 1, borderColor: colors.border },
    followButtonText: { color: '#FFFFFF', fontSize: 13, fontWeight: '800' },
    followingText: { color: colors.text },
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