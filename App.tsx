
import { useRef, useState } from 'react';
import Animated, {
  useAnimatedScrollHandler,
  useSharedValue,
  withSpring,
} from 'react-native-reanimated';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import {
  ActivityIndicator,
  ScrollView,
  StyleSheet,
  Text,
  View,
  Pressable,
} from 'react-native';
import {
  SafeAreaProvider,
  SafeAreaView,
  useSafeAreaInsets,
} from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';

import LearnScreen from './src/screens/LearnScreen';
import QuizScreen from './src/screens/QuizScreen';
import AiTutorScreen from './src/screens/AiTutorScreen';
import ProfileScreen from './src/screens/ProfileScreen';
import BattleScreen from './src/screens/BattleScreen';
import SettingsScreen from './src/screens/SettingsScreen';
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

const subjects = [
  { icon: 'calculator-outline', name: 'Matematika', topics: '12 ta mavzu', color: '#283C70' },
  { icon: 'flask-outline', name: 'Fizika', topics: '8 ta mavzu', color: '#49346D' },
  { icon: 'laptop-outline', name: 'Informatika', topics: '10 ta mavzu', color: '#245A59' },
  { icon: 'language-outline', name: 'Ingliz tili', topics: '15 ta mavzu', color: '#65432D' },
] as const;

const navigation: LiquidDockItem[] = [
  { id: 'home', icon: 'home-outline', activeIcon: 'home', label: 'Bosh' },
  { id: 'learn', icon: 'book-outline', activeIcon: 'book', label: 'Darslar' },
  { id: 'battle', icon: 'flash-outline', activeIcon: 'flash', label: 'Battle' },
  { id: 'ranking', icon: 'trophy-outline', activeIcon: 'trophy', label: 'Reyting' },
  { id: 'profile', icon: 'person-outline', activeIcon: 'person', label: 'Profil' },
];

