
import React, { useEffect, useState } from 'react';
import Animated, { useAnimatedScrollHandler, useSharedValue, withSpring, type SharedValue } from 'react-native-reanimated';
import {
  ActivityIndicator,
  Alert,
  Image,
  Modal,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';

import { useAuth } from '../context/AuthContext';
import { useTheme } from '../theme/ThemeContext';

interface ProfileScreenProps {
  onSettingsPress?: () => void;
  dockStretch?: SharedValue<number>;
}

export default function ProfileScreen({
  onSettingsPress,
  dockStretch,
}: ProfileScreenProps) {
  const { tokens } = useTheme();
  const colors = tokens.colors;
  const styles = makeStyles(colors);
  const lastDockScrollY = useSharedValue(0);
  const dockScrollHandler = useAnimatedScrollHandler({
    onScroll: (event) => {
      if (!dockStretch) return;
      const nextY = event.contentOffset.y;
      const delta = nextY - lastDockScrollY.value;
      lastDockScrollY.value = nextY;
      dockStretch.value = withSpring(Math.max(-1, Math.min(1, delta / 30)), { damping: 11, stiffness: 160, mass: 0.7 });
    },
    onEndDrag: () => { if (dockStretch) dockStretch.value = withSpring(0, { damping: 11, stiffness: 160, mass: 0.7 }); },
    onMomentumEnd: () => { if (dockStretch) dockStretch.value = withSpring(0, { damping: 11, stiffness: 160, mass: 0.7 }); },
  });

  const { user, updateProfile, logout } = useAuth();

  const [editVisible, setEditVisible] = useState(false);
  const [displayName, setDisplayName] = useState('');
  const [username, setUsername] = useState('');
  const [bio, setBio] = useState('');
  const [avatarUri, setAvatarUri] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (user) {
      setDisplayName(user.displayName);
      setUsername(user.username);
      setBio(user.bio ?? '');
      setAvatarUri(user.avatarUrl);
    }
  }, [user]);

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
          (nextRank.min - rankInfo.min)) * 100,
      )
    : 100;
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

  return (
    <Animated.ScrollView
      onScroll={dockScrollHandler}
      scrollEventThrottle={16}
      style={styles.container}
      contentContainerStyle={styles.content}
      showsVerticalScrollIndicator={false}
    >
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Mening profilim</Text>

        <Pressable
          style={styles.settingsButton}
          onPress={onSettingsPress}
        >
          <Ionicons name="settings-outline" size={23} color={colors.text} />
        </Pressable>
      </View>

      <View style={styles.profileCard}>
        <View style={styles.avatarContainer}>
          <View style={styles.avatarBorder}>
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
              <Ionicons name="star" size={16} color="#FBBF24" />
            </View>
          ) : null}

          <Pressable style={styles.cameraButton} onPress={chooseAvatar}>
            <Ionicons name="camera" size={17} color="#FFFFFF" />
          </Pressable>
        </View>

        <Text style={styles.displayName}>{user.displayName}</Text>
        <Text style={styles.username}>@{user.username}</Text>

        <Text style={styles.bio}>
          {user.bio || 'Tarjimai hol hali kiritilmagan'}
        </Text>

        <View style={styles.followRow}>
          <View style={styles.followItem}>
            <Text style={styles.followNumber}>—</Text>
            <Text style={styles.followLabel}>Kuzatuvchilar</Text>
          </View>

          <View style={styles.followDivider} />

          <View style={styles.followItem}>
            <Text style={styles.followNumber}>—</Text>
            <Text style={styles.followLabel}>Kuzatilayotganlar</Text>
          </View>
        </View>

        <Pressable
          style={styles.editButton}
          onPress={() => setEditVisible(true)}
        >
          <Ionicons name="create-outline" size={19} color="#FFFFFF" />
          <Text style={styles.editButtonText}>Profilni tahrirlash</Text>
        </Pressable>
      </View>

      <Text style={styles.sectionTitle}>Mening natijalarim</Text>

      <View style={styles.statsRow}>
        <View style={styles.statCard}>
          <Ionicons name="flash" size={25} color="#FBBF24" />
          <Text style={styles.statNumber}>{user.xp ?? 0}</Text>
          <Text style={styles.statLabel}>XP ball</Text>
        </View>

        <View style={styles.statCard}>
          <Ionicons name="trophy" size={25} color="#A78BFA" />
          <Text style={styles.statNumber}>{user.level ?? 1}</Text>
          <Text style={styles.statLabel}>Daraja</Text>
        </View>
      </View>

      <View style={styles.rankCard}>
        <View style={styles.rankTopRow}>
          <View style={styles.rankIconWrap}>
            <Ionicons name="medal" size={30} color={rankInfo.color} />
          </View>
          <View style={{ flex: 1 }}>
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
                width: `${rankProgress}%`,
                backgroundColor: rankInfo.color,
              },
            ]}
          />
        </View>

        <Text style={styles.rankProgressText}>
          {nextRank
            ? `${nextRank.min - rankPoints} RP dan keyingi liga`
            : 'Eng yuqori liga'}
        </Text>
      </View>
      <Text style={styles.sectionTitle}>Mukofotlar</Text>

      <View style={styles.infoCard}>
        <Ionicons name="medal-outline" size={27} color="#FBBF24" />
        <View style={styles.infoTextContainer}>
          <Text style={styles.infoTitle}>Mening mukofotlarim</Text>
          <Text style={styles.infoSubtitle}>
            Yutuqlar va medallar shu yerda ko‘rinadi
          </Text>
        </View>
        <Ionicons name="chevron-forward" size={20} color={colors.textMuted} />
      </View>

      <Text style={styles.sectionTitle}>Profil bezaklari</Text>

      <View style={styles.infoCard}>
        <Ionicons name="color-palette-outline" size={27} color="#A78BFA" />
        <View style={styles.infoTextContainer}>
          <Text style={styles.infoTitle}>Avatar bezaklari</Text>
          <Text style={styles.infoSubtitle}>
            {user.avatarDecoration || 'Hozircha bezak tanlanmagan'}
          </Text>
        </View>
      </View>

      <View style={styles.infoCard}>
        <Ionicons name="albums-outline" size={27} color="#38BDF8" />
        <View style={styles.infoTextContainer}>
          <Text style={styles.infoTitle}>Profil ramkasi</Text>
          <Text style={styles.infoSubtitle}>
            {user.profileFrame || 'Standart ramka'}
          </Text>
        </View>
      </View>

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
        <Ionicons name="log-out-outline" size={20} color="#F87171" />
        <Text style={styles.logoutText}>Hisobdan chiqish</Text>
      </Pressable>

      <Modal
        visible={editVisible}
        transparent
        animationType="slide"
        onRequestClose={() => setEditVisible(false)}
      >
        <View style={styles.modalBackground}>
          <View style={styles.modalCard}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Profilni tahrirlash</Text>

              <Pressable onPress={() => setEditVisible(false)}>
                <Ionicons name="close" size={25} color={colors.text} />
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
              style={styles.saveButton}
              onPress={() => void saveProfile()}
              disabled={saving}
            >
              {saving ? (
                <ActivityIndicator color="#FFFFFF" />
              ) : (
                <Text style={styles.saveButtonText}>Saqlash</Text>
              )}
            </Pressable>
          </View>
        </View>
      </Modal>
    </Animated.ScrollView>
  );
}

