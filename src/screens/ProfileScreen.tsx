import { LocalizedText, LocalizedTextInput, showLocalizedAlert } from '../i18n/LocalizedText';
import React, { useEffect, useState } from 'react';
import Animated, { useAnimatedScrollHandler, useSharedValue, withSpring, type SharedValue } from 'react-native-reanimated';
import { ActivityIndicator, AppState, Image, Modal, Pressable, ScrollView, StyleSheet, Text as NativeText, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import * as Clipboard from 'expo-clipboard';
import BookWingsAvatar from '../components/BookWingsAvatar';
import LaurelWreathAvatar from '../components/LaurelWreathAvatar';
import AnimatedBadge from '../components/AnimatedBadge';
import ProfileEffect from '../components/ProfileEffect';
import { RankBadge3D } from '../components/RankBadge3D';
import ProfileAtmosphere from '../components/ProfileAtmosphere';

import { useAuth } from '../context/AuthContext';
import { useTheme } from '../theme/ThemeContext';
import { followUser, getPublicUserProfile, getUserSuggestions, type PublicUser, type UserSuggestion } from '../services/userService';
import { getProfileAchievements } from '../utils/profileAchievements';
import { getLearningHistory, getLearningHistoryItem, type LearningHistoryItem, type LearningHistorySummary } from '../services/learningService';
import { getDailyTasks, claimDailyTask, type DailyTask } from '../services/dailyTasksService';

interface ProfileScreenProps {
  onClosePress?: () => void;
  onSettingsPress?: () => void;
  onEditPress?: () => void;
  onPremiumPress?: () => void;
  onShopPress?: () => void;
  onTransactionsPress?: () => void;
  onUserPress?: (username: string) => void;
  dockStretch?: SharedValue<number>;
}

type ProfileTab = 'main' | 'board' | 'activity' | 'missions' | 'wallet';

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

export default function ProfileScreen({ onClosePress, onSettingsPress, onEditPress, onPremiumPress, onShopPress, onTransactionsPress, onUserPress, dockStretch }: ProfileScreenProps) {
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
    if (activeTab !== 'missions' || !user) return;
    let active = true;
    let firstLoad = true;
    const refreshDailyTasks = () => {
      if (firstLoad) setDailyTasksLoading(true);
      getDailyTasks()
        .then((result) => { if (active) setDailyTasks(result.tasks); })
        .catch((error) => {
          if (active && firstLoad) showLocalizedAlert('Vazifalar xatosi', error instanceof Error ? error.message : 'Vazifalar yuklanmadi');
        })
        .finally(() => {
          if (active && firstLoad) setDailyTasksLoading(false);
          firstLoad = false;
        });
    };
    refreshDailyTasks();
    // Refresh while this screen stays open across midnight, and whenever the app resumes.
    const interval = setInterval(refreshDailyTasks, 60_000);
    const appStateSubscription = AppState.addEventListener('change', (state) => {
      if (state === 'active') refreshDailyTasks();
    });
    return () => {
      active = false;
      clearInterval(interval);
      appStateSubscription.remove();
    };
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
    { key: 'main', label: 'Asosiy' },
    { key: 'board', label: 'Natijalar' },
    { key: 'activity', label: 'Faollik' },
    { key: 'missions', label: 'Vazifalar' },
    { key: 'wallet', label: 'Hamyon' },
  ];

  const renderCard = (children: React.ReactNode, extraStyle?: object, key?: string) => (
    <View key={key} style={[styles.card, extraStyle]}>{children}</View>
  );

  return (
    <View style={styles.screen}>
      <ProfileAtmosphere value={user.profileFrame} />
      <Animated.ScrollView onScroll={dockScrollHandler} scrollEventThrottle={16} style={styles.container} contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <View style={styles.header}>
          <Pressable style={styles.headerButton} onPress={onClosePress} accessibilityRole="button" accessibilityLabel="Profilni yopish">
            <Ionicons name="close" size={22} color={C.text} />
          </Pressable>
          <LocalizedText style={styles.headerTitle}>PROFIL</LocalizedText>
          <Pressable style={styles.headerButton} onPress={onSettingsPress} accessibilityRole="button" accessibilityLabel="Sozlamalar">
            <Ionicons name="settings-outline" size={21} color={C.text} />
          </Pressable>
        </View>

        <View style={styles.identity}>
          <ProfileEffect value={user.profileFrame} variant="hero" style={styles.avatarEffectStage}>
          <View style={[styles.avatarWrap, user.avatarDecoration === 'laurel_wreath' && styles.avatarWrapLaurel]}>
            {user.avatarDecoration === 'laurel_wreath' ? (
              <LaurelWreathAvatar size={132} imageUri={avatarUri} initials={initials || 'U'} frameColor={user.profileFrame === 'aurora' ? '#A78BFA' : user.profileFrame === 'royal' ? '#F2CE73' : user.profileFrame === 'ocean' ? '#60A5FA' : user.profileFrame === 'neon3d' ? '#E9D5FF' : user.profileFrame === 'inferno3d' ? '#FED7AA' : user.profileFrame === 'frost3d' ? '#BAE6FD' : user.profileFrame === 'galaxy3d' ? '#DDD6FE' : '#FBBF24'} />
            ) : user.avatarDecoration === 'book_wings' ? (
              <BookWingsAvatar size={116} imageUri={avatarUri} initials={initials || 'U'} frameColor={user.profileFrame === 'aurora' ? '#A78BFA' : user.profileFrame === 'royal' ? '#F2CE73' : user.profileFrame === 'ocean' ? '#60A5FA' : user.profileFrame === 'neon3d' ? '#E9D5FF' : user.profileFrame === 'inferno3d' ? '#FED7AA' : user.profileFrame === 'frost3d' ? '#BAE6FD' : user.profileFrame === 'galaxy3d' ? '#DDD6FE' : '#FBBF24'} />
            ) : (
            <View style={[styles.avatarFrame, user.profileFrame === 'aurora' && styles.frameAurora, user.profileFrame === 'royal' && styles.frameRoyal, user.profileFrame === 'ocean' && styles.frameOcean, user.profileFrame === 'neon3d' && styles.frameNeon3d, user.profileFrame === 'inferno3d' && styles.frameInferno3d, user.profileFrame === 'frost3d' && styles.frameFrost3d, user.profileFrame === 'galaxy3d' && styles.frameGalaxy3d]}>
              {avatarUri ? <Image source={{ uri: avatarUri }} style={styles.avatar} /> : <View style={styles.avatarFallback}><LocalizedText style={styles.avatarInitials}>{initials || '?'}</LocalizedText></View>}
            </View>
            )}
            {user.avatarDecoration && user.avatarDecoration !== 'book_wings' && user.avatarDecoration !== 'laurel_wreath' ? <View style={styles.decoration}><Ionicons name={user.avatarDecoration === 'crown' ? 'ribbon' : user.avatarDecoration === 'laurel' ? 'leaf' : 'star'} size={13} color="#F5D78A" /></View> : null}
            <Pressable style={styles.cameraButton} onPress={chooseAvatar} accessibilityRole="button" accessibilityLabel="Avatarni almashtirish">
              <Ionicons name="camera" size={18} color="#FFFFFF" />
            </Pressable>
          </View>
          </ProfileEffect>
          <View style={styles.identityInfo}>
            <View style={styles.nameRow}>
              <LocalizedText style={styles.displayName} numberOfLines={2}>{user.displayName}</LocalizedText>
            </View>
            <Pressable style={styles.handleRow} onPress={copyUsername}>
              <LocalizedText style={styles.handle}>@{user.username}</LocalizedText>
              <Ionicons name="copy-outline" size={13} color={C.subtle} />
            </Pressable>
            <View style={styles.badges}>
              <RankBadge3D tier={rankInfo.name} compact />
              {user.profileBadge ? <View style={styles.profileBadgeChip}><AnimatedBadge value={user.profileBadge} size={34} /><LocalizedText style={styles.profileBadgeText}>{user.profileBadge.toUpperCase()}</LocalizedText></View> : <LocalizedText style={styles.cardSubtitle}>Profil nishoni hali tanlanmagan</LocalizedText>}
            </View>
          </View>
        </View>

        <Pressable style={styles.editButton} onPress={onEditPress} disabled={!onEditPress}>
          <Ionicons name="create-outline" size={17} color="#FFFFFF" />
          <LocalizedText style={styles.editButtonText}>Profilni tahrirlash</LocalizedText>
        </Pressable>

        <View style={styles.tabs}>
          {tabs.map((tab) => (
            <Pressable key={tab.key} style={[styles.tab, activeTab === tab.key && styles.tabActive]} onPress={() => setActiveTab(tab.key)} accessibilityRole="tab" accessibilityState={{ selected: activeTab === tab.key }}>
              <LocalizedText style={[styles.tabText, activeTab === tab.key && styles.tabTextActive]}>{tab.label}</LocalizedText>
              
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
              <LocalizedText style={styles.sectionTitle}>Hamjamiyat</LocalizedText>
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

        {activeTab === 'wallet' ? (
          <>
            {renderCard(
              <View style={{ gap: 8 }}>
                <View style={styles.row}>
                  <View style={[styles.iconTile, { backgroundColor: 'rgba(232, 190, 92, 0.14)' }]}>
                    <Ionicons name="wallet" size={22} color="#D9B65B" />
                  </View>
                  <View style={styles.rowBody}>
                    <LocalizedText style={styles.cardTitle}>Zelqen Credits</LocalizedText>
                 