function AppContent() {
  const { user, loading, login, register } = useAuth();
  const { theme, ready } = useAppSettings();
  const insets = useSafeAreaInsets();
  const { tokens } = useTheme();

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

  const backgroundColor = tokens.colors.background;
  const cardColor = tokens.colors.surfaceGlass;
  const textColor = tokens.colors.text;
  const mutedColor = tokens.colors.textMuted;
  const navColor = tokens.colors.surfaceGlass;
  const borderColor = tokens.colors.glassBorder;

  const openTab = (nextTab: Tab) => {
    setTab(nextTab);
    setShowSettings(false);
    setSelectedTopic(null);
    setSelectedSubject(null);
  };

  const renderHome = () => (
    <>
      <View style={styles.header}>
        <View style={styles.greetingContainer}>
          <Text style={[styles.muted, { color: mutedColor }]}>
            XUSH KELIBSIZ!
          </Text>
          <Text
            style={[styles.heading, { color: textColor }]}
            numberOfLines={1}
          >
            Salom, {user?.displayName || 'Bilimdon'}!
          </Text>
        </View>

        <Pressable
          style={styles.avatar}
          onPress={() => openTab('profile')}
          accessibilityRole="button"
          accessibilityLabel="Profilga o'tish"
        >
          <Text style={styles.avatarText}>
            {user?.displayName?.charAt(0)?.toUpperCase() || 'U'}
          </Text>
        </Pressable>
      </View>

      <GlassSurface
        intensity={tokens.blur.strong}
        style={[
          styles.hero,
          {
            backgroundColor: isDark
              ? 'rgba(91, 65, 166, 0.30)'
              : 'rgba(113, 85, 232, 0.16)',
            borderColor: 'rgba(183, 160, 255, 0.30)',
          },
        ]}
      >
        <Text style={[styles.heroTag, { color: isDark ? "#C5B8FF" : tokens.colors.primary }]}>QUIZ ARENA</Text>
        <Text style={[styles.heroTitle, { color: textColor }]}>Bilimingni sinab ko'r!</Text>
        <Text style={[styles.heroDescription, { color: isDark ? "#D1C9F0" : tokens.colors.textSecondary }]}>
          O'rgan. Rivojlan. Raqobatlash.
        </Text>

        <Pressable
          style={styles.primaryButton}
          onPress={() => openTab('battle')}
        >
          <Text style={styles.primaryButtonText}>Battle boshlash</Text>
          <Ionicons name="arrow-forward" size={17} color="#FFFFFF" />
        </Pressable>

        <Ionicons
          name="sparkles"
          size={85}
          color="#A28AFF"
          style={styles.heroDecoration}
        />
      </GlassSurface>

      <View style={styles.stats}>
        <GlassSurface intensity={tokens.blur.medium} style={styles.statCard}>
          <Ionicons name="star" size={20} color="#F5C451" />
          <Text style={[styles.statNumber, { color: textColor }]}>
            {user?.xp ?? 0} XP
          </Text>
          <Text style={[styles.muted, { color: mutedColor }]}>Tajriba</Text>
        </GlassSurface>

        <GlassSurface intensity={tokens.blur.medium} style={styles.statCard}>
          <Ionicons name="trophy" size={20} color="#F5C451" />
          <Text style={[styles.statNumber, { color: textColor }]}>
            Bronze
          </Text>
          <Text style={[styles.muted, { color: mutedColor }]}>Reyting</Text>
        </GlassSurface>

        <GlassSurface intensity={tokens.blur.medium} style={styles.statCard}>
          <Ionicons name="flame" size={20} color="#FF8A65" />
          <Text style={[styles.statNumber, { color: textColor }]}>
            0 kun
          </Text>
          <Text style={[styles.muted, { color: mutedColor }]}>
            Ketma-ket
          </Text>
        </GlassSurface>
      </View>

      <GlassSurface
        intensity={tokens.blur.strong}
        style={[
          styles.tutorCard,
          {
            backgroundColor: isDark
              ? 'rgba(38, 57, 91, 0.42)'
              : 'rgba(255, 255, 255, 0.55)',
          },
        ]}
      >
      <Pressable
        style={styles.tutorPressable}
        onPress={() => openTab('tutor')}
      >
        <View style={[styles.tutorIcon, { backgroundColor: isDark ? "#33446B" : "#E9E4FF" }]}>
          <Ionicons name="sparkles" size={26} color={isDark ? "#C9B9FF" : tokens.colors.primary} />
        </View>

        <View style={styles.tutorTextContainer}>
          <Text style={[styles.tutorTitle, { color: textColor }]}>
            Shaxsiy AI Ustoz
          </Text>
          <Text style={[styles.muted, { color: mutedColor }]}>
            Savollaringizga javob oling va mavzularni o'rganing
          </Text>
        </View>

        <Ionicons
          name="chevron-forward"
          size={22}
          color={textColor}
        />
      </Pressable>
      </GlassSurface>

      <View style={styles.sectionHeader}>
        <Text style={[styles.sectionTitle, { color: textColor }]}>
          Fanlarni o'rganish
        </Text>

        <Pressable onPress={() => openTab('learn')}>
          <Text style={styles.link}>Barchasi →</Text>
        </Pressable>
      </View>

      <View style={styles.subjectGrid}>
        {subjects.map((subject) => (
          <GlassSurface
            key={subject.name}
            intensity={tokens.blur.strong}
            style={[
              styles.subjectCard,
              {
                backgroundColor: isDark
                  ? 'rgba(35, 49, 79, 0.52)'
                  : 'rgba(255, 255, 255, 0.62)',
                borderColor: isDark
                  ? 'rgba(174, 158, 255, 0.22)'
                  : 'rgba(113, 85, 232, 0.18)',
              },
            ]}
          >
            <Pressable
              style={styles.subjectPressable}
              onPress={() => openTab('learn')}
            >
              <Ionicons
                name={subject.icon}
                size={29}
                color="#B9A7FF"
                style={styles.subjectIcon}
              />
              <Text style={[styles.subjectName, { color: textColor }]}>
                {subject.name}
              </Text>
              <Text style={[styles.subjectTopics, { color: mutedColor }]}>
                {subject.topics}
              </Text>
            </Pressable>
          </GlassSurface>
        ))}
      </View>
    </>
  );

  const renderOtherTab = () => {
    if (tab === 'learn') {
      return (
        <LearnScreen
          onTopicSelect={(subject, topic) => {
            setSelectedSubject(subject);
            setSelectedTopic(topic);
          }}
        />
      );
    }

    if (tab === 'profile') {
      if (showSettings) {
        return (
          <SettingsScreen
            onBack={() => setShowSettings(false)}
          />
        );
      }

      return (
        <ProfileScreen
          onSettingsPress={() => setShowSettings(true)}
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

      <View pointerEvents="none" style={styles.ambientBackground}>
        <View
          style={[
            styles.ambientOrb,
            styles.ambientOrbOne,
            {
              backgroundColor: isDark
                ? 'rgba(113, 85, 232, 0.20)'
                : 'rgba(113, 85, 232, 0.12)',
            },
          ]}
        />
        <View
          style={[
            styles.ambientOrb,
            styles.ambientOrbTwo,
            {
              backgroundColor: isDark
                ? 'rgba(53, 200, 216, 0.12)'
                : 'rgba(53, 200, 216, 0.10)',
            },
          ]}
        />
      </View>

      {tab === 'tutor' && !selectedTopic ? (
        <AiTutorScreen
          onBack={() => openTab('home')}
          bottomDockSpace={96}
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
        {selectedTopic && selectedSubject ? (
          <QuizScreen
            subject={selectedSubject}
            topic={selectedTopic}
            onBack={() => setSelectedTopic(null)}
          />
        ) : tab === 'home' ? (
          renderHome()
        ) : (
          renderOtherTab()
        )}
      </Animated.ScrollView>
      )}
      <LiquidDock
        items={navigation}
        activeKey={tab}
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
  safe: {
    flex: 1,
    backgroundColor: '#080D1D',
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
    paddingHorizontal: 18,
    paddingTop: 14,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 20,
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
    fontSize: 23,
    fontWeight: 'bold',
    marginTop: 5,
    flexShrink: 1,
    letterSpacing: -0.3,
  },
  avatar: {
    width: 45,
    height: 45,
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
    borderRadius: 26,
    padding: 22,
    marginBottom: 16,
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
    fontSize: 26,
    lineHeight: 33,
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
    minHeight: 50,
    backgroundColor: '#9678FF',
    paddingVertical: 13,
    paddingHorizontal: 20,
    borderRadius: 15,
    alignSelf: 'flex-start',
    marginTop: 20,
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
    minHeight: 100,
    borderRadius: 18,
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
    borderRadius: 20,
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
