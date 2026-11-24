
import { useRef, useState, type ComponentRef } from 'react';
import Animated, {
  useAnimatedScrollHandler,
  useSharedValue,
  withSpring,
} from 'react-native-reanimated';
import * as SplashScreen from 'expo-splash-screen';
import { BlurTargetView } from 'expo-blur';
import { StatusBar } from 'expo-status-bar';
import {
  ActivityIndicator,
  StyleSheet,
  Text,
  View,
  Pressable,
  TextInput,
} from 'react-native';
import {
  SafeAreaProvider,
  SafeAreaView,
  useSafeAreaInsets,
} from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { subjects as learningSubjects } from './src/data/subjects';

import LearnScreen from './src/screens/LearnScreen';
import QuizScreen from './src/screens/QuizScreen';
import AiTutorScreen from './src/screens/AiTutorScreen';
import ProfileScreen from './src/screens/ProfileScreen';
import PublicProfileScreen from './src/screens/PublicProfileScreen';
import DiscoverUsersScreen from './src/screens/DiscoverUsersScreen';
import BattleScreen from './src/screens/BattleScreen';
import SettingsScreen from './src/screens/SettingsScreen';
import PremiumScreen from './src/screens/PremiumScreen';
import LoginScreen from './src/screens/auth/LoginScreen';
import RegisterScreen from './src/screens/auth/RegisterScreen';

import { AuthProvider, useAuth } from './src/context/AuthContext';
import {
  AppSettingsProvider,
  useAppSettings,
} from './src/context/AppSettingsContext';

import { ThemeProvider, useTheme } from './src/theme/ThemeContext';
import { GlassSurface } from './src/components/ui';
import LiquidDock, { type LiquidDockItem } from './src/components/LiquidDock';
// @ts-ignore Keep the animated splash as the requested plain JavaScript component.
import AnimatedSplash from './src/components/AnimatedSplash';

void SplashScreen.preventAutoHideAsync().catch(() => undefined);

import type { Subject, Topic } from './src/types';

type Tab = 'home' | 'learn' | 'battle' | 'ranking' | 'profile' | 'tutor';

const navigation: LiquidDockItem[] = [
  { id: 'home', icon: 'home-outline', activeIcon: 'home', label: 'Bosh' },
  { id: 'learn', icon: 'book-outline', activeIcon: 'book', label: 'Darslar' },
  { id: 'battle', icon: 'flash-outline', activeIcon: 'flash', label: 'Battle' },
  { id: 'ranking', icon: 'trophy-outline', activeIcon: 'trophy', label: 'Reyting' },
  { id: 'profile', icon: 'person-outline', activeIcon: 'person', label: 'Profil' },
];

