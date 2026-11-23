
import { useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useTheme } from '../../theme/ThemeContext';

interface Props {
  onRegister: (input: {
    displayName: string;
    username: string;
    email?: string;
    password: string;
  }) => Promise<void>;
  onLoginPress: () => void;
}

export default function RegisterScreen({
  onRegister,
  onLoginPress,
}: Props) {
  const { tokens } = useTheme();
  const colors = tokens.colors;
  const styles = makeStyles(colors);

  const [displayName, setDisplayName] = useState('');
  const [username, setUsername] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);

  const handleRegister = async () => {
    const cleanName = displayName.trim();
    const cleanUsername = username.trim().toLowerCase();
    const cleanEmail = email.trim();

    if (!cleanName || !cleanUsername || !password) {
      Alert.alert('Diqqat', 'Majburiy maydonlarni to‘ldiring.');
      return;
    }

    if (cleanName.length < 2) {
      Alert.alert('Ism xatosi', 'Ism kamida 2 ta belgidan iborat bo‘lsin.');
      return;
    }

    if (!/^[a-zA-Z0-9_]{3,30}$/.test(cleanUsername)) {
      Alert.alert(
        'Username xatosi',
        'Username 3–30 ta belgi bo‘lsin. Faqat lotin harflari, raqamlar va _ ishlating.',
      );
      return;
    }

    if (cleanEmail && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(cleanEmail)) {
      Alert.alert('Email xatosi', 'Email manzilini to‘g‘ri kiriting.');
      return;
    }

    if (password.length < 8) {
      Alert.alert(
        'Parol xatosi',
        'Parol kamida 8 ta belgidan iborat bo‘lsin.',
      );
      return;
    }

    if (password !== confirmPassword) {
      Alert.alert('Parol xatosi', 'Kiritilgan parollar bir xil emas.');
      return;
    }

    try {
      setLoading(true);

      await onRegister({
        displayName: cleanName,
        username: cleanUsername,
        ...(cleanEmail ? { email: cleanEmail } : {}),
        password,
      });
    } catch (error) {
      Alert.alert(
        'Ro‘yxatdan o‘tish amalga oshmadi',
        error instanceof Error ? error.message : 'Xatolik yuz berdi',
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <ScrollView
        contentContainerStyle={styles.content}
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="on-drag"
        showsVerticalScrollIndicator={false}
      >
        <Text style={styles.logo}>QUIZ ARENA</Text>

        <Text style={styles.title}>Hisob yaratish</Text>

        <Text style={styles.subtitle}>
          Bilimlar olamiga qo‘shiling.
        </Text>

        <Text style={styles.label}>Ism va familiya *</Text>

        <TextInput
          style={styles.input}
          placeholder="Masalan: Ali Valiyev"
          placeholderTextColor={colors.textMuted}
          selectionColor={colors.primary}
          cursorColor={colors.primary}
          value={displayName}
          onChangeText={setDisplayName}
          maxLength={100}
          autoCapitalize="words"
          returnKeyType="next"
        />

        <Text style={styles.label}>Username *</Text>

        <TextInput
          style={styles.input}
          placeholder="Masalan: ali_2026"
          placeholderTextColor={colors.textMuted}
          selectionColor={colors.primary}
          cursorColor={colors.primary}
          value={username}
          onChangeText={setUsername}
          autoCapitalize="none"
          autoCorrect={false}
          autoComplete="username"
          maxLength={30}
          returnKeyType="next"
        />

        <Text style={styles.label}>Email (ixtiyoriy)</Text>

        <TextInput
          style={styles.input}
          placeholder="example@mail.com"
          placeholderTextColor={colors.textMuted}
          selectionColor={colors.primary}
          cursorColor={colors.primary}
          value={email}
          onChangeText={setEmail}
          keyboardType="email-address"
          autoCapitalize="none"
          autoCorrect={false}
          autoComplete="email"
          returnKeyType="next"
        />

        <Text style={styles.label}>Parol *</Text>

        <TextInput
          style={styles.input}
          placeholder="Kamida 8 ta belgi"
          placeholderTextColor={colors.textMuted}
          selectionColor={colors.primary}
          cursorColor={colors.primary}
          value={password}
          onChangeText={setPassword}
          secureTextEntry
          autoCapitalize="none"
          autoComplete="new-password"
          returnKeyType="next"
        />

        <Text style={styles.label}>Parolni tasdiqlang *</Text>

        <TextInput
          style={styles.input}
          placeholder="Parolni qayta kiriting"
          placeholderTextColor={colors.textMuted}
          selectionColor={colors.primary}
          cursorColor={colors.primary}
          value={confirmPassword}
          onChangeText={setConfirmPassword}
          secureTextEntry
          autoCapitalize="none"
          returnKeyType="done"
          onSubmitEditing={() => void handleRegister()}
        />

        <Pressable
          style={[styles.button, loading && styles.disabled]}
          onPress={() => void handleRegister()}
          disabled={loading}
        >
          {loading ? (
            <ActivityIndicator color="#FFFFFF" />
          ) : (
            <Text style={styles.buttonText}>Hisob yaratish</Text>
          )}
        </Pressable>

        <View style={styles.footer}>
          <Text style={styles.footerText}>Hisobingiz bormi? </Text>

          <Pressable onPress={onLoginPress}>
            <Text style={styles.link}>Kirish</Text>
          </Pressable>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

function makeStyles(colors: ReturnType<typeof useTheme>['tokens']['colors']) {
  return StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  content: {
    flexGrow: 1,
    justifyContent: 'center',
    paddingHorizontal: 25,
    paddingVertical: 35,
  },
  logo: {
    color: colors.primary,
    fontSize: 13,
    fontWeight: 'bold',
    letterSpacing: 4,
    marginBottom: 25,
  },
  title: {
    color: colors.text,
    fontSize: 29,
    fontWeight: 'bold',
  },
  subtitle: {
    color: colors.textMuted,
    fontSize: 14,
    marginTop: 9,
    marginBottom: 20,
  },
  label: {
    color: colors.textSecondary,
    fontSize: 13,
    marginBottom: 8,
    marginTop: 13,
  },
  input: {
    height: 52,
    borderRadius: 13,
    backgroundColor: colors.inputBackground,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: 15,
    color: colors.text,
    fontSize: 14,
  },
  button: {
    height: 54,
    backgroundColor: '#7657E8',
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 25,
  },
  disabled: {
    opacity: 0.6,
  },
  buttonText: {
    color: colors.text,
    fontSize: 15,
    fontWeight: 'bold',
  },
  footer: {
    flexDirection: 'row',
    justifyContent: 'center',
    marginTop: 24,
  },
  footerText: {
    color: colors.textMuted,
    fontSize: 13,
  },
  link: {
    color: colors.primary,
    fontSize: 13,
    fontWeight: 'bold',
  },
  });
}
