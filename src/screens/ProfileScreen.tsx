
import React, { useEffect, useState } from 'react';
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

import { useAuth } from '../context/AuthContext';

interface ProfileScreenProps {
  onSettingsPress?: () => void;
}

export default function ProfileScreen({
  onSettingsPress,
}: ProfileScreenProps) {
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
        <ActivityIndicator size="large" color="#8B5CF6" />
      </View>
    );
  }

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
    <ScrollView
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
          <Ionicons name="settings-outline" size={23} color="#FFFFFF" />
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

      <Text style={styles.sectionTitle}>Mukofotlar</Text>

      <View style={styles.infoCard}>
        <Ionicons name="medal-outline" size={27} color="#FBBF24" />
        <View style={styles.infoTextContainer}>
          <Text style={styles.infoTitle}>Mening mukofotlarim</Text>
          <Text style={styles.infoSubtitle}>
            Yutuqlar va medallar shu yerda ko‘rinadi
          </Text>
        </View>
        <Ionicons name="chevron-forward" size={20} color="#8B91A5" />
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
                <Ionicons name="close" size={25} color="#FFFFFF" />
              </Pressable>
            </View>

            <Text style={styles.inputLabel}>Ismingiz</Text>
            <TextInput
              style={styles.input}
              value={displayName}
              onChangeText={setDisplayName}
              placeholder="Ismingiz"
              placeholderTextColor="#777F94"
              maxLength={100}
            />

            <Text style={styles.inputLabel}>Username</Text>
            <TextInput
              style={styles.input}
              value={username}
              onChangeText={setUsername}
              placeholder="username"
              placeholderTextColor="#777F94"
              autoCapitalize="none"
              maxLength={30}
            />

            <Text style={styles.inputLabel}>Tarjimai hol</Text>
            <TextInput
              style={[styles.input, styles.bioInput]}
              value={bio}
              onChangeText={setBio}
              placeholder="O‘zingiz haqingizda..."
              placeholderTextColor="#777F94"
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
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0B1020',
  },
  content: {
    padding: 20,
    paddingBottom: 40,
  },
  loading: {
    flex: 1,
    backgroundColor: '#0B1020',
    justifyContent: 'center',
    alignItems: 'center',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 22,
  },
  headerTitle: {
    color: '#FFFFFF',
    fontSize: 23,
    fontWeight: '800',
  },
  settingsButton: {
    width: 44,
    height: 44,
    borderRadius: 14,
    backgroundColor: '#1B2440',
    justifyContent: 'center',
    alignItems: 'center',
  },
  profileCard: {
    backgroundColor: '#151D33',
    borderRadius: 25,
    padding: 22,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#293553',
  },
  avatarContainer: {
    position: 'relative',
    marginBottom: 15,
  },
  avatarBorder: {
    width: 112,
    height: 112,
    borderRadius: 56,
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
    backgroundColor: '#293553',
    justifyContent: 'center',
    alignItems: 'center',
  },
  avatarInitials: {
    color: '#FFFFFF',
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
    borderColor: '#151D33',
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
    backgroundColor: '#293553',
    justifyContent: 'center',
    alignItems: 'center',
  },
  displayName: {
    color: '#FFFFFF',
    fontSize: 23,
    fontWeight: '800',
  },
  username: {
    color: '#A78BFA',
    fontSize: 14,
    marginTop: 5,
  },
  bio: {
    color: '#AAB2C5',
    fontSize: 14,
    textAlign: 'center',
    marginTop: 13,
    lineHeight: 21,
  },
  followRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 23,
    marginBottom: 20,
  },
  followItem: {
    alignItems: 'center',
    paddingHorizontal: 18,
  },
  followNumber: {
    color: '#FFFFFF',
    fontSize: 20,
    fontWeight: '800',
  },
  followLabel: {
    color: '#929BB0',
    fontSize: 12,
    marginTop: 4,
  },
  followDivider: {
    width: 1,
    height: 35,
    backgroundColor: '#35405B',
  },
  editButton: {
    width: '100%',
    height: 48,
    borderRadius: 14,
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
    color: '#FFFFFF',
    fontSize: 18,
    fontWeight: '800',
    marginTop: 27,
    marginBottom: 13,
  },
  statsRow: {
    flexDirection: 'row',
    gap: 12,
  },
  statCard: {
    flex: 1,
    backgroundColor: '#151D33',
    borderRadius: 18,
    padding: 18,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#293553',
  },
  statNumber: {
    color: '#FFFFFF',
    fontSize: 25,
    fontWeight: '800',
    marginTop: 9,
  },
  statLabel: {
    color: '#929BB0',
    fontSize: 13,
    marginTop: 4,
  },
  infoCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#151D33',
    borderRadius: 17,
    padding: 17,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: '#293553',
    gap: 13,
  },
  infoTextContainer: {
    flex: 1,
  },
  infoTitle: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '700',
  },
  infoSubtitle: {
    color: '#929BB0',
    fontSize: 12,
    marginTop: 5,
  },
  logoutButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 9,
    backgroundColor: '#281B2A',
    padding: 16,
    borderRadius: 15,
    marginTop: 25,
  },
  logoutText: {
    color: '#F87171',
    fontSize: 15,
    fontWeight: '700',
  },
  modalBackground: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.75)',
    justifyContent: 'center',
    padding: 20,
  },
  modalCard: {
    backgroundColor: '#151D33',
    borderRadius: 23,
    padding: 22,
    borderWidth: 1,
    borderColor: '#35405B',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 22,
  },
  modalTitle: {
    color: '#FFFFFF',
    fontSize: 20,
    fontWeight: '800',
  },
  inputLabel: {
    color: '#D8DDF0',
    fontSize: 13,
    fontWeight: '700',
    marginBottom: 8,
    marginTop: 12,
  },
  input: {
    backgroundColor: '#0B1020',
    color: '#FFFFFF',
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 13,
    fontSize: 15,
    borderWidth: 1,
    borderColor: '#35405B',
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
