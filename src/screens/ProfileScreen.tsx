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
import { getLearningHistory, getLearningHistoryItem, type LearningHistoryItem, type LearningHistorySummary } from '../services/learningService';
import { getZcHistory, type ZcTransactionItem } from '../services/zcWalletService';
import { getDailyTasks, claimDailyTask, type DailyTask } from '../services/dailyTasksService';

interface ProfileScreenProps {
  onClosePress?: () => void;
  onSettingsPress?: () => void;
  onPremiumPress?: () => void;
  onShopPress?: () => void;
  onUserPress?: (username: string) => void;
  dockStretch?: SharedValue<number>;
}

type ProfileTab = 'main' | 'board' | 'activity' | 'missions';

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

export default function ProfileScreen({ onClosePress, onSettingsPress, onPremiumPress, onShopPress, onUserPress, dockStretch }: ProfileScreenProps) {
  const { user, updateProfile, refreshUser, logout } = useAuth();
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
  const [zcHistory, setZcHistory] = useState<ZcTransactionItem[]>([]);
  const [zcHistoryLoading, setZcHistoryLoading] = useState(false);
  const [dailyTasks, setDailyTasks] = useState<DailyTask[]>([]);
  const [dailyTasksLoading, setDailyTasksLoading] = useState(false);
  const [claimingTaskId, setClaimingTaskId] = useState<string | null>(null);

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
    if (activeTab !== 'main' || !user) return;
    let active = true;
    setZcHistoryLoading(true);
    getZcHistory(5)
      .then((result) => { if (active) setZcHistory(result.items); })
      .catch(() => { if (active) setZcHistory([]); })
      .finally(() => { if (active) setZcHistoryLoading(false); });
    return () => { active = false; };
  }, [activeTab, user?.id]);

  useEffect(() => {
    if (activeTab !== 'missions' || !user) return;
    let active = true;
    setDailyTasksLoading(true);
    getDailyTasks()
      .then((result) => { if (active) setDailyTasks(result.tasks); })
      .catch((error) => { if (active) showLocalizedAlert('Vazifalar xatosi', error instanceof Error ? error.message : 'Vazifalar yuklanmadi'); })
      .finally(() => { if (active) setDailyTasksLoading(false); });
    return () => { active = false; };
  }, [activeTab, user?.id]);



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


  const claimTaskReward = async (task: DailyTask) => {
    if (!task.completed || task.claimed || claimingTaskId) return;
    setClaimingTaskId(task.id);
    try {
      const result = await claimDailyTask(task.id);
      setDailyTasks((current) => current.map((item) => item.id === task.id ? { ...item, claimed: true } : item));
      await refreshUser();
      showLocalizedAlert('Mukofot olindi', `+${result.reward} ZC balansingizga qo‘shildi.`);
    } catch (error) {
      showLocalizedAlert('Mukofot olinmadi', error instanceof Error ? error.message : 'Qayta urinib ko‘ring.');
    } finally {
      setClaimingTaskId(null);
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
    { key: 'missions', label: 'Vazifalar' },
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
            <View style={[styles.avatarFrame, user.profileFrame === 'aurora' && styles.frameAurora, user.profileFrame === 'royal' && styles.frameRoyal, user.profileFrame === 'ocean' && styles.frameOcean, user.profileFrame === 'neon3d' && styles.frameNeon3d, user.profileFrame === 'inferno3d' && styles.frameInferno3d, user.profileFrame === 'frost3d' && styles.frameFrost3d, user.profileFrame === 'galaxy3d' && styles.frameGalaxy3d]}>
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
            {user.profileBadge ? <View style={styles.profileBadgeChip}><Ionicons name={user.profileBadge === 'legend' ? 'ribbon' : user.profileBadge === 'champion' ? 'trophy' : user.profileBadge === 'scholar' ? 'book' : 'flame'} size={16} color="#F5D27A" /><LocalizedText style={styles.profileBadgeText}>{user.profileBadge.toUpperCase()}</LocalizedText></View> : <LocalizedText style={styles.cardSubtitle}>Profil nishoni hali tanlanmagan</LocalizedText>}
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
              <View style={styles.row}>
                <View style={[styles.iconTile, { backgroundColor: 'rgba(232, 190, 92, 0.14)' }]}>
                  <Ionicons name="wallet-outline" size={21} color="#D9B65B" />
                </View>
                <View style={styles.rowBody}>
                  <LocalizedText style={styles.cardTitle}>Zelqen Credits</LocalizedText>
                  <LocalizedText style={styles.cardSubtitle}>Ilova ichidagi virtual valyuta</LocalizedText>
                </View>
                <NativeText style={{ color: '#D9B65B', fontSize: 16, fontWeight: '900' }}>
                  {Math.max(0, Number(user.zcBalance ?? 0)).toLocaleString('en-US')} ZC
                </NativeText>
              </View>,
            )}
            {renderCard(
              <View style={{ gap: 11 }}>
                <View style={styles.row}>
                  <View style={styles.rowBody}>
                    <LocalizedText style={styles.cardTitle}>ZC tranzaksiyalari</LocalizedText>
                    <LocalizedText style={styles.cardSubtitle}>Oxirgi kirim va sarflar</LocalizedText>
                  </View>
                  {zcHistoryLoading ? <ActivityIndicator size="small" color={C.purple} /> : null}
                </View>
                {!zcHistoryLoading && zcHistory.length === 0 ? (
                  <LocalizedText style={styles.cardSubtitle}>Hozircha tranzaksiyalar yo‘q.</LocalizedText>
                ) : zcHistory.map((item) => (
                  <View key={item.id} style={[styles.row, { paddingTop: 8, borderTopWidth: 1, borderTopColor: C.border }]}>
                    <View style={[styles.iconTile, { backgroundColor: item.type === 'credit' ? 'rgba(76, 175, 125, 0.13)' : 'rgba(226, 140, 155, 0.13)' }]}>
                      <Ionicons name={item.type === 'credit' ? 'arrow-down' : 'arrow-up'} size={19} color={item.type === 'credit' ? '#55B98A' : '#E28C9B'} />
                    </View>
                    <View style={styles.rowBody}>
                      <LocalizedText style={styles.cardTitle}>{item.reason}</LocalizedText>
                      <LocalizedText style={styles.cardSubtitle}>{new Date(item.createdAt).toLocaleDateString()}</LocalizedText>
                    </View>
                    <NativeText style={{ color: item.type === 'credit' ? '#55B98A' : '#E28C9B', fontSize: 14, fontWeight: '900' }}>
                      {item.type === 'credit' ? '+' : '−'}{item.amount.toLocaleString('en-US')} ZC
                    </NativeText>
                  </View>
                ))}
              </View>,
            )}
            {renderCard(
              <Pressable style={styles.row} onPress={onShopPress}>
                <View style={styles.iconTile}><Ionicons name="bag-handle-outline" size={21} color="#D9B65B" /></View>
                <View style={styles.rowBody}>
                  <LocalizedText style={styles.cardTitle}>Shop</LocalizedText>
                  <LocalizedText style={styles.cardSubtitle}>Profil nishonlari, ramkalar va 3D effektlar</LocalizedText>
                </View>
                <Ionicons name="chevron-forward" size={19} color={C.muted} />
              </Pressable>,
              styles.premiumCard,
            )}
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
                        {person.avatarUrl ? <Image source={{ uri: person.avatarUrl }} style={styles.personAvatar} /> : <View style={styles.friendFallback}><LocalizedText style={styles.friendInitial}>{person.displayName.slice(0, 1).toUpperCase()}</LocalizedText></View>