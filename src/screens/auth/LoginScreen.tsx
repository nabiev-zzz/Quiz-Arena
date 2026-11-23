
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

interface Props {
  onLogin: (username: string, password: string) => Promise<void>;
  onRegisterPress: () => void;
}

export default function LoginScreen({
  onLogin,
  onRegisterPress,
}: Props) {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);

  const handleLogin = async () => {
    if (!username.trim() || !password) {
      Alert.alert('Diqqat', 'Username va parolni kiriting.');
      return;
    }

    try {
      setLoading(true);
      await onLogin(username.trim(), password);
    } catch (error) {
      Alert.alert(
        'Kirish amalga oshmadi',
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

        <Text style={styles.title}>Xush kelibsiz!</Text>

        <Text style={styles.subtitle}>
          Bilimlar maydoniga qayting.
        </Text>

        <Text style={styles.label}>Username</Text>

        <TextInput
          style={styles.input}
          placeholder="Username kiriting"
          placeholderTextColor="#8B90A7"
          selectionColor="#A88FFF"
          cursorColor="#A88FFF"
          value={username}
          onChangeText={setUsername}
          autoCapitalize="none"
          autoCorrect={false}
          autoComplete="username"
          returnKeyType="next"
        />

        <Text style={styles.label}>Parol</Text>

        <TextInput
          style={styles.input}
          placeholder="Parolingizni kiriting"
          placeholderTextColor="#8B90A7"
          selectionColor="#A88FFF"
          cursorColor="#A88FFF"
          value={password}
          onChangeText={setPassword}
          secureTextEntry
          autoCapitalize="none"
          autoComplete="current-password"
          returnKeyType="done"
          onSubmitEditing={() => void handleLogin()}
        />

        <Pressable
          style={[styles.button, loading && styles.disabled]}
          onPress={() => void handleLogin()}
          disabled={loading}
        >
          {loading ? (
            <ActivityIndicator color="#FFFFFF" />
          ) : (
            <Text style={styles.buttonText}>Kirish</Text>
          )}
        </Pressable>

        <View style={styles.footer}>
          <Text style={styles.footerText}>Hisobingiz yo‘qmi? </Text>

          <Pressable onPress={onRegisterPress}>
            <Text style={styles.link}>Ro‘yxatdan o‘tish</Text>
          </Pressable>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0B1020',
  },
  content: {
    flexGrow: 1,
    justifyContent: 'center',
    paddingHorizontal: 25,
    paddingVertical: 35,
  },
  logo: {
    color: '#A88FFF',
    fontSize: 13,
    fontWeight: 'bold',
    letterSpacing: 4,
    marginBottom: 35,
  },
  title: {
    color: '#FFFFFF',
    fontSize: 30,
    fontWeight: 'bold',
  },
  subtitle: {
    color: '#8993AA',
    fontSize: 14,
    marginTop: 9,
    marginBottom: 35,
  },
  label: {
    color: '#DDE2F0',
    fontSize: 13,
    marginBottom: 9,
    marginTop: 15,
  },
  input: {
    height: 54,
    borderRadius: 14,
    backgroundColor: '#171F34',
    borderWidth: 1,
    borderColor: '#29334B',
    paddingHorizontal: 16,
    color: '#FFFFFF',
    fontSize: 15,
  },
  button: {
    height: 54,
    backgroundColor: '#7657E8',
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 28,
  },
  disabled: {
    opacity: 0.6,
  },
  buttonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: 'bold',
  },
  footer: {
    flexDirection: 'row',
    justifyContent: 'center',
    marginTop: 27,
  },
  footerText: {
    color: '#8993AA',
    fontSize: 13,
  },
  link: {
    color: '#A88FFF',
    fontSize: 13,
    fontWeight: 'bold',
  },
});
