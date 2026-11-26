import { LocalizedText, LocalizedTextInput, showLocalizedAlert } from '../i18n/LocalizedText';
import React, { useEffect, useState } from 'react';
import Animated, { useAnimatedScrollHandler, useSharedValue, withSpring, type SharedValue } from 'react-native-reanimated';
import { ActivityIndicator, Image, Modal, Pressable, ScrollView, StyleSheet, Text as NativeText, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import * as Clipboard from 'expo-clipboard';
import BookWingsAvatar from '../components/BookWingsAvatar';

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
  onEditPress?: () => void;
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

export default function ProfileScreen({ onClosePress, onSettingsPress, onEditPress, onPremiumPress, onShopPress, onUserPress, dockStretch }: ProfileScreenProps) {
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
  const [avatarUri, setAvatarUri] = useState<string | null>(null);
  const [avatarPickerVisible, setAvatarPickerVisible] = useState(false);
  const [avatarCategory, setAvatarCategory] = useState<AvatarCategoryId>('anime');
  const [avatarSaving, setAvatarSaving] = useState(false);
  const [suggestions, setSuggestions] = useState<UserSuggestion[]>([]);
  const [socialProfile, setSocialProfile] = useState<PublicUser | null>(null);
  const [followingUserId, setFollowingUserId] = useState<string | null>(null);
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
            {user.avatarDecoration === 'book_wings' ? (
              <BookWingsAvatar size={122} imageUri={avatarUri} initials={initials || 'U'} frameColor={user.profileFrame === 'aurora' ? '#A78BFA' : user.profileFrame === 'royal' ? '#F2CE73' : user.profileFrame === 'ocean' ? '#60A5FA' : user.profileFrame === 'neon3d' ? '#E9D5FF' : user.profileFrame === 'inferno3d' ? '#FED7AA' : user.profileFrame === 'frost3d' ? '#BAE6FD' : user.profileFrame === 'galaxy3d' ? '#DDD6FE' : '#FBBF24'} />
            ) : (
            <View style={[styles.avatarFrame, user.profileFrame === 'aurora' && styles.frameAurora, user.profileFrame === 'royal' && styles.frameRoyal, user.profileFrame === 'ocean' && styles.frameOcean, user.profileFrame === 'neon3d' && styles.frameNeon3d, user.profileFrame === 'inferno3d' && styles.frameInferno3d, user.profileFrame === 'frost3d' && styles.frameFrost3d, user.profileFrame === 'galaxy3d' && styles.frameGalaxy3d]}>
              {avatarUri ? <Image source={{ uri: avatarUri }} style={styles.avatar} /> : <View style={styles.avatarFallback}><LocalizedText style={styles.avatarInitials}>{initials || '?'}</LocalizedText></View>}
            </View>
            )}
            {user.avatarDecoration && user.avatarDecoration !== 'book_wings' ? <View style={styles.decoration}><Ionicons name={user.avatarDecoration === 'crown' ? 'ribbon' : user.avatarDecoration === 'laurel' ? 'leaf' : 'star'} size={13} color="#F5D78A" /></View> : null}
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

        <Pressable style={styles.editButton} onPress={onEditPress} disabled={!onEditPress}>
          <Ionicons name="create-outline" size={17} color="#FFFFFF" />
          <LocalizedText style={styles.editButtonText}>Profilni tahrirlash</LocalizedText>
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

        {activeTab === 'missions' ? (
          <>
            <View style={styles.sectionHeader}>
              <View style={styles.rowBody}>
                <LocalizedText style={styles.sectionTitle}>Kunlik vazifalar</LocalizedText>
                <LocalizedText style={styles.cardSubtitle}>Har kuni Toshkent vaqti bilan yangilanadi. Vazifalarni bajaring va ZC oling.</LocalizedText>
              </View>
              <LocalizedText style={styles.linkText}>ZC</LocalizedText>
            </View>
            {dailyTasksLoading ? <ActivityIndicator color={C.purple} style={{ marginVertical: 24 }} /> : dailyTasks.map((task) => (
              renderCard(
                <View style={{ gap: 10 }}>
                  <View style={styles.row}>
                    <View style={styles.iconTile}><Ionicons name="trophy-outline" size={21} color={C.purple} /></View>
                    <View style={styles.rowBody}>
                      <LocalizedText style={styles.cardTitle}>{task.title}</LocalizedText>
                      <LocalizedText style={styles.cardSubtitle}>{task.description}</LocalizedText>
                    </View>
                    <NativeText style={{ color: '#D9B65B', fontWeight: '900' }}>+{task.reward} ZC</NativeText>
                  </View>
                  <View style={{ height: 7, borderRadius: 6, backgroundColor: C.surfaceRaised, overflow: 'hidden' }}>
                    <View style={{ height: 7, width: `${Math.min(100, (task.progress / task.target) * 100)}%`, borderRadius: 6, backgroundColor: '#65C99A' }} />
                  </View>
                  <View style={[styles.row, { minHeight: 34 }]}>
                    <LocalizedText style={styles.cardSubtitle}>{task.progress}/{task.target} bajarildi</LocalizedText>
                    <Pressable style={[styles.followButton, (!task.completed || task.claimed || claimingTaskId !== null) && { opacity: 0.5 }]} disabled={!task.completed || task.claimed || claimingTaskId !== null} onPress={() => void claimTaskReward(task)}>
                      {claimingTaskId === task.id ? <ActivityIndicator size="small" color="#FFFFFF" /> : <LocalizedText style={styles.followButtonText}>{task.claimed ? 'Olingan' : task.completed ? 'Mukofotni olish' : 'Davom eting'}</LocalizedText>}
                    </Pressable>
                  </View>
                </View>,
                undefined,
                task.id,
              )
            ))}
            {!dailyTasksLoading && dailyTasks.length === 0 ? renderCard(<LocalizedText style={styles.cardSubtitle}>Hozircha kunlik vazifalar mavjud emas.</LocalizedText>) : null}
            <LocalizedText style={[styles.cardSubtitle, { marginTop: 8 }]}>Eslatma: ZC — ilova ichidagi virtual ball. Uni hozircha naqd pulga yechib bo‘lmaydi.</LocalizedText>
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
    frameNeon3d: { backgroundColor: '#7C3AED', borderColor: '#D8B4FE', borderWidth: 5, shadowColor: '#A855F7', shadowOpacity: 0.95, shadowRadius: 16, shadowOffset: { width: 0, height: 0 }, elevation: 14 },
    frameInferno3d: { backgroundColor: '#EA580C', borderColor: '#FDBA74', borderWidth: 5, shadowColor: '#F97316', shadowOpacity: 0.95, shadowRadius: 16, shadowOffset: { width: 0, height: 0 }, elevation: 14 },
    frameFrost3d: { backgroundColor: '#0284C7', borderColor: '#BAE6FD', borderWidth: 5, shadowColor: '#38BDF8', shadowOpacity: 0.95, shadowRadius: 16, shadowOffset: { width: 0, height: 0 }, elevation: 14 },
    frameGalaxy3d: { backgroundColor: '#4338CA', borderColor: '#C4B5FD', borderWidth: 5, shadowColor: '#818CF8', shadowOpacity: 0.95, shadowRadius: 18, shadowOffset: { width: 0, height: 0 }, elevation: 16 },
    profileBadgeChip: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 10, paddingVertical: 6, borderRadius: 14, backgroundColor: 'rgba(214,182,106,0.14)', borderWidth: 1, borderColor: '#B88F45' },
    profileBadgeText: { color: '#D6B66A', fontSize: 10, fontWeight: '900', letterSpacing: 0.5 },
    shopHero: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 15, borderRadius: 20, backgroundColor: C.surfaceRaised, borderWidth: 1, borderColor: C.border, marginBottom: 13 },
    shopHeroIcon: { width: 44, height: 44, borderRadius: 15, alignItems: 'center', justifyContent: 'center', backgroundColor: C.purple },
    shopHeroTitle: { color: C.text, fontSize: 15, fontWeight: '900', letterSpacing: 1 },
    shopBalance: { alignItems: 'flex-end' },
    shopBalanceValue: { color: '#D9B65B', fontSize: 19, fontWeight: '900' },
    shopBalanceLabel: { color: C.muted, fontSize: 10, fontWeight: '800' },
    shopFilters: { flexDirection: 'row', flexWrap: 'wrap', gap: 7, marginBottom: 13 },
    shopFilter: { paddingHorizontal: 12, paddingVertical: 8, borderRadius: 20, borderWidth: 1, borderColor: C.border, backgroundColor: C.surface },
    shopFilterActive: { backgroundColor: C.purple, borderColor: C.purple },
    shopFilterText: { color: C.muted, fontSize: 11, fontWeight: '700' },
    shopFilterTextActive: { color: '#FFFFFF' },
    shopGrid: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between', rowGap: 11 },
    shopProduct: { width: '48.5%', minHeight: 205, padding: 11, borderRadius: 18, borderWidth: 1, borderColor: C.border, backgroundColor: C.surface },
    shopProductPreview: { height: 84, alignItems: 'center', justifyContent: 'center', marginBottom: 7, position: 'relative' },
    shopAvatarPreview: { width: 64, height: 64, borderRadius: 32, borderWidth: 3, borderColor: C.purple, backgroundColor: C.surfaceRaised, alignItems: 'center', justifyContent: 'center' },
    shop3dPill: { position: 'absolute', top: 0, right: 3, backgroundColor: '#8B5CF6', paddingHorizontal: 7, paddingVertical: 3, borderRadius: 8 },
    shop3dText: { color: '#FFFFFF', fontSize: 9, fontWeight: '900' },
    shopProductName: { color: C.text, fontSize: 13, fontWeight: '800' },
    shopProductDescription: { color: C.muted, fontSize: 10, lineHeight: 14, minHeight: 29, marginTop: 3 },
    shopProductBottom: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 4, marginTop: 9 },
    shopPrice: { color: '#D9B65B', fontSize: 11, fontWeight: '900', flexShrink: 1 },
    shopBuyButton: { backgroundColor: C.purple, borderRadius: 10, paddingHorizontal: 10, paddingVertical: 8, minWidth: 62, alignItems: 'center' },
    shopEquippedButton: { backgroundColor: C.surfaceRaised },
    shopBuyText: { color: '#FFFFFF', fontSize: 10, fontWeight: '800' },
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