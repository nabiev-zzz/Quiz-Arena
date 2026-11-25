import { LocalizedText, LocalizedTextInput, showLocalizedAlert } from '../i18n/LocalizedText';
import React, { useEffect, useState } from 'react';
import Animated, { useAnimatedScrollHandler, useSharedValue, withSpring, type SharedValue } from 'react-native-reanimated';
import { ActivityIndicator, Alert, Image, Modal, Pressable, ScrollView, StyleSheet, Text as NativeText, TextInput as NativeTextInput, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import * as Clipboard from 'expo-clipboard';

import { useAuth } from '../context/AuthContext';
import { useTheme } from '../theme/ThemeContext';
import { followUser, getPublicUserProfile, getUserSuggestions, type PublicUser, type UserSuggestion } from '../services/userService';
import { getProfileAchievements } from '../utils/profileAchievements';
import { RankBadge3D } from '../components/RankBadge3D';
import { getLearningHistory, getLearningHistoryItem, type LearningHistoryItem, type LearningHistorySummary } from '../services/learningService';

interface ProfileScreenProps {
  onClosePress?: () => void;
  onSettingsPress?: () => void;
  onPremiumPress?: () => void;
  onUserPress?: (username: string) => void;
  dockStretch?: SharedValue<number>;
}

type ProfileTab = 'main' | 'board' | 'activity' | 'wishlist';

const AVATAR_CATEGORIES = [
  { id: 'anime', label: 'Anime', style: 'lorelei', seeds: ['Aiko', 'Hana', 'Akira', 'Yuki', 'Ren', 'Sora', 'Mika', 'Kai'] },
  { id: 'gaming', label: 'Gaming', style: 'pixel-art', seeds: ['PlayerOne', 'NightWolf', 'Shadow', 'Blaze', 'Nova', 'Vortex', 'Ranger', 'Phantom'] },
  { id: 'robots', label: 'Robotlar', style: 'bottts', seeds: ['Atlas', 'RoboX', 'Circuit', 'Byte', 'Mecha', 'Neon', 'Orbit', 'Titan'] },
  { id: 'fantasy', label: 'Fantasy', style: 'adventurer', seeds: ['Arwen', 'Draco', 'Luna', 'Orion', 'Elara', 'Phoenix', 'Merlin', 'Raven'] },
  { id: 'animals', label: 'Hayvonlar', style: 'fun-emoji', seeds: ['Fox', 'Panda', 'Tiger', 'Koala', 'Wolf', 'Cat', 'Lion', 'Bear'] },
  { id: 'minimal', label: 'Minimal', style: 'notionists', seeds: ['Calm', 'Pure', 'Mono', 'Soft', 'Cloud', 'Muse', 'Echo', 'Zen'] },
  { id: 'cartoon', label: 'Cartoon', style: 'avataaars', seeds: ['Sunny', 'Milo', 'Coco', 'Leo', 'Ruby', 'Max', 'Bella', 'Theo'] },
  { id: 'emoji', label: 'Emoji', style: 'thumbs', seeds: ['Happy', 'Cool', 'Smart', 'Brave', 'Lucky', 'Chill', 'Star', 'Hero'] },
] as const;

type AvatarCategoryId = typeof AVATAR_CATEGORIES[number]['id'];

function getAvatarUrl(style: string, seed: string) {
  return `https://api.dicebear.com/9.x/${style}/png?seed=${encodeURIComponent(seed)}&size=160`;
}

export default function ProfileScreen({ onClosePress, onSettingsPress, onPremiumPress, onUserPress, dockStretch }: ProfileScreenProps) {
  const { user, updateProfile, logout } = useAuth();
  const { tokens, isDark } = useTheme();
  const C = {
    background: tokens.colors.background,
    surface: tokens.colors.surface,
    surfaceRaised: tokens.colors.surfaceElevated,
    border: tokens.colors.border,
    purple: tokens.colors.primary,
    purpleSoft: isDark ? '#24183D' : '#EEE9FF',
    text: tokens.colors.text,
    muted: tokens.colors.textMuted,
    subtle: tokens.colors.textMuted,
  };
  const styles = makeStyles(C);
  const lastDockScrollY = useSharedValue(0);
  const dockScrollHandler = useAnimatedScrollHandler({
    onScroll: (event) => {
      if (!dockStretch) return;
      const nextY = event.contentOffset.y;
      const delta = nextY - lastDockScrollY.value;
      lastDockScrollY.value = nextY;
      dockStretch.value = withSpring(Math.max(-1, Math.min(1, delta / 30)), { damping: 11, stiffness: 160, mass: 0.7 });
    },
    onEndDrag: () => { if (dockStretch) dockStretch.value = withSpring(0); },
    onMomentumEnd: () => { if (dockStretch) dockStretch.value = withSpring(0); },
  });

  const [activeTab, setActiveTab] = useState<ProfileTab>('main');
  const [editVisible, setEditVisible] = useState(false);
  const [displayName, setDisplayName] = useState('');
  const [username, setUsername] = useState('');
  const [bio, setBio] = useState('');
  const [avatarUri, setAvatarUri] = useState<string | null>(null);
  const [avatarPickerVisible, setAvatarPickerVisible] = useState(false);
  const [avatarCategory, setAvatarCategory] = useState<AvatarCategoryId>('anime');
  const [avatarSaving, setAvatarSaving] = useState(false);
  const [saving, setSaving] = useState(false);
  const [suggestions, setSuggestions] = useState<UserSuggestion[]>([]);
  const [socialProfile, setSocialProfile] = useState<PublicUser | null>(null);
  const [followingUserId, setFollowingUserId] = useState<string | null>(null);
  const [cosmeticType, setCosmeticType] = useState<'decoration' | 'frame' | null>(null);
  const [cosmeticSaving, setCosmeticSaving] = useState(false);
  const [learningHistory, setLearningHistory] = useState<LearningHistorySummary[]>([]);
  const [historyDetails, setHistoryDetails] = useState<Record<string, LearningHistoryItem>>({});
  const [historyLoading, setHistoryLoading] = useState(false);
  const [loadingHistoryDetailId, setLoadingHistoryDetailId] = useState<string | null>(null);
  const [expandedAttemptId, setExpandedAttemptId] = useState<string | null>(null);

  useEffect(() => {
    if (!user) return;
    setDisplayName(user.displayName);
    setUsername(user.username);
    setBio(user.bio ?? '');
    setAvatarUri(user.avatarUrl);
  }, [user]);

  useEffect(() => {
    if (activeTab !== 'activity') return;
    let active = true;
    setHistoryLoading(true);
    getLearningHistory()
      .then((items) => { if (active) setLearningHistory(items); })
      .catch(() => { if (active) setLearningHistory([]); })
      .finally(() => { if (active) setHistoryLoading(false); });
    return () => { active = false; };
  }, [activeTab]);

  useEffect(() => {
    if (!user) return;
    let active = true;
    Promise.all([getUserSuggestions(), getPublicUserProfile(user.username)])
      .then(([people, ownProfile]) => {
        if (!active) return;
        setSuggestions(people);
        setSocialProfile(ownProfile);
      })
      .catch(() => undefined);
    return () => { active = false; };
  }, [user?.id, user?.username]);

  if (!user) {
    return <View style={styles.loading}><ActivityIndicator size="large" color={C.purple} /></View>;
  }

  const rankPoints = Math.max(0, Number(user.rankPoints ?? 0));
  const rankTiers = [
    { name: 'Bronze', min: 0, color: '#CD7F32' },
    { name: 'Silver', min: 200, color: '#A8B0BD' },
    { name: 'Gold', min: 400, color: '#F5C542' },
    { name: 'Platinum', min: 600, color: '#67DCC5' },
    { name: 'Diamond', min: 800, color: '#60A5FA' },
    { name: 'Master', min: 1100, color: '#A78BFA' },
    { name: 'Grandmaster', min: 1400, color: '#F59E0B' },
  ];
  const rankIndex = Math.max(0, rankTiers.findIndex((tier, index) => rankPoints >= tier.min && (index === rankTiers.length - 1 || rankPoints < rankTiers[index + 1].min)));
  const rankInfo = rankTiers[rankIndex];
  const nextRank = rankTiers[rankIndex + 1];
  const rankProgress = nextRank ? Math.min(100, ((rankPoints - rankInfo.min) / (nextRank.min - rankInfo.min)) * 100) : 100;
  const initials = user.displayName.split(' ').filter(Boolean).map((part) => part[0]).join('').slice(0, 2).toUpperCase();

  const applyAvatar = async (uri: string | null) => {
    if (avatarSaving) return;
    setAvatarSaving(true);
    try {
      await updateProfile({ avatarUrl: uri });
      setAvatarUri(uri);
      setAvatarPickerVisible(false);
      showLocalizedAlert('Saqlandi', 'Avatar profilingizga saqlandi.');
    } catch (error) {
      showLocalizedAlert('Xatolik', error instanceof Error ? error.message : 'Avatarni saqlab bo‘lmadi.');
    } finally {
      setAvatarSaving(false);
    }
  };

  const chooseAvatar = () => setAvatarPickerVisible(true);

  const chooseFromGallery = async () => {
    try {
      const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (!permission.granted) {
        showLocalizedAlert('Ruxsat kerak', 'Avatar tanlash uchun galereyaga ruxsat bering.');
        return;
      }
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ['images'],
        allowsEditing: true,
        aspect: [1, 1],
        quality: 0.45,
        base64: true,
      });
      if (result.canceled || result.assets.length === 0) return;
      const asset = result.assets[0];
      if (!asset.base64) {
        showLocalizedAlert('Xatolik', 'Rasmni tayyorlab bo‘lmadi. Boshqa rasm tanlang.');
        return;
      }
      if (asset.base64.length > 850_000) {
        showLocalizedAlert('Rasm juda katta', 'Rasm hajmi katta. Uni kichraytirib, qayta tanlang.');
        return;
      }
      const mime = asset.mimeType === 'image/png' ? 'image/png' : asset.mimeType === 'image/webp' ? 'image/webp' : 'image/jpeg';
      await applyAvatar(`data:${mime};base64,${asset.base64}`);
    } catch (error) {
      showLocalizedAlert('Xatolik', error instanceof Error ? error.message : 'Rasm tanlashda xatolik yuz berdi.');
    }
  };

  const saveProfile = async () => {
    if (displayName.trim().length < 2) {
      showLocalizedAlert('Xatolik', 'Ism kamida 2 ta belgidan iborat bo‘lsin.');
      return;
    }
    if (!/^[a-zA-Z0-9_]{3,30}$/.test(username.trim())) {
      showLocalizedAlert('Xatolik', 'Username 3–30 belgi bo‘lsin. Faqat harf, raqam va _ ishlating.');
      return;
    }
    setSaving(true);
    try {
      await updateProfile({ displayName: displayName.trim(), username: username.trim(), bio: bio.trim() || null, ...(avatarUri !== user.avatarUrl ? { avatarUrl: avatarUri } : {}) });
      setEditVisible(false);
      showLocalizedAlert('Saqlandi', 'Profil ma’lumotlari yangilandi.');
    } catch (error) {
      showLocalizedAlert('Xatolik', error instanceof Error ? error.message : 'Profilni saqlashda xatolik yuz berdi.');
    } finally {
      setSaving(false);
    }
  };

  const saveCosmetic = async (value: string | null) => {
    if (!cosmeticType || cosmeticSaving) return;
    setCosmeticSaving(true);
    try {
      await updateProfile(cosmeticType === 'decoration' ? { avatarDecoration: value } : { profileFrame: value });
      setCosmeticType(null);
    } catch (error) {
      showLocalizedAlert('Xatolik', error instanceof Error ? error.message : 'Bezakni saqlab bo‘lmadi');
    } finally {
      setCosmeticSaving(false);
    }
  };

  const toggleHistoryAttempt = async (attemptId: string) => {
    if (expandedAttemptId === attemptId) {
      setExpandedAttemptId(null);
      return;
    }
    setExpandedAttemptId(attemptId);
    if (historyDetails[attemptId]) return;
    setLoadingHistoryDetailId(attemptId);
    try {
      const detail = await getLearningHistoryItem(attemptId);
      setHistoryDetails((current) => ({ ...current, [attemptId]: detail }));
    } catch (error) {
      showLocalizedAlert('Xatolik', error instanceof Error ? error.message : 'Test tahlilini yuklab bo‘lmadi.');
    } finally {
      setLoadingHistoryDetailId(null);
    }
  };

  const copyUsername = async () => {
    try {
      await Clipboard.setStringAsync('@' + user.username);
      showLocalizedAlert('Nusxalandi', 'Username buferga nusxalandi.');
    } catch { showLocalizedAlert('Xatolik', 'Username nusxalanmadi.'); }
  };

  const tabs: { key: ProfileTab; label: string }[] = [
    { key: 'main', label: 'Main' },
    { key: 'board', label: 'Board' },
    { key: 'activity', label: 'Tarix' },
    { key: 'wishlist', label: 'Wishlist' },
  ];

  const renderCard = (children: React.ReactNode, extraStyle?: object, key?: string) => (
    <View key={key} style={[styles.card, extraStyle]}>{children}</View>
  );

  return (
    <View style={styles.screen}>
      <Animated.ScrollView onScroll={dockScrollHandler} scrollEventThrottle={16} style={styles.container} contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <View style={styles.header}>
          <Pressable style={styles.headerButton} onPress={onClosePress} accessibilityRole="button" accessibilityLabel="Profilni yopish">
            <Ionicons name="close" size={22} color={C.text} />
          </Pressable>
          <LocalizedText style={styles.headerTitle}>PROFILE</LocalizedText>
          <Pressable style={styles.headerButton} onPress={onSettingsPress} accessibilityRole="button" accessibilityLabel="Sozlamalar">
            <Ionicons name="settings-outline" size={21} color={C.text} />
          </Pressable>
        </View>

        <View style={styles.identity}>
          <View style={styles.avatarWrap}>
            <View style={[styles.avatarFrame, user.profileFrame === 'aurora' && styles.frameAurora, user.profileFrame === 'royal' && styles.frameRoyal, user.profileFrame === 'ocean' && styles.frameOcean]}>
              {avatarUri ? <Image source={{ uri: avatarUri }} style={styles.avatar} /> : <View style={styles.avatarFallback}><LocalizedText style={styles.avatarInitials}>{initials || '?'}</LocalizedText></View>}
            </View>
            {user.avatarDecoration ? <View style={styles.decoration}><Ionicons name={user.avatarDecoration === 'crown' ? 'ribbon' : user.avatarDecoration === 'laurel' ? 'leaf' : 'star'} size={13} color="#F5D78A" /></View> : null}
            <Pressable style={styles.cameraButton} onPress={chooseAvatar} accessibilityRole="button" accessibilityLabel="Avatarni almashtirish">
              <Ionicons name="camera" size={15} color="#FFFFFF" />
            </Pressable>
          </View>
          <View style={styles.nameRow}>
            <LocalizedText style={styles.displayName} numberOfLines={1}>{user.displayName}</LocalizedText>
            <Ionicons name="chevron-down" size={17} color={C.muted} />
          </View>
          <Pressable style={styles.handleRow} onPress={copyUsername}>
            <LocalizedText style={styles.handle}>@{user.username}</LocalizedText>
            <Ionicons name="copy-outline" size={13} color={C.subtle} />
          </Pressable>
          <View style={styles.badges}>
            <RankBadge3D tier={rankInfo.name} />
            <View style={styles.rankBadgeCaption}>
              <LocalizedText style={styles.rankBadgeTitle}>{rankInfo.name} ligasi</LocalizedText>
              <LocalizedText style={styles.rankBadgeSubtitle}>Reyting nishoni</LocalizedText>
            </View>
          </View>
        </View>

        <Pressable style={styles.editButton} onPress={() => setEditVisible(true)}>
          <Ionicons name="create-outline" size={17} color="#FFFFFF" />
          <LocalizedText style={styles.editButtonText}>Edit profile</LocalizedText>
        </Pressable>

        <View style={styles.tabs}>
          {tabs.map((tab) => (
            <Pressable key={tab.key} style={styles.tab} onPress={() => setActiveTab(tab.key)}>
              <LocalizedText style={[styles.tabText, activeTab === tab.key && styles.tabTextActive]}>{tab.label}</LocalizedText>
              {activeTab === tab.key ? <View style={styles.tabUnderline} /> : null}
            </Pressable>
          ))}
        </View>

        {activeTab === 'main' ? (
          <>
            {renderCard(
              <Pressable style={styles.row} onPress={onPremiumPress}>
                <View style={styles.iconTile}><Ionicons name="diamond-outline" size={21} color={C.purple} /></View>
                <View style={styles.rowBody}>
                  <LocalizedText style={styles.cardTitle}>Premium</LocalizedText>
                  <LocalizedText style={styles.cardSubtitle}>Maxsus imkoniyatlar va tariflar</LocalizedText>
                </View>
                <Ionicons name="chevron-forward" size={19} color={C.muted} />
              </Pressable>,
              styles.premiumCard,
            )}
            {renderCard(
              <Pressable style={styles.row} onPress={onPremiumPress}>
                <View style={styles.iconTile}><Ionicons name="storefront-outline" size={21} color={C.purple} /></View>
                <View style={styles.rowBody}>
                  <LocalizedText style={styles.cardTitle}>Shop</LocalizedText>
                  <LocalizedText style={styles.cardSubtitle}>Profil uchun qo‘shimcha imkoniyatlar</LocalizedText>
                </View>
                <Ionicons name="chevron-forward" size={19} color={C.muted} />
              </Pressable>,
            )}
            {renderCard(
              <View style={styles.bioRow}>
                <View style={styles.bioAccent} />
                <View style={styles.rowBody}>
                  <LocalizedText style={styles.cardTitle}>Bio</LocalizedText>
                  <LocalizedText style={styles.bioText}>{user.bio?.trim() || 'Tarjimai hol hali kiritilmagan'}</LocalizedText>
                </View>
              </View>,
            )}
            <View style={styles.sectionHeader}>
              <LocalizedText style={styles.sectionTitle}>Friends</LocalizedText>
              <Pressable onPress={() => onUserPress?.('discover')}><LocalizedText style={styles.linkText}>Barchasi <Ionicons name="chevron-forward" size={11} /></LocalizedText></Pressable>
            </View>
            {renderCard(
              <View style={styles.friendsHeader}>
                <View style={styles.avatarStack}>
                  {suggestions.slice(0, 5).map((person, index) => (
                    <Pressable key={person.id} onPress={() => onUserPress?.(person.username)} style={[styles.friendAvatarWrap, { marginLeft: index === 0 ? 0 : -12, zIndex: 5 - index }]}>
                      {person.avatarUrl ? <Image source={{ uri: person.avatarUrl }} style={styles.friendAvatar} /> : <View style={styles.friendFallback}><LocalizedText style={styles.friendInitial}>{person.displayName.slice(0, 1).toUpperCase()}</LocalizedText></View>}
                    </Pressable>
                  ))}
                  {suggestions.length === 0 ? <LocalizedText style={styles.cardSubtitle}>Hozircha do‘stlar tavsiya qilinmagan</LocalizedText> : null}
                </View>
                <Pressable onPress={() => onUserPress?.('discover')} hitSlop={10}><Ionicons name="chevron-forward" size={19} color={C.muted} /></Pressable>
              </View>,
            )}
            <View style={styles.memberRow}>
              <Ionicons name="people-outline" size={18} color={C.muted} />
              <LocalizedText style={styles.memberText}>{(socialProfile?.followersCount ?? 0) + ' kuzatuvchi · ' + (socialProfile?.followingCount ?? 0) + ' kuzatilayotgan'}</LocalizedText>
              <View style={styles.memberDot} />
            </View>
            {suggestions.length > 0 ? (
              <>
                <View style={styles.sectionHeader}><LocalizedText style={styles.sectionTitle}>Tavsiya etilganlar</LocalizedText></View>
                <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.suggestions}>
                  {suggestions.map((person) => (
                    <View key={person.id} style={styles.personCard}>
                      <Pressable onPress={() => onUserPress?.(person.username)} style={styles.personIdentity}>
                        {person.avatarUrl ? <Image source={{ uri: person.avatarUrl }} style={styles.personAvatar} /> : <View style={styles.friendFallback}><LocalizedText style={styles.friendInitial}>{person.displayName.slice(0, 1).toUpperCase()}</LocalizedText></View>}
                        <LocalizedText style={styles.personName} numberOfLines={1}>{person.displayName}</LocalizedText>
                        <LocalizedText style={styles.personMeta}>{person.followersCount} kuzatuvchi</LocalizedText>
                      </Pressable>
                      <Pressable style={styles.followButton} disabled={followingUserId === person.id} onPress={async () => {
                        setFollowingUserId(person.id);
                        try {
                          await followUser(person.id);
                          setSuggestions((current) => current.filter((item) => item.id !== person.id));
                          setSocialProfile((current) => current ? { ...current, followingCount: (current.followingCount ?? 0) + 1 } : current);
                        } catch (error) { showLocalizedAlert('Xatolik', error instanceof Error ? error.message : 'Kuzatib bo‘lmadi'); }
                        finally { setFollowingUserId(null); }
                      }}>
                        <LocalizedText style={styles.followButtonText}>{followingUserId === person.id ? '...' : 'Kuzatish'}</LocalizedText>
                      </Pressable>
                    </View>
                  ))}
                </ScrollView>
              </>
            ) : null}
          </>
        ) : null}

        {activeTab === 'board' ? (
          <>
            <View style={styles.sectionHeader}><LocalizedText style={styles.sectionTitle}>Natijalar</LocalizedText></View>
            <View style={styles.statsRow}>
              {[
                { icon: 'flash-outline' as const, value: user.xp ?? 0, label: 'Jami XP' },
                { icon: 'trophy-outline' as const, value: user.level ?? 1, label: 'Daraja' },
                { icon: 'medal-outline' as const, value: rankPoints, label: 'Reyting RP' },
              ].map((item) => renderCard(
                <View style={styles.statContent}>
                  <Ionicons name={item.icon} size={19} color={C.purple} />
                  <LocalizedText style={styles.statNumber}>{item.value}</LocalizedText>
                  <LocalizedText style={styles.cardSubtitle}>{item.label}</LocalizedText>
                </View>,
                styles.statCard,
                item.label,
              ))}
            </View>
            {renderCard(
              <>
                <View style={styles.row}>
                  <View style={styles.iconTile}><Ionicons name="medal-outline" size={21} color={rankInfo.color} /></View>
                  <View style={styles.rowBody}><LocalizedText style={styles.cardTitle}>{rankInfo.name} ligasi</LocalizedText><LocalizedText style={styles.cardSubtitle}>Battle reytingi</LocalizedText></View>
                  <LocalizedText style={[styles.rankPoints, { color: rankInfo.color }]}>{rankPoints} RP</LocalizedText>
                </View>
                <View style={styles.progressTrack}><View style={[styles.progressFill, { width: rankProgress + '%' }]} /></View>
                <LocalizedText style={styles.cardSubtitle}>{nextRank ? (nextRank.min - rankPoints) + ' RP dan keyingi liga' : 'Eng yuqori liga'}</LocalizedText>
              </>,
            )}
          </>
        ) : null}

        {activeTab === 'activity' ? (
          <>
            <View style={styles.sectionHeader}>
              <LocalizedText style={styles.sectionTitle}>Testlar tarixi</LocalizedText>
              <LocalizedText style={styles.cardSubtitle}>{learningHistory.length} ta urinish</LocalizedText>
            </View>
            {historyLoading ? (
              <ActivityIndicator color={C.purple} style={{ marginVertical: 18 }} />
            ) : learningHistory.length === 0 ? (
              <View style={styles.historyEmpty}>
                <Ionicons name="document-text-outline" size={28} color={C.muted} />
                <LocalizedText style={styles.cardSubtitle}>Hozircha saqlangan test tarixi yo‘q.</LocalizedText>
              </View>
            ) : learningHistory.map((attempt) => {
              const detail = historyDetails[attempt.id];
              return (
              <View key={attempt.id} style={styles.historyCard}>
                <Pressable style={styles.historyHeader} onPress={() => void toggleHistoryAttempt(attempt.id)}>
                  <View style={styles.historyIcon}><Ionicons name="document-text-outline" size={19} color={C.purple} /></View>
                  <View style={styles.rowBody}>
                    <LocalizedText style={styles.cardTitle} numberOfLines={1}>{attempt.subjectName} · {attempt.topicName}</LocalizedText>
                    <LocalizedText style={styles.cardSubtitle}>{new Date(attempt.completedAt).toLocaleString()} · {attempt.totalQuestions} ta savol</LocalizedText>
                  </View>
                  <View style={styles.historyScore}>
                    <LocalizedText style={styles.historyPercent}>{Math.round(Number(attempt.accuracy))}%</LocalizedText>
                    <LocalizedText style={styles.cardSubtitle}>{attempt.correctAnswers}/{attempt.totalQuestions}</LocalizedText>
                  </View>
                  <Ionicons name={expandedAttemptId === attempt.id ? 'chevron-up' : 'chevron-down'} size={17} color={C.muted} />
                </Pressable>
                {expandedAttemptId === attempt.id ? (
                  <View style={styles.historyReview}>
                    <LocalizedText style={styles.historyReviewTitle}>Savollar tahlili</LocalizedText>
                    {loadingHistoryDetailId === attempt.id ? <ActivityIndicator color={C.purple} /> : detail?.review?.length ? detail.review.map((item, index) => (
                      <View key={item.id} style={styles.historyQuestion}>
                        <LocalizedText style={styles.historyQuestionTitle}>{index + 1}. {item.question}</LocalizedText>
                        <LocalizedText style={styles.cardSubtitle}>Sizning javobingiz: {item.options[item.selectedAnswer] ?? '—'}</LocalizedText>
                        <LocalizedText style={[styles.cardSubtitle, { color: item.isCorrect ? '#35C995' : '#E47786', fontWeight: '800' }]}>To‘g‘ri javob: {item.options[item.correctAnswer] ?? '—'}</LocalizedText>
                        {!!item.explanation && <LocalizedText style={styles.cardSubtitle}>{item.explanation}</LocalizedText>}
                        {!!item.aiExplanation && (
                          <View style={styles.historyAiBox}>
                            <LocalizedText style={styles.historyAiTitle}>AI Ustoz tahlili</LocalizedText>
                            <LocalizedText style={styles.cardSubtitle}>{item.aiExplanation}</LocalizedText>
                          </View>
                        )}
                      </View>
                    )) : (
                      <LocalizedText style={styles.cardSubtitle}>Bu test natijasi eski formatda saqlangan. Batafsil savollar tahlili mavjud emas.</LocalizedText>
                    )}
                  </View>
                ) : null}
              </View>
              );
            })}
            <View style={styles.sectionHeader}><LocalizedText style={styles.sectionTitle}>Erishilgan yutuqlar</LocalizedText></View>
            <View style={styles.achievementList}>
              {getProfileAchievements(user.xp ?? 0, user.level ?? 1, rankPoints).map((achievement) => (
                <View key={achievement.id} style={[styles.achievement, !achievement.unlocked && styles.achievementLocked]}>
                  <Ionicons name={achievement.icon} size={21} color={achievement.unlocked ? C.purple : C.subtle} />
                  <View style={styles.rowBody}><LocalizedText style={styles.cardTitle}>{achievement.title}</LocalizedText><LocalizedText style={styles.cardSubtitle}>{achievement.description}</LocalizedText></View>
                  <Ionicons name={achievement.unlocked ? 'checkmark-circle' : 'lock-closed'} size={17} color={achievement.unlocked ? C.purple : C.subtle} />
                </View>
              ))}
            </View>
          </>
        ) : null}

        {activeTab === 'wishlist' ? (
          <>
            <View style={styles.sectionHeader}><LocalizedText style={styles.sectionTitle}>Mukofotlar va bezaklar</LocalizedText></View>
            {renderCard(
              <View style={styles.row}>
                <View style={styles.iconTile}><Ionicons name="medal-outline" size={21} color={C.purple} /></View>
                <View style={styles.rowBody}><LocalizedText style={styles.cardTitle}>Mening mukofotlarim</LocalizedText><LocalizedText style={styles.cardSubtitle}>Yutuqlar va medallar</LocalizedText></View>
              </View>,
            )}
            <Pressable onPress={() => setCosmeticType('decoration')}>
              {renderCard(<View style={styles.row}><View style={styles.iconTile}><Ionicons name="color-palette-outline" size={21} color={C.purple} /></View><View style={styles.rowBody}><LocalizedText style={styles.cardTitle}>Avatar bezaklari</LocalizedText><LocalizedText style={styles.cardSubtitle}>{user.avatarDecoration || 'Hozircha bezak tanlanmagan'}</LocalizedText></View><LocalizedText style={styles.linkText}>Sozlash</LocalizedText></View>)}
            </Pressable>
            <Pressable onPress={() => setCosmeticType('frame')}>
              {renderCard(<View style={styles.row}><View style={styles.iconTile}><Ionicons name="albums-outline" size={21} color={C.purple} /></View><View style={styles.rowBody}><LocalizedText style={styles.cardTitle}>Profil ramkasi</LocalizedText><LocalizedText style={styles.cardSubtitle}>{user.profileFrame || 'Standart ramka'}</LocalizedText></View><LocalizedText style={styles.linkText}>Sozlash</LocalizedText></View>)}
            </Pressable>
          </>
        ) : null}

        <Pressable style={styles.logoutButton} onPress={() => showLocalizedAlert('Hisobdan chiqish', 'Haqiqatan ham chiqmoqchimisiz?', [
          { text: 'Bekor qilish', style: 'cancel' },
          { text: 'Chiqish', style: 'destructive', onPress: () => { void logout(); } },
        ])}>
          <Ionicons name="log-out-outline" size={18} color="#E28C9B" />
          <LocalizedText style={styles.logoutText}>Hisobdan chiqish</LocalizedText>
        </Pressable>
      </Animated.ScrollView>

      <Modal visible={editVisible} transparent animationType="fade" onRequestClose={() => setEditVisible(false)}>
        <View style={styles.modalBackground}>
          <View style={styles.modalCard}>
            <View style={styles.modalHeader}><LocalizedText style={styles.modalTitle}>Edit profile</LocalizedText><Pressable onPress={() => setEditVisible(false)}><Ionicons name="close" size={22} color={C.text} /></Pressable></View>
            <LocalizedText style={styles.inputLabel}>Ismingiz</LocalizedText>
            <LocalizedTextInput style={styles.input} value={displayName} onChangeText={setDisplayName} placeholder="Ismingiz" placeholderTextColor={C.subtle} maxLength={100} />
            <LocalizedText style={styles.inputLabel}>Username</LocalizedText>
            <LocalizedTextInput style={styles.input} value={username} onChangeText={setUsername} placeholder="username" placeholderTextColor={C.subtle} autoCapitalize="none" maxLength={30} />
            <LocalizedText style={styles.inputLabel}>Bio</LocalizedText>
            <LocalizedTextInput style={[styles.input, styles.bioInput]} value={bio} onChangeText={setBio} placeholder="O‘zingiz haqingizda..." placeholderTextColor={C.subtle} multiline maxLength={500} />
            <Pressable style={[styles.saveButton, saving && styles.disabled]} onPress={() => void saveProfile()} disabled={saving}>
              {saving ? <ActivityIndicator color="#FFFFFF" /> : <LocalizedText style={styles.saveButtonText}>O‘zgarishlarni saqlash</LocalizedText>}
            </Pressable>
          </View>
        </View>
      </Modal>

      <Modal visible={avatarPickerVisible} transparent animationType="slide" onRequestClose={() => setAvatarPickerVisible(false)}>
        <View style={styles.modalBackground}>
          <View style={[styles.modalCard, styles.avatarModalCard]}>
            <View style={styles.modalHeader}>
              <View style={styles.avatarModalHeading}>
                <LocalizedText style={styles.modalTitle}>Avatar tanlash</LocalizedText>
                <LocalizedText style={styles.avatarModalSubtitle}>O‘zingizga mos uslubni tanlang</LocalizedText>
              </View>
              <Pressable onPress={() => setAvatarPickerVisible(false)} hitSlop={12}><Ionicons name="close" size={22} color={C.text} /></Pressable>
            </View>
            <Pressable style={styles.galleryButton} onPress={() => void chooseFromGallery()} disabled={avatarSaving}>
              <Ionicons name="images-outline" size={21} color="#FFFFFF" />
              <View style={styles.galleryButtonText}>
                <LocalizedText style={styles.galleryButtonTitle}>Galereyadan rasm tanlash</LocalizedText>
                <LocalizedText style={styles.galleryButtonHint}>O‘zingizning rasmingizni yuklang</LocalizedText>
              </View>
              <Ionicons name="chevron-forward" size={19} color="#FFFFFF" />
            </Pressable>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.avatarCategories}>
              {AVATAR_CATEGORIES.map((category) => (
                <Pressable key={category.id} onPress={() => setAvatarCategory(category.id)} style={[styles.avatarCategoryChip, avatarCategory === category.id && styles.avatarCategoryChipActive]}>
                  <LocalizedText style={[styles.avatarCategoryText, avatarCategory === category.id && styles.avatarCategoryTextActive]}>{category.label}</LocalizedText>
                </Pressable>
              ))}
            </ScrollView>
            <ScrollView style={styles.avatarGridScroll} contentContainerStyle={styles.avatarGrid} showsVerticalScrollIndicator={false}>
              {AVATAR_CATEGORIES.find((item) => item.id === avatarCategory)!.seeds.map((seed) => {
                const uri = getAvatarUrl(AVATAR_CATEGORIES.find((item) => item.id === avatarCategory)!.style, seed);
                return (
                  <Pressable key={seed} style={styles.avatarOption} disabled={avatarSaving} onPress={() => void applyAvatar(uri)}>
                    <Image source={{ uri }} style={styles.avatarOptionImage} />
                    <LocalizedText style={styles.avatarOptionName}>{seed}</LocalizedText>
                  </Pressable>
                );
              })}
            </ScrollView>
            <Pressable style={styles.removeAvatarButton} disabled={avatarSaving || !user.avatarUrl} onPress={() => void applyAvatar(null)}>
              <Ionicons name="person-remove-outline" size={17} color={C.muted} />
              <LocalizedText style={styles.removeAvatarText}>Standart avatarni ishlatish</LocalizedText>
            </Pressable>
            {avatarSaving ? <ActivityIndicator color={C.purple} style={{ marginTop: 10 }} /> : null}
          </View>
        </View>
      </Modal>

      <Modal visible={cosmeticType !== null} transparent animationType="fade" onRequestClose={() => setCosmeticType(null)}>
        <View style={styles.modalBackground}>
          <View style={styles.modalCard}>
            <View style={styles.modalHeader}><LocalizedText style={styles.modalTitle}>{cosmeticType === 'decoration' ? 'Avatar bezagini tanlang' : 'Profil ramkasini tanlang'}</LocalizedText><Pressable onPress={() => setCosmeticType(null)}><Ionicons name="close" size={22} color={C.text} /></Pressable></View>
            {(cosmeticType === 'decoration'
              ? [{ value: null, label: 'Standart bezak' }, { value: 'sparkle', label: 'Yulduzcha' }, { value: 'crown', label: 'Toj' }, { value: 'laurel', label: 'Laurel' }]
              : [{ value: null, label: 'Standart ramka' }, { value: 'aurora', label: 'Aurora' }, { value: 'royal', label: 'Royal' }, { value: 'ocean', label: 'Ocean' }]
            ).map((option) => {
              const selected = cosmeticType === 'decoration' ? user.avatarDecoration === option.value : user.profileFrame === option.value;
              return <Pressable key={option.label} style={[styles.cosmeticOption, selected && styles.cosmeticSelected]} disabled={cosmeticSaving} onPress={() => void saveCosmetic(option.value)}>
                <LocalizedText style={styles.cardTitle}>{option.label}</LocalizedText>
                {selected ? <Ionicons name="checkmark-circle" size={19} color={C.purple} /> : <Ionicons name="ellipse-outline" size={18} color={C.muted} />}
              </Pressable>;
            })}
            {cosmeticSaving ? <ActivityIndicator color={C.purple} style={{ marginTop: 12 }} /> : null}
          </View>
        </View>
      </Modal>
    </View>
  );
}

