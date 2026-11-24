import React, { useEffect, useState } from 'react';
import Animated, {
  useAnimatedScrollHandler,
  useSharedValue,
  withSpring,
  type SharedValue,
} from 'react-native-reanimated';
import {
  ActivityIndicator,
  Alert,
  Image,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import * as Clipboard from 'expo-clipboard';

import { useAuth } from '../context/AuthContext';
import { useTheme } from '../theme/ThemeContext';
import { GlassSurface } from '../components/ui';
import { followUser, getPublicUserProfile, getUserSuggestions, type PublicUser, type UserSuggestion } from '../services/userService';
import { getProfileAchievements } from '../utils/profileAchievements';

interface ProfileScreenProps {
  onClosePress?: () => void;
  onSettingsPress?: () => void;
  onPremiumPress?: () => void;
  onUserPress?: (username: string) => void;
  dockStretch?: SharedValue<number>;
}

export default function ProfileScreen({
  onClosePress,
  onSettingsPress,
  onPremiumPress,
  onUserPress,
  dockStretch,
}: ProfileScreenProps) {
  const { tokens, isDark } = useTheme();
  const colors = tokens.colors;
  const styles = makeStyles(colors, isDark);
  const lastDockScrollY = useSharedValue(0);
  const dockScrollHandler = useAnimatedScrollHandler({
    onScroll: (event) => {
      if (!dockStretch) return;
      const nextY = event.contentOffset.y;
      const delta = nextY - lastDockScrollY.value;
      lastDockScrollY.value = nextY;
      dockStretch.value = withSpring(
        Math.max(-1, Math.min(1, delta / 30)),
        { damping: 11, stiffness: 160, mass: 0.7 },
      );
    },
    onEndDrag: () => {
      if (dockStretch) {
        dockStretch.value = withSpring(0, {
          damping: 11,
          stiffness: 160,
          mass: 0.7,
        });
      }
    },
    onMomentumEnd: () => {
      if (dockStretch) {
        dockStretch.value = withSpring(0, {
          damping: 11,
          stiffness: 160,
          mass: 0.7,
        });
      }
    },
  });

  const { user, updateProfile, logout } = useAuth();
  const [activeProfileTab, setActiveProfileTab] = useState<'main' | 'board' | 'activity' | 'wishlist'>('main');
  const [editVisible, setEditVisible] = useState(false);
  const [displayName, setDisplayName] = useState('');
  const [username, setUsername] = useState('');
  const [bio, setBio] = useState('');
  const [avatarUri, setAvatarUri] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [suggestions, setSuggestions] = useState<UserSuggestion[]>([]);
  const [socialProfile, setSocialProfile] = useState<PublicUser | null>(null);
  const [followingUserId, setFollowingUserId] = useState<string | null>(null);
  const [cosmeticType, setCosmeticType] = useState<'decoration' | 'frame' | null>(null);
  const [cosmeticSaving, setCosmeticSaving] = useState(false);

  useEffect(() => {
    if (user) {
      setDisplayName(user.displayName);
      setUsername(user.username);
      setBio(user.bio ?? '');
      setAvatarUri(user.avatarUrl);
    }
  }, [user]);

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
    return (
      <View style={styles.loading}>
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
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
  const rankIndex = rankTiers.findIndex(
    (tier, index) =>
      rankPoints >= tier.min &&
      (index === rankTiers.length - 1 ||
        rankPoints < rankTiers[index + 1].min),
  );
  const rankInfo = rankTiers[Math.max(0, rankIndex)];
  const nextRank = rankTiers[rankIndex + 1];
  const rankProgress = nextRank
    ? Math.min(
        100,
        ((rankPoints - rankInfo.min) /
          (nextRank.min - rankInfo.min)) *
          100,
      )
    : 100;

  const saveCosmetic = async (value: string | null) => {
    if (!cosmeticType || cosmeticSaving) return;
    setCosmeticSaving(true);
    try {
      await updateProfile(cosmeticType === 'decoration' ? { avatarDecoration: value } : { profileFrame: value });
      setCosmeticType(null);
    } catch (error) {
      Alert.alert('Xatolik', error instanceof Error ? error.message : 'Bezakni saqlab bo‘lmadi');
    } finally {
      setCosmeticSaving(false);
    }
  };

  const copyUsername = async () => {
    try {
      await Clipboard.setStringAsync('@' + user.username);
      Alert.alert('Nusxalandi', 'Username buferga nusxalandi.');
    } catch {
      Alert.alert('Xatolik', 'Username nusxalanmadi.');
    }
  };

  const chooseAvatar = async () => {
    try {
      const permission =
        await ImagePicker.requestMediaLibraryPermissionsAsync();

      if (!permission.granted) {
        Alert.alert(
          'Ruxsat kerak',
          'Avatar tanlash uchun galereyaga ruxsat bering.',
        );
        return;
      }

      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ['images'],
        allowsEditing: true,
        aspect: [1, 1],
        quality: 0.8,
      });

      if (!result.canceled && result.assets.length > 0) {
        setAvatarUri(result.assets[0].uri);
      }
    } catch {
      Alert.alert('Xatolik', 'Rasm tanlashda xatolik yuz berdi.');
    }
  };

  const saveProfile = async () => {
    if (displayName.trim().length < 2) {
      Alert.alert('Xatolik', 'Ism kamida 2 ta belgidan iborat bo‘lsin.');
      return;
    }

    if (!/^[a-zA-Z0-9_]{3,30}$/.test(username.trim())) {
      Alert.alert(
        'Xatolik',
        'Username 3–30 belgi bo‘lsin. Faqat harf, raqam va _ ishlating.',
      );
      return;
    }

    setSaving(true);
    try {
      await updateProfile({
        displayName: displayName.trim(),
        username: username.trim(),
        bio: bio.trim() || null,
      });
      setEditVisible(false);
      Alert.alert('Muvaffaqiyatli', 'Profil ma’lumotlari saqlandi.');
    } catch (error) {
      Alert.alert(
        'Xatolik',
        error instanceof Error
          ? error.message
          : 'Profilni saqlashda xatolik yuz berdi.',
      );
    } finally {
      setSaving(false);
    }
  };

  const initials = user.displayName
    .split(' ')
    .filter(Boolean)
    .map((part) => part[0])
    .join('')
    .slice(0, 2)
    .toUpperCase();

  const glassIntensity = isDark ? 34 : 42;

  return (
    <View style={styles.screen}>
      <View pointerEvents="none" style={styles.ambientGlowTop} />
      <View pointerEvents="none" style={styles.ambientGlowBottom} />

      <Animated.ScrollView
        onScroll={dockScrollHandler}
        scrollEventThrottle={16}
        style={styles.container}
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.header}>
          <Pressable style={styles.headerButton} onPress={onClosePress} accessibilityRole="button" accessibilityLabel="Profilni yopish">
            <Ionicons name="close" size={22} color={colors.text} />
          </Pressable>
          <Text style={styles.profileHeaderLabel}>PROFILE</Text>
          <Pressable style={styles.headerButton} onPress={onSettingsPress} accessibilityRole="button" accessibilityLabel="Sozlamalarni ochish">
            <Ionicons name="settings-outline" size={21} color={colors.text} />
          </Pressable>
        </View>

        <GlassSurface intensity={glassIntensity} style={styles.heroCard}>
          <View style={styles.heroHighlight} />
          <View style={styles.heroTopLine}>
            <View style={styles.identityLabel}>
              <View style={styles.onlineDot} />
              <Text style={styles.identityLabelText}>PLAYER PROFILE</Text>
            </View>
            <View style={styles.rankPill}>
              <Ionicons name="shield-checkmark" size={13} color={rankInfo.color} />
              <Text style={[styles.rankPillText, { color: rankInfo.color }]}>
                {rankInfo.name.toUpperCase()}
              </Text>
            </View>
          </View>

          <View style={styles.identityBlock}>
            <View style={styles.avatarStage}>
              <View style={styles.avatarHalo} />
              <View style={[styles.avatarBorder, user.profileFrame === 'aurora' ? styles.frameAurora : user.profileFrame === 'royal' ? styles.frameRoyal : user.profileFrame === 'ocean' ? styles.frameOcean : null]}>
                {avatarUri ? (
                  <Image source={{ uri: avatarUri }} style={styles.avatar} />
                ) : (
                  <View style={styles.avatarPlaceholder}>
                    <Text style={styles.avatarInitials}>{initials || '?'}</Text>
                  </View>
                )}
              </View>
              {user.avatarDecoration ? (
                <View style={styles.decoration}>
                  <Ionicons name={user.avatarDecoration === 'crown' ? 'ribbon' : user.avatarDecoration === 'laurel' ? 'leaf' : 'star'} size={13} color="#F8D477" />
                </View>
              ) : null}
              <Pressable
                style={styles.cameraButton}
                onPress={chooseAvatar}
                accessibilityRole="button"
                accessibilityLabel="Avatarni o‘zgartirish"
              >
                <Ionicons name="camera-outline" size={16} color={colors.text} />
              </Pressable>
            </View>
            <View style={styles.identityTextBlock}>
              <Text style={styles.displayName} numberOfLines={2}>{user.displayName}</Text>
              <View style={styles.usernameRow}>
                <Text style={styles.username}>@{user.username}</Text>
                <Pressable onPress={copyUsername} hitSlop={10} accessibilityRole="button" accessibilityLabel="Username nusxalash" style={styles.copyButton}>
                  <Ionicons name="copy-outline" size={15} color={colors.textMuted} />
                </Pressable>
              </View>
              <View style={styles.profileBadges}>
                <Ionicons name="trophy" size={19} color="#A78BFA" />
                <Ionicons name="star" size={19} color="#A78BFA" />
                <Ionicons name="shield-checkmark" size={19} color="#8D79F6" />
              </View>
            </View>
          </View>

          <View style={styles.heroDivider} />
          <View style={styles.followRow}>
            <View style={styles.followItem}>
              <Text style={styles.followNumber}>{socialProfile?.followersCount ?? 0}</Text>
              <Text style={styles.followLabel}>Kuzatuvchilar</Text>
            </View>
            <View style={styles.followDivider} />
            <View style={styles.followItem}>
              <Text style={styles.followNumber}>{socialProfile?.followingCount ?? 0}</Text>
              <Text style={styles.followLabel}>Kuzatilayotganlar</Text>
            </View>
          </View>

          <Pressable
            style={styles.editButton}
            onPress={() => setEditVisible(true)}
          >
            <Ionicons name="create-outline" size={17} color={colors.text} />
            <Text style={styles.editButtonText}>Profilni tahrirlash</Text>
            <Ionicons name="arrow-forward" size={16} color={colors.textMuted} />
          </Pressable>
        </GlassSurface>

        <Pressable onPress={onPremiumPress} style={{ marginTop: 14, marginBottom: 22 }}>
          <GlassSurface intensity={glassIntensity} style={{ padding: 17, borderRadius: 20, borderWidth: 1, borderColor: 'rgba(239,203,120,0.38)', backgroundColor: isDark ? 'rgba(111,82,174,0.24)' : 'rgba(255,248,229,0.82)' }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
              <View style={{ width: 42, height: 42, borderRadius: 14, backgroundColor: 'rgba(239,203,120,0.18)', alignItems: 'center', justifyContent: 'center' }}>
                <Ionicons name="diamond" size={22} color="#EFCB78" />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={{ color: colors.text, fontSize: 15, fontWeight: '900' }}>QUIZ ARENA Premium</Text>
                <Text style={{ color: colors.textMuted, fontSize: 12, marginTop: 3 }}>Maxsus imkoniyatlarni kashf eting</Text>
              </View>
              <Ionicons name="chevron-forward" size={20} color="#EFCB78" />
            </View>
          </GlassSurface>
        </Pressable>

        <View style={styles.profileTabs}>
          {([
            ['main', 'Main'],
            ['board', 'Board'],
            ['activity', 'Activity'],
            ['wishlist', 'Wishlist'],
          ] as const).map(([key, label]) => (
            <Pressable key={key} style={styles.profileTab} onPress={() => setActiveProfileTab(key)}>
              <Text style={[styles.profileTabText, activeProfileTab === key && styles.profileTabTextActive]}>{label}</Text>
              {activeProfileTab === key ? <View style={styles.profileTabUnderline} /> : null}
            </Pressable>
          ))}
        </View>

        {activeProfileTab === 'main' ? (
          <>
            <Pressable onPress={onPremiumPress} style={styles.profileShopCard}>
              <View style={styles.profileShopIcon}><Ionicons name="storefront-outline" size={22} color="#A78BFA" /></View>
              <View style={{ flex: 1 }}>
                <Text style={styles.profileShopTitle}>Shop</Text>
                <Text style={styles.profileShopSubtitle}>Premium tariflari va maxsus imkoniyatlar</Text>
              </View>
              <Ionicons name="chevron-forward" size={19} color="#A78BFA" />
            </Pressable>
            <GlassSurface intensity={glassIntensity} style={styles.profileBioCard}>
              <View style={styles.profileBioAccent} />
              <View style={{ flex: 1 }}>
                <Text style={styles.profileBioTitle}>Bio</Text>
                <Text style={styles.profileBioText}>{user.bio?.trim() || 'Tarjimai hol hali kiritilmagan'}</Text>
              </View>
            </GlassSurface>
          </>
        ) : null}

        {activeProfileTab === 'main' ? (
        <View style={styles.socialHeading}>
          <View>
            <Text style={styles.sectionEyebrow}>COMMUNITY</Text>
            <Text style={styles.sectionTitle}>Do‘stlar ortiring</Text>
          </View>
          <Pressable onPress={() => onUserPress?.('discover')} hitSlop={8}>
            <Text style={styles.moreLink}>Ko‘proq <Ionicons name="chevron-forward" size={12} /></Text>
          </Pressable>
        </View>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.suggestionsRow}>
          {suggestions.map((person) => {
            const personInitials = person.displayName.split(' ').filter(Boolean).map((part) => part[0]).join('').slice(0, 2).toUpperCase();
            return (
              <View key={person.id} style={styles.personCard}>
                <Pressable style={styles.personIdentity} onPress={() => onUserPress?.(person.username)}>
                  {person.avatarUrl ? <Image source={{ uri: person.avatarUrl }} style={styles.personAvatar} /> : <View style={styles.personAvatarFallback}><Text style={styles.personInitials}>{personInitials || '?'}</Text></View>}
                  <Text style={styles.personName} numberOfLines={1}>{person.displayName}</Text>
                  <Text style={styles.personFollowers} numberOfLines={1}>{person.followersCount} kuzatuvchi</Text>
                </Pressable>
                <Pressable
                  style={styles.personFollowButton}
                  disabled={followingUserId === person.id}
                  onPress={async () => {
                    setFollowingUserId(person.id);
                    try {
                      await followUser(person.id);
                      setSuggestions((current) => current.filter((item) => item.id !== person.id));
                      setSocialProfile((current) => current ? { ...current, followingCount: (current.followingCount ?? 0) + 1 } : current);
                    } catch (error) {
                      Alert.alert('Xatolik', error instanceof Error ? error.message : 'Kuzatib bo‘lmadi');
                    } finally {
                      setFollowingUserId(null);
                    }
                  }}
                >
                  <Ionicons name="person-add-outline" size={12} color={colors.primary} />
                  <Text style={styles.personAction}>{followingUserId === person.id ? '...' : 'Kuzatish'}</Text>
                </Pressable>
              </View>
            );
          })}
          {suggestions.length === 0 ? <Text style={styles.noSuggestions}>Hozircha yangi tavsiyalar yo‘q</Text> : null}
        </ScrollView>
          </>
        ) : null}

        {activeProfileTab === 'board' ? (
          <>
        <View style={styles.sectionHeading}>
          <View>
            <Text style={styles.sectionEyebrow}>YOUR PROGRESS</Text>
            <Text style={styles.sectionTitle}>Natijalar</Text>
          </View>
          <Ionicons name="analytics-outline" size={20} color={colors.textMuted} />
        </View>

        <View style={styles.statsRow}>
          <GlassSurface intensity={glassIntensity} style={styles.statCard}>
            <View style={styles.statIconWrap}>
              <Ionicons name="flash" size={18} color="#EFCB78" />
            </View>
            <Text style={styles.statNumber}>{user.xp ?? 0}</Text>
            <Text style={styles.statLabel}>Jami XP</Text>
          </GlassSurface>
          <GlassSurface intensity={glassIntensity} style={styles.statCard}>
            <View style={styles.statIconWrap}>
              <Ionicons name="trophy-outline" size={18} color="#BBA8FF" />
            </View>
            <Text style={styles.statNumber}>{user.level ?? 1}</Text>
            <Text style={styles.statLabel}>Daraja</Text>
          </GlassSurface>
          <GlassSurface intensity={glassIntensity} style={styles.statCard}>
            <View style={styles.statIconWrap}>
              <Ionicons name="medal-outline" size={18} color="#83DCCB" />
            </View>
            <Text style={styles.statNumber}>{rankPoints}</Text>
            <Text style={styles.statLabel}>Reyting RP</Text>
          </GlassSurface>
        </View>
          </>
        ) : null}

        {activeProfileTab === 'activity' ? (
          <>
        <View style={styles.sectionHeading}>
          <View>
            <Text style={styles.sectionEyebrow}>ACHIEVEMENTS</Text>
            <Text style={styles.sectionTitle}>Erishgan yutuqlari</Text>
          </View>
        </View>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.suggestionsRow}>
          {getProfileAchievements(user.xp ?? 0, user.level ?? 1, rankPoints).filter((item) => item.unlocked).map((achievement) => (
            <GlassSurface key={achievement.id} intensity={glassIntensity} style={styles.achievementCard}>
              <Ionicons name={achievement.icon} size={21} color="#EFCB78" />
              <Text style={styles.achievementTitle}>{achievement.title}</Text>
              <Text style={styles.achievementDescription}>{achievement.description}</Text>
            </GlassSurface>
          ))}
          {getProfileAchievements(user.xp ?? 0, user.level ?? 1, rankPoints).every((item) => !item.unlocked) ? <Text style={styles.noSuggestions}>Yutuqlar hali qo‘lga kiritilmagan</Text> : null}
        </ScrollView>
        ) : null}

        {activeProfileTab === 'board' ? (
          <>
        <View style={styles.sectionHeading}>
          <View>
            <Text style={styles.sectionEyebrow}>COMPETITIVE STATUS</Text>
            <Text style={styles.sectionTitle}>Liga darajasi</Text>
          </View>
        </View>

        <GlassSurface intensity={glassIntensity} style={styles.rankCard}>
          <View style={styles.rankTopRow}>
            <View style={styles.rankIconWrap}>
              <Ionicons name="medal" size={25} color={rankInfo.color} />
            </View>
            <View style={styles.rankTextContainer}>
              <Text style={styles.rankName}>{rankInfo.name} ligasi</Text>
              <Text style={styles.rankSubtext}>Battle reytingi</Text>
            </View>
            <Text style={[styles.rankPointsText, { color: rankInfo.color }]}>
              {rankPoints} RP
            </Text>
          </View>
          <View style={styles.rankProgressTrack}>
            <View
              style={[
                styles.rankProgressFill,
                {
                  width: rankProgress + '%',
                  backgroundColor: rankInfo.color,
                },
              ]}
            />
          </View>
          <View style={styles.rankFooter}>
            <Text style={styles.rankProgressText}>
              {nextRank
                ? (nextRank.min - rankPoints) + ' RP dan keyingi liga'
                : 'Eng yuqori liga'}
            </Text>
            <Text style={styles.rankProgressPercent}>
              {Math.round(rankProgress)}%
            </Text>
          </View>
        </GlassSurface>
          </>
        ) : null}

        {activeProfileTab === 'wishlist' ? (
          <>
        <View style={styles.sectionHeading}>
          <View>
            <Text style={styles.sectionEyebrow}>COLLECTION</Text>
            <Text style={styles.sectionTitle}>Mukofotlar va bezaklar</Text>
          </View>
        </View>

        <GlassSurface intensity={glassIntensity} style={styles.infoCard}>
          <View style={[styles.infoIconWrap, styles.goldIconWrap]}>
            <Ionicons name="medal-outline" size={21} color="#EFCB78" />
          </View>
          <View style={styles.infoTextContainer}>
            <Text style={styles.infoTitle}>Mening mukofotlarim</Text>
            <Text style={styles.infoSubtitle}>
              Yutuqlar va medallar shu yerda ko‘rinadi
            </Text>
          </View>
          <Ionicons name="chevron-forward" size={18} color={colors.textMuted} />
        </GlassSurface>

        <Pressable onPress={() => setCosmeticType('decoration')} accessibilityRole="button">
          <GlassSurface intensity={glassIntensity} style={styles.infoCard}>
            <View style={[styles.infoIconWrap, styles.purpleIconWrap]}>
              <Ionicons name="color-palette-outline" size={21} color="#BBA8FF" />
            </View>
            <View style={styles.infoTextContainer}>
              <Text style={styles.infoTitle}>Avatar bezaklari</Text>
              <Text style={styles.infoSubtitle}>
                {user.avatarDecoration || 'Hozircha bezak tanlanmagan'}
              </Text>
            </View>
            <Text style={styles.cosmeticAction}>Sozlash</Text>
          </GlassSurface>
        </Pressable>

        <Pressable onPress={() => setCosmeticType('frame')} accessibilityRole="button">
          <GlassSurface intensity={glassIntensity} style={styles.infoCard}>
            <View style={[styles.infoIconWrap, styles.blueIconWrap]}>
              <Ionicons name="albums-outline" size={21} color="#8BCDF7" />
            </View>
            <View style={styles.infoTextContainer}>
              <Text style={styles.infoTitle}>Profil ramkasi</Text>
              <Text style={styles.infoSubtitle}>
                {user.profileFrame || 'Standart ramka'}
              </Text>
            </View>
            <Text style={styles.cosmeticAction}>Sozlash</Text>
          </GlassSurface>
        </Pressable>
          </>
        ) : null}

        <Pressable
          style={styles.logoutButton}
          onPress={() =>
            Alert.alert('Hisobdan chiqish', 'Haqiqatan ham chiqmoqchimisiz?', [
              { text: 'Bekor qilish', style: 'cancel' },
              {
                text: 'Chiqish',
                style: 'destructive',
                onPress: () => {
                  void logout();
                },
              },
            ])
          }
        >
          <Ionicons name="log-out-outline" size={19} color={colors.danger} />
          <Text style={styles.logoutText}>Hisobdan chiqish</Text>
        </Pressable>
      </Animated.ScrollView>

      <Modal
        visible={editVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setEditVisible(false)}
      >
        <View style={styles.modalBackground}>
          <GlassSurface intensity={glassIntensity + 10} style={styles.modalCard}>
            <View style={styles.modalHeader}>
              <View>
                <Text style={styles.sectionEyebrow}>PERSONAL DETAILS</Text>
                <Text style={styles.modalTitle}>Profilni tahrirlash</Text>
              </View>
              <Pressable
                style={styles.modalClose}
                onPress={() => setEditVisible(false)}
              >
                <Ionicons name="close" size={21} color={colors.text} />
              </Pressable>
            </View>

            <Text style={styles.inputLabel}>Ismingiz</Text>
            <TextInput
              style={styles.input}
              value={displayName}
              onChangeText={setDisplayName}
              placeholder="Ismingiz"
              placeholderTextColor={colors.textMuted}
              maxLength={100}
            />

            <Text style={styles.inputLabel}>Username</Text>
            <TextInput
              style={styles.input}
              value={username}
              onChangeText={setUsername}
              placeholder="username"
              placeholderTextColor={colors.textMuted}
              autoCapitalize="none"
              maxLength={30}
            />

            <Text style={styles.inputLabel}>Tarjimai hol</Text>
            <TextInput
              style={[styles.input, styles.bioInput]}
              value={bio}
              onChangeText={setBio}
              placeholder="O‘zingiz haqingizda..."
              placeholderTextColor={colors.textMuted}
              multiline
              maxLength={500}
            />

            <Pressable
              style={[styles.saveButton, saving && styles.saveButtonDisabled]}
              onPress={() => void saveProfile()}
              disabled={saving}
            >
              {saving ? (
                <ActivityIndicator color={colors.textInverse} />
              ) : (
                <Text style={styles.saveButtonText}>O‘zgarishlarni saqlash</Text>
              )}
            </Pressable>
          </GlassSurface>
        </View>
      </Modal>

      <Modal
        visible={cosmeticType !== null}
        transparent
        animationType="fade"
        onRequestClose={() => setCosmeticType(null)}
      >
        <View style={styles.modalBackground}>
          <GlassSurface intensity={glassIntensity + 10} style={styles.modalCard}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>{cosmeticType === 'decoration' ? 'Avatar bezagini tanlang' : 'Profil ramkasini tanlang'}</Text>
              <Pressable onPress={() => setCosmeticType(null)} style={styles.modalClose}>
                <Ionicons name="close" size={19} color={colors.text} />
              </Pressable>
            </View>
            {(cosmeticType === 'decoration'
              ? [{ value: null, label: 'Standart bezak' }, { value: 'sparkle', label: 'Yulduzcha' }, { value: 'crown', label: 'Toj' }, { value: 'laurel', label: 'Laurel' }]
              : [{ value: null, label: 'Standart ramka' }, { value: 'aurora', label: 'Aurora' }, { value: 'royal', label: 'Royal' }, { value: 'ocean', label: 'Ocean' }]
            ).map((option) => {
              const selected = cosmeticType === 'decoration' ? user.avatarDecoration === option.value : user.profileFrame === option.value;
              return (
                <Pressable key={option.label} style={[styles.cosmeticOption, selected && styles.cosmeticOptionSelected]} disabled={cosmeticSaving} onPress={() => void saveCosmetic(option.value)}>
                  <Text style={styles.cosmeticOptionText}>{option.label}</Text>
                  {selected ? <Ionicons name="checkmark-circle" size={19} color={colors.primary} /> : <Ionicons name="ellipse-outline" size={18} color={colors.textMuted} />}
                </Pressable>
              );
            })}
            {cosmeticSaving ? <ActivityIndicator color={colors.primary} style={{ marginTop: 10 }} /> : null}
          </GlassSurface>
        </View>
      </Modal>
    </View>
  );
}