function AppContent() {
  const {
    user,
    loading,
    login,
    register,
    requestEmailVerification,
    verifyEmail,
    requestEmailPasswordReset,
    resetEmailPassword,
    startGoogleLogin,
    startTelegramLogin,
  } = useAuth();
  const { theme, ready } = useAppSettings();
  const insets = useSafeAreaInsets();
  const { tokens } = useTheme();
  const blurTargetRef = useRef<ComponentRef<typeof View>>(null);

  const dockStretch = useSharedValue(0);
  const lastDockScrollY = useSharedValue(0);
  const dockScrollHandler = useAnimatedScrollHandler({
    onScroll: (event) => {
      const nextY = event.contentOffset.y;
      const delta = nextY - lastDockScrollY.value;
      lastDockScrollY.value = nextY;
      dockStretch.value = withSpring(
        Math.max(-1, Math.min(1, delta / 30)),
        { damping: 11, stiffness: 160, mass: 0.7 },
      );
    },
    onEndDrag: () => {
      dockStretch.value = withSpring(0, { damping: 11, stiffness: 160, mass: 0.7 });
    },
    onMomentumEnd: () => {
      dockStretch.value = withSpring(0, { damping: 11, stiffness: 160, mass: 0.7 });
    },
  });

  const isDark = theme === 'dark';

  const [tab, setTab] = useState<Tab>('home');
  const [authScreen, setAuthScreen] = useState<'login' | 'register'>('login');
  const [selectedSubject, setSelectedSubject] = useState<Subject | null>(null);
  const [selectedTopic, setSelectedTopic] = useState<Topic | null>(null);
  const [showSettings, setShowSettings] = useState(false);
  const [showPremium, setShowPremium] = useState(false);
  const [selectedPublicUsername, setSelectedPublicUsername] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');

  const backgroundColor = tokens.colors.background;
  const cardColor = tokens.colors.surfaceGlass;
  const textColor = tokens.colors.text;
  const mutedColor = tokens.colors.textMuted;
  const navColor = tokens.colors.surfaceGlass;
  const borderColor = tokens.colors.glassBorder;

  const openTab = (nextTab: Tab) => {
    setTab(nextTab);
    setShowSettings(false);
    setShowPremium(false);
    setSelectedPublicUsername(null);
    setSelectedTopic(null);
    setSelectedSubject(null);
  };

  const renderHome = () => {
    const normalizedQuery = searchQuery.trim().normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLocaleLowerCase();
    const featureCatalog = [
      { key: 'learn', title: 'Fanlar va mavzular', detail: 'Fanlar, darslar va testlar', aliases: 'dars test mavzu fan learning quiz' },
      { key: 'battle', title: 'Battle', detail: 'Do‘stlar bilan bilim bellashuvi', aliases: 'jang bellashuv musobaqa duel multiplayer' },
      { key: 'ranking', title: 'Reyting', detail: 'Liderlar jadvali va natijalar', aliases: 'top leaderboard xp ball ochko' },
      { key: 'tutor', title: 'AI Ustoz', detail: 'Savollarga AI orqali javob oling', aliases: 'suniy intellekt yordamchi ai tutor' },
      { key: 'profile', title: 'Profil', detail: 'Shaxsiy hisob va yutuqlar', aliases: 'account avatar bio hisob' },
      { key: 'friends', title: 'Do‘stlar', detail: 'Bilimdonlarni toping va kuzating', aliases: 'hamjamiyat odam user friends follow' },
      { key: 'premium', title: 'Premium', detail: 'Qo‘shimcha imkoniyatlar', aliases: 'premium pro legenda obuna tolov' },
      { key: 'settings', title: 'Sozlamalar', detail: 'Ilova sozlamalari', aliases: 'settings til tema qorongu yorug' },
    ];
    const featureMatches = normalizedQuery ? featureCatalog.filter((item) => `${item.title} ${item.detail} ${item.aliases}`.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLocaleLowerCase().includes(normalizedQuery)).slice(0, 8) : [];
    const subjectMatches = normalizedQuery ? learningSubjects.filter((subject) => `${subject.name} ${subject.description}`.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLocaleLowerCase().includes(normalizedQuery)).slice(0, 8) : [];
    const topicMatches = normalizedQuery ? learningSubjects.flatMap((subject) => subject.topics.filter((topic) => `${subject.name} ${topic.name} ${topic.description}`.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLocaleLowerCase().includes(normalizedQuery)).map((topic) => ({ subject, topic }))).slice(0, 20) : [];
    const openSearchFeature = (key: string) => {
      if (key === 'friends') { openTab('profile'); setSelectedPublicUsername('__discover__'); return; }
      if (key === 'premium') { openTab('profile'); setShowPremium(true); return; }
      if (key === 'settings') { openTab('profile'); setShowSettings(true); return; }
      if (key === 'tutor') { setTab('tutor'); setShowSettings(false); setShowPremium(false); setSelectedPublicUsername(null); setSelectedSubject(null); setSelectedTopic(null); return; }
      openTab(key as Tab);
    };
    const channels = [
      { key: 'learn', icon: 'book-outline' as const, name: 'fanlar-va-mavzular', detail: 'Fanlarni tanlang, bilimni oshiring' },
      { key: 'battle', icon: 'flash-outline' as const, name: 'battle-maydoni', detail: 'Raqiblar bilan bellashing' },
      { key: 'tutor', icon: 'sparkles-outline' as const, name: 'ai-ustoz', detail: 'Savol bering, javob oling' },
      { key: 'ranking', icon: 'trophy-outline' as const, name: 'reyting', detail: 'Eng kuchli bilimdonlar' },
      { key: 'friends', icon: 'people-outline' as const, name: 'hamjamiyat', detail: 'Do‘stlar va yangi bilimdonlar' },
    ];
    return (
      <>
        <View style={styles.discordHeader}>
          <View style={styles.discordBrandIcon}><Text style={styles.discordBrandLetter}>Q</Text></View>
          <View style={styles.discordBrandCopy}>
            <Text style={styles.discordEyebrow}>QUIZ ARENA</Text>
            <Text style={styles.discordBrandTitle}>O‘quv hamjamiyati</Text>
          </View>
          <Pressable style={styles.discordHeaderAction} onPress={() => { openTab('profile'); setShowSettings(true); }} accessibilityRole="button" accessibilityLabel="Sozlamalar">
            <Ionicons name="settings-outline" size={20} color={textColor} />
          </Pressable>
          <Pressable style={styles.discordAvatar} onPress={() => openTab('profile')} accessibilityRole="button" accessibilityLabel="Profil">
            <Text style={styles.discordAvatarText}>{user?.displayName?.charAt(0)?.toUpperCase() || 'U'}</Text>
            <View style={styles.discordOnlineDot} />
          </Pressable>
        </View>

        <View style={styles.discordWelcome}>
          <Text style={styles.discordWelcomeTitle}>Xush kelibsiz, {user?.displayName || 'Bilimdon'}!</Text>
          <Text style={styles.discordWelcomeSubtitle}>Bugun nimani o‘rganamiz?</Text>
        </View>

        <View style={[styles.discordSearch, { borderColor, backgroundColor: cardColor }]}>
          <Ionicons name="search-outline" size={19} color={mutedColor} />
          <TextInput value={searchQuery} onChangeText={setSearchQuery} placeholder="Kanal, fan yoki mavzuni qidiring" placeholderTextColor={mutedColor} style={[styles.discordSearchInput, { color: textColor }]} returnKeyType="search" autoCorrect={false} accessibilityLabel="Ilova bo‘ylab qidirish" />
          {searchQuery.length > 0 && <Pressable onPress={() => setSearchQuery('')} hitSlop={10}><Ionicons name="close-circle" size={18} color={mutedColor} /></Pressable>}
        </View>

        {normalizedQuery.length > 0 ? (
          <View style={styles.searchResults}>
            {featureMatches.length > 0 && <Text style={[styles.searchSectionTitle, { color: textColor }]}>BO‘LIMLAR</Text>}
            {featureMatches.map((item) => (
              <Pressable key={item.key} style={[styles.searchResultRow, { backgroundColor: cardColor, borderColor }]} onPress={() => openSearchFeature(item.key)}>
                <View style={styles.searchResultIcon}><Ionicons name="grid-outline" size={18} color={tokens.colors.primary} /></View>
                <View style={styles.searchResultCopy}><Text style={[styles.searchResultTitle, { color: textColor }]}>{item.title}</Text><Text style={[styles.searchResultDetail, { color: mutedColor }]}>{item.detail}</Text></View>
                <Ionicons name="chevron-forward" size={18} color={mutedColor} />
              </Pressable>
            ))}
            {subjectMatches.length > 0 && <Text style={[styles.searchSectionTitle, { color: textColor }]}>FANLAR</Text>}
            {subjectMatches.map((subject) => (
              <Pressable key={subject.id} style={[styles.searchResultRow, { backgroundColor: cardColor, borderColor }]} onPress={() => { openTab('learn'); setSelectedSubject(subject); }}>
                <View style={styles.searchResultIcon}><Text style={styles.searchResultGlyph}>{subject.icon}</Text></View>
                <View style={styles.searchResultCopy}><Text style={[styles.searchResultTitle, { color: textColor }]}>{subject.name}</Text><Text style={[styles.searchResultDetail, { color: mutedColor }]}>{subject.description}</Text></View>
                <Ionicons name="chevron-forward" size={18} color={mutedColor} />
              </Pressable>
            ))}
            {topicMatches.length > 0 && <Text style={[styles.searchSectionTitle, { color: textColor }]}>MAVZULAR</Text>}
            {topicMatches.map(({ subject, topic }) => (
              <Pressable key={subject.id + ':' + topic.id} style={[styles.searchResultRow, { backgroundColor: cardColor, borderColor }]} onPress={() => { setSelectedSubject(subject); setSelectedTopic(topic); setTab('learn'); }}>
                <View style={styles.searchResultIcon}><Ionicons name="book-outline" size={18} color={tokens.colors.primary} /></View>
                <View style={styles.searchResultCopy}><Text style={[styles.searchResultTitle, { color: textColor }]}>{topic.name}</Text><Text style={[styles.searchResultDetail, { color: mutedColor }]}>{subject.name} · {topic.description}</Text></View>
                <Ionicons name="chevron-forward" size={18} color={mutedColor} />
              </Pressable>
            ))}
            {featureMatches.length + subjectMatches.length + topicMatches.length === 0 && <Text style={[styles.searchEmpty, { color: mutedColor }]}>“{searchQuery}” bo‘yicha natija topilmadi.</Text>}
          </View>
        ) : (
          <>
            <View style={styles.discordSectionHeader}>
              <Text style={styles.discordSectionTitle}>ASOSIY KANALLAR</Text>
              <Ionicons name="chevron-down" size={15} color={mutedColor} />
            </View>
            <View style={styles.discordChannelPanel}>
              {channels.map((channel, index) => (
                <Pressable key={channel.key} style={({ pressed }) => [styles.discordChannelRow, pressed && styles.discordPressed]} onPress={() => openSearchFeature(channel.key)}>
                  <View style={styles.discordChannelIcon}><Ionicons name={channel.icon} size={19} color={tokens.colors.primary} /></View>
                  <View style={styles.discordChannelCopy}>
                    <Text style={styles.discordChannelName}># {channel.name}</Text>
                    <Text style={styles.discordChannelDetail}>{channel.detail}</Text>
                  </View>
                  <Ionicons name="chevron-forward" size={17} color={mutedColor} />
                  {index < channels.length - 1 && <View style={styles.discordChannelDivider} />}
                </Pressable>
              ))}
            </View>

            <View style={styles.discordSectionHeader}>
              <Text style={styles.discordSectionTitle}>BUGUNGI FAOLLIK</Text>
              <Text style={styles.discordSectionMeta}>SENING NATIJANG</Text>
            </View>
            <View style={styles.discordStatsPanel}>
              <View style={styles.discordStat}>
                <View style={[styles.discordStatIcon, { backgroundColor: 'rgba(250, 191, 82, 0.13)' }]}><Ionicons name="star" size={17} color="#F5C451" /></View>
                <View><Text style={styles.discordStatValue}>{user?.xp ?? 0} XP</Text><Text style={styles.discordStatLabel}>Tajriba ballari</Text></View>
              </View>
              <View style={styles.discordStatDivider} />
              <View style={styles.discordStat}>
                <View style={[styles.discordStatIcon, { backgroundColor: 'rgba(88, 101, 242, 0.16)' }]}><Ionicons name="trophy" size={17} color="#8EA1FF" /></View>
                <View><Text style={styles.discordStatValue}>Bronze</Text><Text style={styles.discordStatLabel}>Joriy daraja</Text></View>
              </View>
            </View>

            <Pressable style={({ pressed }) => [styles.discordChallenge, pressed && styles.discordPressed]} onPress={() => openTab('battle')}>
              <View style={styles.discordChallengeTop}>
                <View style={styles.discordChallengeBadge}><Ionicons name="flash" size={13} color="#FFFFFF" /><Text style={styles.discordChallengeBadgeText}>TAVSIYA</Text></View>
                <Ionicons name="arrow-up-right" size={19} color="#B5B9C4" />
              </View>
              <Text style={styles.discordChallengeTitle}>Battle maydoniga qo‘shil</Text>
              <Text style={styles.discordChallengeText}>Do‘stlaring bilan bellash, XP yig‘ va reytingda yuqoriga ko‘taril.</Text>
              <View style={styles.discordChallengeAction}><Text style={styles.discordChallengeActionText}>Battle’ni ochish</Text><Ionicons name="arrow-forward" size={15} color="#FFFFFF" /></View>
            </Pressable>

            <Pressable style={styles.discordTutorRow} onPress={() => openTab('tutor')}>
              <View style={styles.discordTutorIcon}><Ionicons name="sparkles" size={19} color="#B5A6FF" /></View>
              <View style={styles.discordChannelCopy}><Text style={styles.discordTutorTitle}>AI Ustoz bilan suhbat</Text><Text style={styles.discordChannelDetail}>Murakkab mavzularni sodda tushuntirish</Text></View>
              <Ionicons name="chevron-forward" size={17} color={mutedColor} />
            </Pressable>
          </>
        )}
      </>
    );
  };

    const renderOtherTab = () => {
    if (tab === 'learn') {
      return (
        <LearnScreen
          dockStretch={dockStretch}
          initialSubject={selectedSubject}
          onTopicSelect={(subject, topic) => {
            setSelectedSubject(subject);
            setSelectedTopic(topic);
          }}
        />
      );
    }

    if (tab === 'profile') {
      if (selectedPublicUsername === '__discover__') {
        return (
          <DiscoverUsersScreen
            onBack={() => setSelectedPublicUsername(null)}
            onUserPress={(username) => setSelectedPublicUsername(username)}
          />
        );
      }

      if (selectedPublicUsername) {
        return (
          <PublicProfileScreen
            username={selectedPublicUsername}
            onBack={() => setSelectedPublicUsername(null)}
          />
        );
      }

      if (showPremium) {
        return <PremiumScreen onBack={() => setShowPremium(false)} />;
      }

      if (showSettings) {
        return (
          <SettingsScreen
            onBack={() => setShowSettings(false)}
            dockStretch={dockStretch}
          />
        );
      }

      return (
        <ProfileScreen
          onSettingsPress={() => setShowSettings(true)}
          onPremiumPress={() => setShowPremium(true)}
          onUserPress={(username) => setSelectedPublicUsername(username === 'discover' ? '__discover__' : username)}
          dockStretch={dockStretch}
        />
      );
    }

    const pages = {
      battle: {
        title: 'Battle maydoni',
        description: "Do'stlaring yoki AI raqiblar bilan bilim bellashuvi.",
        icon: 'flash-outline' as const,
      },
      ranking: {
        title: 'Reyting',
        description: "Eng kuchli bilimdonlar safidan joy egalla.",
        icon: 'trophy-outline' as const,
      },
    };

    if (tab !== 'battle' && tab !== 'ranking') {
      return null;
    }

    const page = pages[tab];

    return (
      <View style={styles.emptyPage}>
        <Ionicons name={page.icon} size={65} color={tokens.colors.primary} />
        <Text style={[styles.pageTitle, { color: textColor }]}>
          {page.title}
        </Text>
        <Text style={[styles.pageDescription, { color: mutedColor }]}>
          {page.description}
        </Text>
        <Text style={styles.comingSoon}>
          Bu bo'lim keyingi bosqichda ishlab chiqiladi.
        </Text>
      </View>
    );
  };

  if (!ready || loading) {
    return (
      <SafeAreaView
        style={[styles.loadingScreen, { backgroundColor }]}
        edges={['top', 'bottom']}
      >
        <StatusBar style={isDark ? 'light' : 'dark'} />
        <ActivityIndicator size="large" color="#A88FFF" />
        <Text style={[styles.loadingText, { color: mutedColor }]}>
          QUIZ ARENA yuklanmoqda...
        </Text>
      </SafeAreaView>
    );
  }

  if (!user) {
    return (
      <SafeAreaView
        style={[styles.safe, { backgroundColor }]}
        edges={['top', 'bottom']}
      >
        <StatusBar style={isDark ? 'light' : 'dark'} />

        {authScreen === 'login' ? (
          <LoginScreen
            onLogin={login}
            onRegisterPress={() => setAuthScreen('register')}
            onGoogleLogin={startGoogleLogin}
            onTelegramLogin={startTelegramLogin}
            onPasswordResetRequest={requestEmailPasswordReset}
            onPasswordReset={resetEmailPassword}
          />
        ) : (
          <RegisterScreen
            onRegister={register}
            onLoginPress={() => setAuthScreen('login')}
          />
        )}
      </SafeAreaView>
    );
  }

  const bottomInset = Math.max(insets.bottom, 8);

  return (
    <SafeAreaView
      style={[styles.safe, { backgroundColor }]}
      edges={['top', 'left', 'right']}
    >
      <StatusBar style={isDark ? 'light' : 'dark'} />

      <BlurTargetView ref={blurTargetRef} style={styles.blurTarget}>
      <View pointerEvents="none" style={styles.ambientBackground}>
        <View
          style={[
            styles.ambientOrb,
            styles.ambientOrbOne,
            {
              backgroundColor: 'transparent',
            },
          ]}
        />
        <View
          style={[
            styles.ambientOrb,
            styles.ambientOrbTwo,
            {
              backgroundColor: 'transparent',
            },
          ]}
        />
      </View>

      {selectedTopic && selectedSubject ? (
        <QuizScreen
          subject={selectedSubject}
          topic={selectedTopic}
          onBack={() => setSelectedTopic(null)}
          dockStretch={dockStretch}
        />
      ) : tab === 'tutor' ? (
        <AiTutorScreen
          onBack={() => openTab('home')}
          bottomDockSpace={96}
          dockStretch={dockStretch}
        />
      ) : tab === 'battle' || tab === 'ranking' ? (
        <BattleScreen
          isDark={isDark}
          initialSection={tab === 'ranking' ? 'leaderboard' : 'battle'}
          dockStretch={dockStretch}
        />
      ) : (
      <Animated.ScrollView
        onScroll={dockScrollHandler}
        scrollEventThrottle={16}
        style={[styles.scroll, { backgroundColor }]}
        contentContainerStyle={[
          styles.content,
          { paddingBottom: 116 + bottomInset },
        ]}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        {tab === 'home' ? (
          renderHome()
        ) : (
          renderOtherTab()
        )}
      </Animated.ScrollView>
      )}
      </BlurTargetView>
      <LiquidDock
        blurTarget={blurTargetRef}
        items={navigation}
        activeKey={tab === 'tutor' ? 'home' : tab}
        onSelect={(key) => openTab(key as Tab)}
        bottomInset={bottomInset}
        scrollStretch={dockStretch}
      />
    </SafeAreaView>
  );
}

