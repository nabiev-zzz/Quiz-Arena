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

interface ProfileScreenProps {
  onClosePress?: () => void;
  onSettingsPress?: () => void;
  onPremiumPress?: () => void;
  onUserPress?: (username: string) => void;
  dockStretch?: SharedValue<number>;
}

type ProfileTab = 'main' | 'board' | 'activity' | 'wishlist';

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
  const [saving, setSaving] = useState(false);
  const [suggestions, setSuggestions] = useState<UserSuggestion[]>([]);
  const [socialProfile, setSocialProfile] = useState<PublicUser | null>(null);
  const [followingUserId, setFollowingUserId] = useState<string | null>(null);
  const [cosmeticType, setCosmeticType] = useState<'decoration' | 'frame' | null>(null);
  const [cosmeticSaving, setCosmeticSaving] = useState(false);

  useEffect(() => {
    if (!user) return;
    setDisplayName(user.displayName);
    setUsername(user.username);
    setBio(user.bio ?? '');
    setAvatarUri(user.avatarUrl);
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

  const chooseAvatar = async () => {
    try {
      const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (!permission.granted) {
        showLocalizedAlert('Ruxsat kerak', 'Avatar tanlash uchun galereyaga ruxsat bering.');
        return;
      }
      const result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], allowsEditing: true, aspect: [1, 1], quality: 0.8 });
      if (!result.canceled && result.assets.length > 0) {
        const uri = result.assets[0].uri;
        setAvatarUri(uri);
      }
    } catch {
      showLocalizedAlert('Xatolik', 'Rasm tanlashda xatolik yuz berdi.');
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
      await updateProfile({ displayName: displayName.trim(), username: username.trim(), bio: bio.trim() || null });
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

  const copyUsername = async () => {
    try {
      await Clipboard.setStringAsync('@' + user.username);
      showLocalizedAlert('Nusxalandi', 'Username buferga nusxalandi.');
    } catch { showLocalizedAlert('Xatolik', 'Username nusxalanmadi.'); }
  };

  const tabs: { key: ProfileTab; label: string }[] = [
    { key: 'main', label: 'Main' },
    { key: 'board', label: 'Board' },
    { key: 'activity', label: 'Activity' },
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
            <Ionicons name="trophy" size={17} color="#A78BFA" />
            <Ionicons name="star" size={17} color="#A78BFA" />
            <Ionicons name="shield-checkmark" size={17} color="#A78BFA" />
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
    cosmeticOption: { minHeight: 48, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 13, borderRadius: 13, borderWidth: 1, borderColor: C.border, backgroundColor: C.background, marginTop: 8 },
    cosmeticSelected: { borderColor: C.purple, backgroundColor: C.purpleSoft },
  });
}