function makeStyles(C: { background: string; surface: string; surfaceRaised: string; border: string; purple: string; purpleSoft: string; text: string; muted: string; subtle: string }) {
  return StyleSheet.create({
    screen: { flex: 1, backgroundColor: C.background },
    container: { flex: 1, backgroundColor: C.background },
    content: { paddingHorizontal: 18, paddingTop: 8, paddingBottom: 132 },
    loading: { flex: 1, backgroundColor: C.background, justifyContent: 'center', alignItems: 'center' },
    header: { height: 48, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 },
    headerButton: { width: 40, height: 40, borderRadius: 14, backgroundColor: C.surface, borderWidth: 1, borderColor: C.border, alignItems: 'center', justifyContent: 'center' },
    headerTitle: { color: C.muted, fontSize: 11, fontWeight: '800', letterSpacing: 2 },
    identity: { alignItems: 'center', paddingTop: 8, paddingBottom: 19 },
    avatarWrap: { width: 122, height: 122, alignItems: 'center', justifyContent: 'center', marginBottom: 12 },
    avatarFrame: { width: 112, height: 112, borderRadius: 56, padding: 3, backgroundColor: C.purple, borderWidth: 2, borderColor: '#8B68E5' },
    frameAurora: { backgroundColor: '#8B72E8' },
    frameRoyal: { backgroundColor: '#D7A93F' },
    frameOcean: { backgroundColor: '#4D9FC8' },
    avatar: { width: '100%', height: '100%', borderRadius: 54 },
    avatarFallback: { flex: 1, borderRadius: 54, backgroundColor: C.surfaceRaised, alignItems: 'center', justifyContent: 'center' },
    avatarInitials: { color: C.text, fontSize: 29, fontWeight: '800' },
    cameraButton: { position: 'absolute', right: 2, bottom: 3, width: 33, height: 33, borderRadius: 17, backgroundColor: C.purple, borderWidth: 3, borderColor: C.background, alignItems: 'center', justifyContent: 'center' },
    decoration: { position: 'absolute', top: 2, left: 1, width: 27, height: 27, borderRadius: 14, backgroundColor: C.surfaceRaised, borderWidth: 1, borderColor: C.border, alignItems: 'center', justifyContent: 'center' },
    nameRow: { flexDirection: 'row', alignItems: 'center', gap: 6, maxWidth: '100%' },
    displayName: { color: C.text, fontSize: 25, fontWeight: '800', letterSpacing: -0.5, maxWidth: '90%' },
    handleRow: { flexDirection: 'row', alignItems: 'center', gap: 7, marginTop: 5 },
    handle: { color: C.muted, fontSize: 13 },
    badges: { flexDirection: 'row', alignItems: 'center', gap: 12, marginTop: 11 },
    rankBadgeCaption: { alignItems: 'flex-start', gap: 3 },
    rankBadgeTitle: { color: C.text, fontSize: 13, fontWeight: '900' },
    rankBadgeSubtitle: { color: C.muted, fontSize: 10, fontWeight: '600' },
    editButton: { height: 49, borderRadius: 15, backgroundColor: C.purple, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 9, marginBottom: 21 },
    editButtonText: { color: '#FFFFFF', fontSize: 14, fontWeight: '800' },
    tabs: { height: 49, flexDirection: 'row', alignItems: 'stretch', borderBottomWidth: 1, borderBottomColor: C.border, marginBottom: 17 },
    tab: { flex: 1, alignItems: 'center', justifyContent: 'space-between', paddingTop: 8 },
    tabText: { color: C.subtle, fontSize: 12, fontWeight: '700' },
    tabTextActive: { color: C.text },
    tabUnderline: { height: 3, width: '70%', borderRadius: 3, backgroundColor: C.purple },
    card: { backgroundColor: C.surface, borderWidth: 1, borderColor: C.border, borderRadius: 19, padding: 15, marginBottom: 11 },
    premiumCard: { borderColor: '#49306F' },
    row: { flexDirection: 'row', alignItems: 'center', gap: 12, minHeight: 46 },
    iconTile: { width: 42, height: 42, borderRadius: 13, backgroundColor: C.purpleSoft, alignItems: 'center', justifyContent: 'center' },
    rowBody: { flex: 1, minWidth: 0 },
    cardTitle: { color: C.text, fontSize: 14, fontWeight: '700' },
    cardSubtitle: { color: C.muted, fontSize: 11, lineHeight: 16, marginTop: 4 },
    bioRow: { flexDirection: 'row', gap: 12, minHeight: 49 },
    bioAccent: { width: 3, borderRadius: 3, backgroundColor: C.purple },
    bioText: { color: C.muted, fontSize: 12, lineHeight: 18, marginTop: 6 },
    sectionHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 13, marginBottom: 10 },
    sectionTitle: { color: C.text, fontSize: 16, fontWeight: '800' },
    linkText: { color: '#A98BEF', fontSize: 11, fontWeight: '700' },
    friendsHeader: { minHeight: 44, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
    avatarStack: { flexDirection: 'row', alignItems: 'center', minHeight: 38 },
    friendAvatarWrap: { width: 38, height: 38, borderRadius: 19, borderWidth: 2, borderColor: C.surface },
    friendAvatar: { width: 34, height: 34, borderRadius: 17 },
    friendFallback: { width: 34, height: 34, borderRadius: 17, backgroundColor: C.purpleSoft, alignItems: 'center', justifyContent: 'center' },
    friendInitial: { color: C.text, fontSize: 13, fontWeight: '800' },
    memberRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 7, marginBottom: 8, paddingHorizontal: 3 },
    memberText: { color: C.muted, fontSize: 11, flex: 1 },
    memberDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: '#70C9A5' },
    suggestions: { gap: 10, paddingBottom: 3 },
    personCard: { width: 124, alignItems: 'center', padding: 12, borderRadius: 17, borderWidth: 1, borderColor: C.border, backgroundColor: C.surface },
    personIdentity: { alignItems: 'center', width: '100%' },
    personAvatar: { width: 47, height: 47, borderRadius: 24, marginBottom: 8 },
    personName: { color: C.text, fontSize: 11, fontWeight: '800', maxWidth: '100%' },
    personMeta: { color: C.muted, fontSize: 9, marginTop: 4 },
    followButton: { marginTop: 9, paddingHorizontal: 13, paddingVertical: 7, borderRadius: 10, backgroundColor: C.purpleSoft },
    followButtonText: { color: '#BCA8F4', fontSize: 10, fontWeight: '800' },
    statsRow: { flexDirection: 'row', gap: 8, marginBottom: 11 },
    statCard: { flex: 1, paddingHorizontal: 10, paddingVertical: 14, marginBottom: 0 },
    statContent: { alignItems: 'flex-start', gap: 7 },
    statNumber: { color: C.text, fontSize: 20, fontWeight: '800' },
    rankPoints: { fontSize: 13, fontWeight: '800' },
    progressTrack: { height: 6, borderRadius: 4, backgroundColor: C.surfaceRaised, overflow: 'hidden', marginTop: 16, marginBottom: 8 },
    progressFill: { height: 6, borderRadius: 4, backgroundColor: C.purple },
    achievementList: { gap: 9 },
    historyCard: { backgroundColor: C.surface, borderWidth: 1, borderColor: C.border, borderRadius: 17, padding: 13, marginBottom: 9 },
    historyHeader: { minHeight: 55, flexDirection: 'row', alignItems: 'center', gap: 10 },
    historyIcon: { width: 38, height: 38, borderRadius: 12, backgroundColor: C.purpleSoft, alignItems: 'center', justifyContent: 'center' },
    historyScore: { alignItems: 'flex-end', marginRight: 2 },
    historyPercent: { color: C.purple, fontSize: 15, fontWeight: '900' },
    historyReview: { borderTopWidth: 1, borderTopColor: C.border, marginTop: 10, paddingTop: 12, gap: 10 },
    historyReviewTitle: { color: C.text, fontSize: 14, fontWeight: '900' },
    historyQuestion: { padding: 12, borderRadius: 13, backgroundColor: C.background, borderWidth: 1, borderColor: C.border, gap: 6 },
    historyQuestionTitle: { color: C.text, fontSize: 13, fontWeight: '800', lineHeight: 19 },
    historyAiBox: { padding: 10, borderRadius: 11, backgroundColor: C.purpleSoft, gap: 5 },
    historyAiTitle: { color: C.purple, fontSize: 11, fontWeight: '900' },
    historyEmpty: { alignItems: 'center', justifyContent: 'center', gap: 8, padding: 22, borderRadius: 16, borderWidth: 1, borderColor: C.border, backgroundColor: C.surface },
    achievement: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 14, borderRadius: 16, borderWidth: 1, borderColor: C.border, backgroundColor: C.surface },
    achievementLocked: { opacity: 0.55 },
    logoutButton: { minHeight: 47, borderRadius: 15, backgroundColor: C.surface, borderWidth: 1, borderColor: C.border, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 9, marginTop: 17 },
    logoutText: { color: '#E28C9B', fontSize: 12, fontWeight: '700' },
    modalBackground: { flex: 1, backgroundColor: 'rgba(5,3,12,0.78)', justifyContent: 'center', padding: 18 },
    modalCard: { backgroundColor: C.surface, borderRadius: 22, borderWidth: 1, borderColor: C.border, padding: 20 },
    modalHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 },
    modalTitle: { color: C.text, fontSize: 18, fontWeight: '800', flex: 1, paddingRight: 12 },
    inputLabel: { color: C.muted, fontSize: 12, fontWeight: '700', marginTop: 13, marginBottom: 7 },
    input: { minHeight: 46, borderRadius: 13, backgroundColor: C.background, borderWidth: 1, borderColor: C.border, color: C.text, paddingHorizontal: 13, fontSize: 14 },
    bioInput: { height: 82, textAlignVertical: 'top', paddingTop: 12 },
    saveButton: { minHeight: 48, backgroundColor: C.purple, borderRadius: 14, alignItems: 'center', justifyContent: 'center', marginTop: 20 },
    disabled: { opacity: 0.65 },
    saveButtonText: { color: '#FFFFFF', fontSize: 13, fontWeight: '800' },
    avatarModalCard: { maxHeight: '88%', paddingBottom: 14 },
    avatarModalHeading: { flex: 1, gap: 3 },
    avatarModalSubtitle: { color: C.muted, fontSize: 11 },
    galleryButton: { minHeight: 66, borderRadius: 15, backgroundColor: C.purple, flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 14, marginTop: 12 },
    galleryButtonText: { flex: 1, gap: 3 },
    galleryButtonTitle: { color: '#FFFFFF', fontSize: 13, fontWeight: '800' },
    galleryButtonHint: { color: 'rgba(255,255,255,0.76)', fontSize: 10 },
    avatarCategories: { gap: 8, paddingVertical: 14 },
    avatarCategoryChip: { paddingHorizontal: 13, paddingVertical: 9, borderRadius: 20, borderWidth: 1, borderColor: C.border, backgroundColor: C.background },
    avatarCategoryChipActive: { borderColor: C.purple, backgroundColor: C.purpleSoft },
    avatarCategoryText: { color: C.muted, fontSize: 11, fontWeight: '700' },
    avatarCategoryTextActive: { color: C.purple },
    avatarGridScroll: { flexGrow: 0, minHeight: 180 },
    avatarGrid: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between', paddingBottom: 8 },
    avatarOption: { width: '23%', alignItems: 'center', paddingVertical: 8, marginBottom: 7, borderRadius: 13, backgroundColor: C.background, borderWidth: 1, borderColor: C.border },
    avatarOptionImage: { width: 62, height: 62, borderRadius: 31, backgroundColor: C.surfaceRaised },
    avatarOptionName: { color: C.muted, fontSize: 9, marginTop: 5, fontWeight: '700' },
    removeAvatarButton: { minHeight: 42, borderRadius: 12, backgroundColor: C.background, borderWidth: 1, borderColor: C.border, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, marginTop: 9 },
    removeAvatarText: { color: C.muted, fontSize: 11, fontWeight: '700' },
    cosmeticOption: { minHeight: 48, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 13, borderRadius: 13, borderWidth: 1, borderColor: C.border, backgroundColor: C.background, marginTop: 8 },
    cosmeticSelected: { borderColor: C.purple, backgroundColor: C.purpleSoft },
  });
}