export default function App() {
  const [done, setDone] = useState(false);
  const nativeSplashHidden = useRef(false);

  const handleRootLayout = () => {
    if (nativeSplashHidden.current) {
      return;
    }

    nativeSplashHidden.current = true;
    void SplashScreen.hideAsync().catch(() => undefined);
  };

  return (
    <View style={{ flex: 1 }} onLayout={handleRootLayout}>
      <SafeAreaProvider>
        <AppSettingsProvider>
          <ThemeProvider>
            <AuthProvider>
              <AppContent />
            </AuthProvider>
          </ThemeProvider>
        </AppSettingsProvider>
      </SafeAreaProvider>

      {!done && <AnimatedSplash onFinish={() => setDone(true)} />}
    </View>
  );
}

const styles = StyleSheet.create({

  discordHeader: { flexDirection: 'row', alignItems: 'center', gap: 11, marginBottom: 20 },
  discordBrandIcon: { width: 43, height: 43, borderRadius: 14, backgroundColor: '#5865F2', alignItems: 'center', justifyContent: 'center' },
  discordBrandLetter: { color: '#FFFFFF', fontSize: 24, fontWeight: '900' },
  discordBrandCopy: { flex: 1, minWidth: 0 },
  discordEyebrow: { color: '#AAB0BC', fontSize: 9, fontWeight: '900', letterSpacing: 1.8 },
  discordBrandTitle: { color: '#F2F3F5', fontSize: 17, fontWeight: '800', marginTop: 3 },
  discordHeaderAction: { width: 38, height: 38, borderRadius: 12, backgroundColor: '#2B2D31', alignItems: 'center', justifyContent: 'center' },
  discordAvatar: { width: 39, height: 39, borderRadius: 14, backgroundColor: '#5865F2', alignItems: 'center', justifyContent: 'center' },
  discordAvatarText: { color: '#FFFFFF', fontSize: 17, fontWeight: '800' },
  discordOnlineDot: { position: 'absolute', right: -2, bottom: -2, width: 12, height: 12, borderRadius: 6, backgroundColor: '#23A559', borderWidth: 2, borderColor: '#313338' },
  discordWelcome: { marginBottom: 17 },
  discordWelcomeTitle: { color: '#F2F3F5', fontSize: 21, fontWeight: '800', letterSpacing: -0.4 },
  discordWelcomeSubtitle: { color: '#B5BAC1', fontSize: 13, marginTop: 5 },
  discordSearch: { minHeight: 46, borderRadius: 12, borderWidth: 1, paddingHorizontal: 13, flexDirection: 'row', alignItems: 'center', gap: 9, marginBottom: 23 },
  discordSearchInput: { flex: 1, minWidth: 0, paddingVertical: 11, fontSize: 13 },
  discordSectionHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10, marginTop: 2 },
  discordSectionTitle: { color: '#AAB0BC', fontSize: 10, fontWeight: '900', letterSpacing: 1.2 },
  discordSectionMeta: { color: '#727987', fontSize: 9, fontWeight: '800', letterSpacing: 0.7 },
  discordChannelPanel: { backgroundColor: '#2B2D31', borderRadius: 14, paddingHorizontal: 12, paddingVertical: 3, marginBottom: 23, borderWidth: 1, borderColor: 'rgba(255,255,255,0.045)' },
  discordChannelRow: { minHeight: 68, flexDirection: 'row', alignItems: 'center', gap: 11, position: 'relative' },
  discordPressed: { opacity: 0.76 },
  discordChannelIcon: { width: 37, height: 37, borderRadius: 11, backgroundColor: 'rgba(88,101,242,0.15)', alignItems: 'center', justifyContent: 'center' },
  discordChannelCopy: { flex: 1, minWidth: 0 },
  discordChannelName: { color: '#F2F3F5', fontSize: 13, fontWeight: '800' },
  discordChannelDetail: { color: '#949BA4', fontSize: 11, marginTop: 4 },
  discordChannelDivider: { position: 'absolute', bottom: 0, left: 48, right: 0, height: StyleSheet.hairlineWidth, backgroundColor: 'rgba(255,255,255,0.07)' },
  discordStatsPanel: { minHeight: 78, backgroundColor: '#2B2D31', borderRadius: 14, paddingHorizontal: 14, flexDirection: 'row', alignItems: 'center', borderWidth: 1, borderColor: 'rgba(255,255,255,0.045)', marginBottom: 17 },
  discordStat: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 10 },
  discordStatIcon: { width: 36, height: 36, borderRadius: 11, alignItems: 'center', justifyContent: 'center' },
  discordStatValue: { color: '#F2F3F5', fontSize: 14, fontWeight: '900' },
  discordStatLabel: { color: '#949BA4', fontSize: 10, marginTop: 3 },
  discordStatDivider: { width: 1, height: 34, backgroundColor: 'rgba(255,255,255,0.09)', marginHorizontal: 10 },
  discordChallenge: { backgroundColor: '#232428', borderRadius: 16, borderWidth: 1, borderColor: 'rgba(88,101,242,0.32)', padding: 16, marginBottom: 12 },
  discordChallengeTop: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 13 },
  discordChallengeBadge: { flexDirection: 'row', alignItems: 'center', gap: 5, backgroundColor: '#5865F2', borderRadius: 6, paddingHorizontal: 8, paddingVertical: 5 },
  discordChallengeBadgeText: { color: '#FFFFFF', fontSize: 9, fontWeight: '900', letterSpacing: 0.6 },
  discordChallengeTitle: { color: '#F2F3F5', fontSize: 17, fontWeight: '900' },
  discordChallengeText: { color: '#B5BAC1', fontSize: 12, lineHeight: 18, marginTop: 6 },
  discordChallengeAction: { alignSelf: 'flex-start', minHeight: 36, flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: '#5865F2', borderRadius: 9, paddingHorizontal: 12, marginTop: 14 },
  discordChallengeActionText: { color: '#FFFFFF', fontSize: 11, fontWeight: '800' },
  discordTutorRow: { minHeight: 65, flexDirection: 'row', alignItems: 'center', gap: 11, backgroundColor: '#2B2D31', borderRadius: 13, paddingHorizontal: 12, marginBottom: 22 },
  discordTutorIcon: { width: 37, height: 37, borderRadius: 11, backgroundColor: 'rgba(181,166,255,0.14)', alignItems: 'center', justifyContent: 'center' },
  discordTutorTitle: { color: '#F2F3F5', fontSize: 12, fontWeight: '800' },
  safe: {
    flex: 1,
    backgroundColor: '#080D1D',
  },
  blurTarget: {
    flex: 1,
  },
  ambientBackground: {
    ...StyleSheet.absoluteFill,
    overflow: 'hidden',
  },
  ambientOrb: {
    position: 'absolute',
    borderRadius: 999,
  },
  ambientOrbOne: {
    width: 260,
    height: 260,
    top: 20,
    right: -120,
  },
  ambientOrbTwo: {
    width: 220,
    height: 220,
    top: 300,
    left: -120,
  },
  loadingScreen: {
    flex: 1,
    backgroundColor: '#0B1020',
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    color: '#8993AA',
    marginTop: 15,
    fontSize: 13,
  },
  scroll: {
    flex: 1,
  },
  content: {
    paddingHorizontal: 15,
    paddingTop: 14,
  },
  searchBox: {
    minHeight: 52,
    borderRadius: 17,
    borderWidth: 1,
    paddingHorizontal: 15,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginBottom: 18,
  },
  searchInput: {
    flex: 1,
    minWidth: 0,
    paddingVertical: 13,
    fontSize: 14,
  },
  searchResults: {
    marginBottom: 20,
    gap: 8,
  },
  searchSectionTitle: {
    fontSize: 14,
    fontWeight: '800',
    marginTop: 8,
    marginBottom: 3,
  },
  searchResultRow: {
    minHeight: 66,
    borderRadius: 15,
    borderWidth: 1,
    paddingHorizontal: 11,
    paddingVertical: 9,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  searchResultIcon: {
    width: 38,
    height: 38,
    borderRadius: 12,
    backgroundColor: 'rgba(166, 141, 255, 0.14)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  searchResultGlyph: { color: '#B9A7FF', fontSize: 20, fontWeight: '700' },
  searchResultCopy: { flex: 1, minWidth: 0 },
  searchResultTitle: { fontSize: 13, fontWeight: '800' },
  searchResultDetail: { fontSize: 11, lineHeight: 15, marginTop: 3 },
  searchEmpty: { fontSize: 13, paddingVertical: 18, textAlign: 'center' },
  searchHint: { fontSize: 11, textAlign: 'center', paddingVertical: 5 },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 18,
    gap: 12,
  },
  greetingContainer: {
    flex: 1,
    minWidth: 0,
  },
  muted: {
    color: '#8993AA',
    fontSize: 12,
  },
  heading: {
    color: '#FFFFFF',
    fontSize: 22,
    fontWeight: '800',
    marginTop: 5,
    flexShrink: 1,
    letterSpacing: -0.3,
  },
  avatar: {
    width: 46,
    height: 46,
    flexShrink: 0,
    borderRadius: 16,
    backgroundColor: '#7657E8',
    justifyContent: 'center',
    alignItems: 'center',
  },
  avatarText: {
    color: '#FFFFFF',
    fontSize: 21,
    fontWeight: 'bold',
  },
  hero: {
    borderRadius: 28,
    padding: 21,
    marginBottom: 14,
    borderWidth: 1,
    borderColor: 'rgba(190, 174, 255, 0.20)',
    overflow: 'hidden',
  },
  heroTag: {
    color: '#C5B8FF',
    fontSize: 11,
    fontWeight: 'bold',
    letterSpacing: 2,
  },
  heroTitle: {
    color: '#FFFFFF',
    fontSize: 24,
    lineHeight: 31,
    fontWeight: 'bold',
    marginTop: 12,
    maxWidth: 240,
    letterSpacing: -0.5,
  },
  heroDescription: {
    color: '#D1C9F0',
    fontSize: 14,
    lineHeight: 20,
    marginTop: 7,
  },
  primaryButton: {
    minHeight: 48,
    backgroundColor: '#8065ED',
    paddingVertical: 13,
    paddingHorizontal: 20,
    borderRadius: 16,
    alignSelf: 'flex-start',
    marginTop: 18,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 9,
  },
  primaryButtonText: {
    color: '#FFFFFF',
    fontWeight: 'bold',
    fontSize: 14,
  },
  secondaryHeroButton: {
    minHeight: 42,
    alignSelf: 'flex-start',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 4,
    marginTop: 7,
  },
  secondaryHeroButtonText: {
    color: '#D7C9FF',
    fontSize: 12,
    fontWeight: '700',
  },
  heroDecoration: {
    position: 'absolute',
    right: 22,
    top: 48,
    opacity: 0.35,
  },
  stats: {
    flexDirection: 'row',
    gap: 9,
    marginBottom: 16,
  },
  statCard: {
    flex: 1,
    minWidth: 0,
    minHeight: 92,
    borderRadius: 19,
    padding: 11,
    justifyContent: 'center',
  },
  statNumber: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: 'bold',
    marginTop: 8,
    marginBottom: 4,
  },
  tutorCard: {
    borderRadius: 22,
    borderWidth: 1,
    borderColor: 'rgba(190, 174, 255, 0.16)',
    padding: 0,
    marginBottom: 24,
    overflow: 'hidden',
  },
  tutorPressable: {
    minHeight: 78,
    flexDirection: 'row',
    alignItems: 'center',
    padding: 14,
    gap: 12,
  },
  tutorIcon: {
    width: 48,
    height: 48,
    borderRadius: 15,
    backgroundColor: '#33446B',
    justifyContent: 'center',
    alignItems: 'center',
  },
  tutorTextContainer: {
    flex: 1,
    minWidth: 0,
  },
  tutorTitle: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: 'bold',
    marginBottom: 5,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 13,
  },
  sectionTitle: {
    color: '#FFFFFF',
    fontSize: 18,
    fontWeight: 'bold',
  },
  link: {
    color: '#A68DFF',
    fontSize: 13,
  },
  subjectGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    rowGap: 12,
  },
  subjectCard: {
    width: '47.5%',
    minHeight: 136,
    borderRadius: 19,
    overflow: 'hidden',
  },
  subjectPressable: {
    flex: 1,
    minHeight: 136,
    padding: 14,
    justifyContent: 'center',
  },
  subjectIcon: {
    marginBottom: 12,
  },
  subjectName: {
    color: '#FFFFFF',
    fontWeight: 'bold',
    fontSize: 15,
  },
  subjectTopics: {
    color: '#D0D2E0',
    fontSize: 11,
    marginTop: 5,
  },
  bottomNavGlass: {
    marginHorizontal: 12,
    marginBottom: 6,
    borderRadius: 23,
    overflow: 'hidden',
  },
  bottomNav: {
    minHeight: 64,
    flexDirection: 'row',
    alignItems: 'stretch',
    backgroundColor: 'transparent',
    borderTopWidth: 0,
    paddingTop: 6,
    paddingHorizontal: 4,
  },
  navItem: {
    flex: 1,
    minWidth: 0,
    minHeight: 54,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 3,
    paddingHorizontal: 2,
    paddingVertical: 4,
  },
  navIconWrap: {
    width: 36,
    height: 31,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  activeNavIconWrap: { backgroundColor: 'rgba(168, 143, 255, 0.15)' },
  navLabel: {
    color: '#758098',
    fontSize: 10,
    lineHeight: 13,
    textAlign: 'center',
  },
  activeNavLabel: {
    fontWeight: 'bold',
  },
  emptyPage: {
    flex: 1,
    minHeight: 550,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 25,
  },
  pageTitle: {
    color: '#FFFFFF',
    fontSize: 27,
    fontWeight: 'bold',
    textAlign: 'center',
    marginTop: 20,
  },
  pageDescription: {
    color: '#A5AEC2',
    fontSize: 15,
    textAlign: 'center',
    lineHeight: 23,
    marginTop: 12,
  },
  comingSoon: {
    color: '#A88FFF',
    fontSize: 13,
    marginTop: 25,
    textAlign: 'center',
  },
});