function makeStyles(
  colors: ReturnType<typeof useTheme>['tokens']['colors'],
  isDark: boolean,
) {
  const glassBorder = 'rgba(155, 126, 220, 0.18)';
  const glassFill = '#171127';

  return StyleSheet.create({
    screen: {
      flex: 1,
      backgroundColor: '#0F0A1F',
      overflow: 'hidden',
    },
    container: {
      flex: 1,
      backgroundColor: 'transparent',
    },
    content: {
      paddingHorizontal: 18,
      paddingTop: 8,
      paddingBottom: 132,
    },
    ambientGlowTop: {
      position: 'absolute',
      top: 55,
      right: -105,
      width: 250,
      height: 250,
      borderRadius: 125,
      backgroundColor: 'transparent',
    },
    ambientGlowBottom: {
      position: 'absolute',
      top: 510,
      left: -145,
      width: 250,
      height: 250,
      borderRadius: 125,
      backgroundColor: 'transparent',
    },
    loading: {
      flex: 1,
      backgroundColor: colors.background,
      justifyContent: 'center',
      alignItems: 'center',
    },
    header: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      marginBottom: 16,
    },
    profileHeaderLabel: { color: '#A79BCB', fontSize: 11, fontWeight: '800', letterSpacing: 2.2 },
    profileTabs: { flexDirection: 'row', justifyContent: 'space-between', borderBottomWidth: 1, borderBottomColor: 'rgba(155,126,220,0.18)', marginTop: 8, marginBottom: 18 },
    profileTab: { flex: 1, alignItems: 'center', justifyContent: 'center', minHeight: 48, gap: 10 },
    profileTabText: { color: '#80759F', fontSize: 13, fontWeight: '700' },
    profileTabTextActive: { color: '#F4F0FF' },
    profileTabUnderline: { height: 3, width: '72%', borderRadius: 3, backgroundColor: '#6B3FD4' },
    profileShopCard: { minHeight: 76, flexDirection: 'row', alignItems: 'center', gap: 13, paddingHorizontal: 15, borderRadius: 19, borderWidth: 1, borderColor: glassBorder, backgroundColor: glassFill, marginBottom: 12 },
    profileShopIcon: { width: 43, height: 43, borderRadius: 14, alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(107,63,212,0.16)' },
    profileShopTitle: { color: '#F4F0FF', fontSize: 15, fontWeight: '800' },
    profileShopSubtitle: { color: '#9489B2', fontSize: 11, marginTop: 4 },
    profileBioCard: { flexDirection: 'row', alignItems: 'stretch', gap: 12, padding: 16, borderRadius: 19, borderWidth: 1, borderColor: glassBorder, backgroundColor: glassFill, marginBottom: 4 },
    profileBioAccent: { width: 4, borderRadius: 4, backgroundColor: '#6B3FD4' },
    profileBioTitle: { color: '#F4F0FF', fontSize: 15, fontWeight: '800' },
    profileBioText: { color: '#9489B2', fontSize: 12, lineHeight: 18, marginTop: 5 },
    profileBadges: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 13, marginTop: 9 },
    eyebrow: {
      color: colors.textMuted,
      fontSize: 9,
      fontWeight: '800',
      letterSpacing: 2.1,
      marginBottom: 4,
    },
    headerTitle: {
      color: colors.text,
      fontSize: 29,
      fontWeight: '800',
      letterSpacing: -0.8,
    },
    headerButton: {
      width: 43,
      height: 43,
      borderRadius: 15,
      backgroundColor: glassFill,
      borderWidth: 1,
      borderColor: glassBorder,
      alignItems: 'center',
      justifyContent: 'center',
    },
    heroCard: {
      padding: 18,
      borderRadius: 20,
      borderWidth: 1,
      borderColor: glassBorder,
      backgroundColor: '#171127',
    },
    heroHighlight: {
      position: 'absolute',
      top: -65,
      right: -35,
      width: 175,
      height: 130,
      borderRadius: 90,
      backgroundColor: isDark
        ? 'rgba(180, 157, 255, 0.10)'
        : 'rgba(255, 255, 255, 0.52)',
      transform: [{ rotate: '-18deg' }],
    },
    heroTopLine: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
    },
    identityLabel: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 7,
    },
    onlineDot: {
      width: 6,
      height: 6,
      borderRadius: 3,
      backgroundColor: '#78D8B4',
    },
    identityLabelText: {
      color: colors.textMuted,
      fontSize: 9,
      fontWeight: '800',
      letterSpacing: 1.6,
    },
    rankPill: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 5,
      paddingHorizontal: 10,
      paddingVertical: 6,
      borderRadius: 20,
      backgroundColor: glassFill,
      borderWidth: 1,
      borderColor: glassBorder,
    },
    rankPillText: {
      fontSize: 9,
      fontWeight: '800',
      letterSpacing: 0.7,
    },
    identityBlock: {
      flexDirection: 'column',
      alignItems: 'center',
      gap: 12,
      paddingTop: 22,
      paddingBottom: 18,
    },
    identityTextBlock: {
      flex: 1,
      minWidth: 0,
      alignItems: 'center',
    },
    avatarStage: {
      width: 154,
      height: 154,
      alignItems: 'center',
      justifyContent: 'center',
      marginBottom: 0,
      flexShrink: 0,
    },
    avatarHalo: {
      position: 'absolute',
      width: 146,
      height: 146,
      borderRadius: 73,
      borderWidth: 1,
      borderColor: isDark
        ? 'rgba(198, 179, 255, 0.40)'
        : 'rgba(126, 102, 209, 0.28)',
      backgroundColor: isDark
        ? 'rgba(160, 133, 255, 0.09)'
        : 'rgba(255, 255, 255, 0.38)',
    },
    avatarBorder: {
      width: 132,
      height: 132,
      borderRadius: 66,
      padding: 3,
      backgroundColor: isDark
        ? 'rgba(208, 194, 255, 0.54)'
        : 'rgba(130, 106, 210, 0.40)',
      borderWidth: 1,
      borderColor: 'rgba(255,255,255,0.62)',
    },
    frameAurora: { backgroundColor: '#8B72E8' },
    frameRoyal: { backgroundColor: '#D7A93F' },
    frameOcean: { backgroundColor: '#4D9FC8' },
    avatar: {
      width: '100%',
      height: '100%',
      borderRadius: 44,
    },
    avatarPlaceholder: {
      flex: 1,
      borderRadius: 44,
      backgroundColor: isDark ? '#39334F' : '#E8E2FA',
      justifyContent: 'center',
      alignItems: 'center',
    },
    avatarInitials: {
      color: colors.text,
      fontSize: 31,
      fontWeight: '800',
    },
    cameraButton: {
      position: 'absolute',
      right: 3,
      bottom: 5,
      width: 32,
      height: 32,
      borderRadius: 16,
      backgroundColor: isDark
        ? 'rgba(54, 48, 78, 0.94)'
        : 'rgba(255, 255, 255, 0.94)',
      borderWidth: 1,
      borderColor: glassBorder,
      alignItems: 'center',
      justifyContent: 'center',
    },
    decoration: {
      position: 'absolute',
      top: 9,
      left: 5,
      width: 27,
      height: 27,
      borderRadius: 14,
      backgroundColor: isDark
        ? 'rgba(65, 56, 89, 0.94)'
        : 'rgba(255, 255, 255, 0.94)',
      borderWidth: 1,
      borderColor: glassBorder,
      justifyContent: 'center',
      alignItems: 'center',
    },
    displayName: {
      color: '#FFFFFF',
      fontSize: 30,
      fontWeight: '800',
      letterSpacing: -0.45,
      maxWidth: '100%',
      textAlign: 'left',
    },
    usernameRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 8,
      marginTop: 4,
    },
    copyButton: {
      width: 27,
      height: 27,
      borderRadius: 9,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: glassFill,
      borderWidth: 1,
      borderColor: glassBorder,
    },
    username: {
      color: '#A78BFA',
      fontSize: 13,
      fontWeight: '600',
      marginTop: 5,
    },
    bio: {
      color: '#A49BB8',
      fontSize: 13,
      textAlign: 'center',
      marginTop: 9,
      lineHeight: 19,
      maxWidth: 270,
    },
    heroDivider: {
      height: 1,
      backgroundColor: glassBorder,
      marginBottom: 15,
    },
    followRow: {
      width: '100%',
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      marginBottom: 16,
    },
    followItem: {
      flex: 1,
      alignItems: 'center',
      paddingHorizontal: 8,
    },
    followNumber: {
      color: colors.text,
      fontSize: 18,
      fontWeight: '800',
    },
    followLabel: {
      color: colors.textMuted,
      fontSize: 10,
      textAlign: 'center',
      marginTop: 4,
    },
    followDivider: {
      width: 1,
      height: 31,
      backgroundColor: glassBorder,
    },
    editButton: {
      minHeight: 50,
      width: '100%',
      borderRadius: 15,
      backgroundColor: '#6B3FD4',
      borderWidth: 1,
      borderColor: '#6B3FD4',
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 9,
    },
    editButtonText: {
      color: '#FFFFFF',
      fontWeight: '700',
      fontSize: 14,
    },
    socialHeading: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      marginTop: 24,
      marginBottom: 10,
    },
    moreLink: {
      color: colors.primary,
      fontSize: 11,
      fontWeight: '700',
    },
    suggestionsRow: {
      gap: 10,
      paddingBottom: 3,
    },
    personCard: {
      width: 124,
      minHeight: 151,
      alignItems: 'center',
      padding: 12,
      borderRadius: 18,
      borderWidth: 1,
      borderColor: glassBorder,
      backgroundColor: glassFill,
    },
    achievementCard: {
      width: 145,
      minHeight: 100,
      padding: 12,
      borderRadius: 17,
      borderWidth: 1,
      borderColor: glassBorder,
      backgroundColor: glassFill,
      justifyContent: 'center',
      marginRight: 9,
    },
    achievementTitle: {
      color: colors.text,
      fontSize: 11,
      fontWeight: '800',
      marginTop: 8,
    },
    achievementDescription: {
      color: colors.textMuted,
      fontSize: 9,
      marginTop: 3,
    },
    personIdentity: {
      alignItems: 'center',
      width: '100%',
    },
    personAvatar: {
      width: 48,
      height: 48,
      borderRadius: 24,
      marginBottom: 8,
    },
    personAvatarFallback: {
      width: 48,
      height: 48,
      borderRadius: 24,
      alignItems: 'center',
      justifyContent: 'center',
      marginBottom: 8,
      backgroundColor: colors.surfaceElevated,
    },
    personInitials: {
      color: colors.text,
      fontSize: 15,
      fontWeight: '800',
    },
    personName: {
      color: colors.text,
      fontSize: 11,
      fontWeight: '800',
      maxWidth: '100%',
    },
    personFollowers: {
      color: colors.textMuted,
      fontSize: 9,
      marginTop: 4,
    },
    personFollowButton: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 4,
      marginTop: 8,
      paddingHorizontal: 8,
      paddingVertical: 6,
      borderRadius: 10,
      backgroundColor: isDark ? 'rgba(183,163,255,0.12)' : 'rgba(123,99,204,0.10)',
    },
    personAction: {
      color: colors.primary,
      fontSize: 10,
      fontWeight: '700',
      marginTop: 8,
    },
    noSuggestions: {
      color: colors.textMuted,
      fontSize: 12,
      paddingVertical: 20,
    },
    sectionHeading: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      marginTop: 25,
      marginBottom: 12,
    },
    sectionEyebrow: {
      color: colors.textMuted,
      fontSize: 8,
      fontWeight: '800',
      letterSpacing: 1.7,
      marginBottom: 4,
    },
    sectionTitle: {
      color: colors.text,
      fontSize: 18,
      fontWeight: '800',
      letterSpacing: -0.35,
    },
    statsRow: {
      flexDirection: 'row',
      gap: 9,
    },
    statCard: {
      flex: 1,
      minHeight: 119,
      alignItems: 'flex-start',
      justifyContent: 'center',
      paddingHorizontal: 12,
      paddingVertical: 13,
      borderRadius: 18,
      borderWidth: 1,
      borderColor: glassBorder,
      backgroundColor: glassFill,
    },
    statIconWrap: {
      width: 31,
      height: 31,
      borderRadius: 11,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: isDark
        ? 'rgba(255,255,255,0.07)'
        : 'rgba(255,255,255,0.62)',
      borderWidth: 1,
      borderColor: glassBorder,
      marginBottom: 9,
    },
    statNumber: {
      color: colors.text,
      fontSize: 21,
      fontWeight: '800',
      letterSpacing: -0.5,
    },
    statLabel: {
      color: colors.textMuted,
      fontSize: 10,
      marginTop: 3,
    },
    rankCard: {
      padding: 17,
      borderRadius: 22,
      borderWidth: 1,
      borderColor: glassBorder,
      backgroundColor: glassFill,
    },
    rankTopRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 11,
    },
    rankIconWrap: {
      width: 43,
      height: 43,
      borderRadius: 15,
      backgroundColor: isDark
        ? 'rgba(255,255,255,0.07)'
        : 'rgba(255,255,255,0.65)',
      borderWidth: 1,
      borderColor: glassBorder,
      alignItems: 'center',
      justifyContent: 'center',
    },
    rankTextContainer: {
      flex: 1,
    },
    rankName: {
      color: colors.text,
      fontSize: 15,
      fontWeight: '800',
    },
    rankPointsText: {
      fontSize: 14,
      fontWeight: '800',
    },
    rankSubtext: {
      color: colors.textMuted,
      fontSize: 11,
      marginTop: 3,
    },
    rankProgressTrack: {
      height: 7,
      borderRadius: 8,
      backgroundColor: isDark
        ? 'rgba(255,255,255,0.10)'
        : 'rgba(82,67,125,0.10)',
      overflow: 'hidden',
      marginTop: 17,
    },
    rankProgressFill: {
      height: 7,
      borderRadius: 8,
    },
    rankFooter: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      marginTop: 8,
    },
    rankProgressText: {
      color: colors.textSecondary,
      fontSize: 11,
    },
    rankProgressPercent: {
      color: colors.textMuted,
      fontSize: 11,
      fontWeight: '700',
    },
    infoCard: {
      minHeight: 70,
      flexDirection: 'row',
      alignItems: 'center',
      borderRadius: 19,
      paddingHorizontal: 13,
      paddingVertical: 11,
      marginBottom: 9,
      borderWidth: 1,
      borderColor: glassBorder,
      backgroundColor: glassFill,
      gap: 12,
    },
    infoIconWrap: {
      width: 39,
      height: 39,
      borderRadius: 14,
      alignItems: 'center',
      justifyContent: 'center',
      borderWidth: 1,
      borderColor: glassBorder,
    },
    goldIconWrap: {
      backgroundColor: 'rgba(239, 203, 120, 0.10)',
    },
    purpleIconWrap: {
      backgroundColor: 'rgba(187, 168, 255, 0.11)',
    },
    blueIconWrap: {
      backgroundColor: 'rgba(139, 205, 247, 0.11)',
    },
    cosmeticAction: {
      color: colors.primary,
      fontSize: 11,
      fontWeight: '800',
    },
    cosmeticOption: {
      minHeight: 48,
      borderRadius: 13,
      borderWidth: 1,
      borderColor: glassBorder,
      backgroundColor: glassFill,
      paddingHorizontal: 13,
      marginTop: 8,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
    },
    cosmeticOptionSelected: {
      borderColor: colors.primary,
      backgroundColor: isDark ? 'rgba(183,163,255,0.13)' : 'rgba(123,99,204,0.09)',
    },
    cosmeticOptionText: {
      color: colors.text,
      fontSize: 13,
      fontWeight: '700',
    },
    infoTextContainer: {
      flex: 1,
    },
    infoTitle: {
      color: colors.text,
      fontSize: 13,
      fontWeight: '700',
    },
    infoSubtitle: {
      color: colors.textMuted,
      fontSize: 10,
      marginTop: 4,
    },
    logoutButton: {
      minHeight: 48,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 9,
      backgroundColor: colors.dangerSurface,
      paddingHorizontal: 16,
      borderRadius: 16,
      marginTop: 20,
      borderWidth: 1,
      borderColor: glassBorder,
    },
    logoutText: {
      color: colors.danger,
      fontSize: 13,
      fontWeight: '700',
    },
    modalBackground: {
      flex: 1,
      backgroundColor: colors.overlay,
      justifyContent: 'center',
      padding: 18,
    },
    modalCard: {
      padding: 21,
      borderRadius: 27,
      borderWidth: 1,
      borderColor: glassBorder,
      backgroundColor: '#171127',
    },
    modalHeader: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      marginBottom: 12,
    },
    modalTitle: {
      color: colors.text,
      fontSize: 19,
      fontWeight: '800',
      letterSpacing: -0.35,
    },
    modalClose: {
      width: 35,
      height: 35,
      borderRadius: 13,
      backgroundColor: glassFill,
      borderWidth: 1,
      borderColor: glassBorder,
      alignItems: 'center',
      justifyContent: 'center',
    },
    inputLabel: {
      color: colors.textSecondary,
      fontSize: 12,
      fontWeight: '700',
      marginBottom: 7,
      marginTop: 12,
    },
    input: {
      minHeight: 47,
      backgroundColor: glassFill,
      color: colors.text,
      borderRadius: 14,
      paddingHorizontal: 13,
      paddingVertical: 11,
      fontSize: 14,
      borderWidth: 1,
      borderColor: glassBorder,
    },
    bioInput: {
      height: 88,
      textAlignVertical: 'top',
    },
    saveButton: {
      minHeight: 49,
      backgroundColor: colors.primary,
      borderRadius: 15,
      justifyContent: 'center',
      alignItems: 'center',
      marginTop: 21,
    },
    saveButtonDisabled: {
      opacity: 0.65,
    },
    saveButtonText: {
      color: colors.textInverse,
      fontSize: 14,
      fontWeight: '800',
    },
  });
}