function makeStyles(colors: ReturnType<typeof useTheme>['tokens']['colors']) {
  return StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  content: {
    paddingHorizontal: 18,
    paddingTop: 12,
    paddingBottom: 48,
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
    marginBottom: 18,
  },
  headerTitle: {
    color: colors.text,
    fontSize: 22,
    fontWeight: '800',
    letterSpacing: -0.3,
  },
  settingsButton: {
    width: 46,
    height: 46,
    borderRadius: 15,
    backgroundColor: colors.surfaceElevated,
    justifyContent: 'center',
    alignItems: 'center',
  },
  profileCard: {
    backgroundColor: colors.surface,
    borderRadius: 24,
    padding: 20,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: colors.border,
  },
  avatarContainer: {
    position: 'relative',
    marginBottom: 15,
  },
  avatarBorder: {
    width: 104,
    height: 104,
    borderRadius: 52,
    padding: 4,
    backgroundColor: '#8B5CF6',
  },
  avatar: {
    width: '100%',
    height: '100%',
    borderRadius: 52,
  },
  avatarPlaceholder: {
    flex: 1,
    borderRadius: 52,
    backgroundColor: colors.surfaceElevated,
    justifyContent: 'center',
    alignItems: 'center',
  },
  avatarInitials: {
    color: colors.text,
    fontSize: 35,
    fontWeight: '800',
  },
  cameraButton: {
    position: 'absolute',
    right: 0,
    bottom: 2,
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: '#8B5CF6',
    borderWidth: 3,
    borderColor: colors.surface,
    justifyContent: 'center',
    alignItems: 'center',
  },
  decoration: {
    position: 'absolute',
    top: 0,
    left: 0,
    width: 29,
    height: 29,
    borderRadius: 15,
    backgroundColor: colors.surfaceElevated,
    justifyContent: 'center',
    alignItems: 'center',
  },
  displayName: {
    color: colors.text,
    fontSize: 22,
    fontWeight: '800',
    textAlign: 'center',
  },
  username: {
    color: colors.primary,
    fontSize: 14,
    marginTop: 5,
  },
  bio: {
    color: colors.textSecondary,
    fontSize: 14,
    textAlign: 'center',
    marginTop: 13,
    lineHeight: 21,
  },
  followRow: {
    width: '100%',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 20,
    marginBottom: 18,
  },
  followItem: {
    flex: 1,
    alignItems: 'center',
    paddingHorizontal: 8,
  },
  followNumber: {
    color: colors.text,
    fontSize: 20,
    fontWeight: '800',
  },
  followLabel: {
    color: colors.textMuted,
    fontSize: 11,
    textAlign: 'center',
    marginTop: 4,
  },
  followDivider: {
    width: 1,
    height: 35,
    backgroundColor: colors.borderStrong,
  },
  editButton: {
    width: '100%',
    minHeight: 50,
    borderRadius: 15,
    backgroundColor: '#7548DB',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 9,
  },
  editButtonText: {
    color: '#FFFFFF',
    fontWeight: '700',
    fontSize: 15,
  },
  sectionTitle: {
    color: colors.text,
    fontSize: 17,
    fontWeight: '800',
    marginTop: 23,
    marginBottom: 12,
  },
  statsRow: {
    flexDirection: 'row',
    gap: 10,
  },
  statCard: {
    flex: 1,
    backgroundColor: colors.surface,
    borderRadius: 18,
    padding: 16,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: colors.border,
  },
  statNumber: {
    color: colors.text,
    fontSize: 24,
    fontWeight: '800',
    marginTop: 8,
  },
  statLabel: {
    color: colors.textMuted,
    fontSize: 13,
    marginTop: 4,
  },
  rankCard: {
    backgroundColor: colors.surface,
    borderRadius: 20,
    padding: 17,
    marginTop: 14,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: colors.borderStrong,
  },
  rankTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  rankIconWrap: {
    width: 48,
    height: 48,
    borderRadius: 15,
    backgroundColor: colors.surfaceElevated,
    alignItems: 'center',
    justifyContent: 'center',
  },
  rankName: {
    color: colors.text,
    fontSize: 17,
    fontWeight: '800',
  },
  rankPointsText: {
    fontSize: 17,
    fontWeight: '800',
  },
  rankSubtext: {
    color: colors.textMuted,
    fontSize: 12,
    marginTop: 4,
  },
  rankProgressTrack: {
    height: 9,
    borderRadius: 10,
    backgroundColor: colors.backgroundSecondary,
    overflow: 'hidden',
    marginTop: 18,
  },
  rankProgressFill: {
    height: 9,
    borderRadius: 10,
  },
  rankProgressText: {
    color: colors.textSecondary,
    fontSize: 12,
    marginTop: 9,
  },
  infoCard: {
    minHeight: 74,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderRadius: 18,
    padding: 15,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: colors.border,
    gap: 13,
  },
  infoTextContainer: {
    flex: 1,
  },
  infoTitle: {
    color: colors.text,
    fontSize: 15,
    fontWeight: '700',
  },
  infoSubtitle: {
    color: colors.textMuted,
    fontSize: 12,
    marginTop: 5,
  },
  logoutButton: {
    minHeight: 50,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 9,
    backgroundColor: colors.dangerSurface,
    paddingHorizontal: 16,
    borderRadius: 15,
    marginTop: 22,
  },
  logoutText: {
    color: colors.danger,
    fontSize: 15,
    fontWeight: '700',
  },
  modalBackground: {
    flex: 1,
    backgroundColor: colors.overlay,
    justifyContent: 'center',
    padding: 20,
  },
  modalCard: {
    backgroundColor: colors.surface,
    borderRadius: 23,
    padding: 22,
    borderWidth: 1,
    borderColor: colors.borderStrong,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 22,
  },
  modalTitle: {
    color: colors.text,
    fontSize: 20,
    fontWeight: '800',
  },
  inputLabel: {
    color: colors.textSecondary,
    fontSize: 13,
    fontWeight: '700',
    marginBottom: 8,
    marginTop: 12,
  },
  input: {
    minHeight: 48,
    backgroundColor: colors.background,
    color: colors.text,
    borderRadius: 13,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 15,
    borderWidth: 1,
    borderColor: colors.borderStrong,
  },
  bioInput: {
    height: 95,
    textAlignVertical: 'top',
  },
  saveButton: {
    height: 49,
    backgroundColor: '#7548DB',
    borderRadius: 13,
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 23,
  },
  saveButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '800',
  },
  });
}
