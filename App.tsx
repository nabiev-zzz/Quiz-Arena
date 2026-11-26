import { LocalizedText, LocalizedTextInput, translateText } from './src/i18n/LocalizedText';

import { useEffect, useRef, useState } from 'react';
import Animated, {
  useAnimatedScrollHandler,
  useSharedValue,
  withSpring,
  FadeInDown,
} from 'react-native-reanimated';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import {
  ActivityIndicator,
  Alert,
  Image,
  Modal,
  StyleSheet,
  Text as NativeText,
  View,
  Pressable,
  TextInput as NativeTextInput,
} from 'react-native';
import {
  SafeAreaProvider,
  SafeAreaView,
  useSafeAreaInsets,
} from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { subjects as learningSubjects } from './src/data/subjects';
import { getDailyTasks, claimDailyTask, type DailyTask } from './src/services/dailyTasksService';
import { getNotifications } from './src/services/notificationsService';

import LearnScreen from './src/screens/LearnScreen';
import DailyTasksScreen from './src/screens/DailyTasksScreen';
import DocumentQuizScreen from './src/screens/DocumentQuizScreen';
import SmartPracticeScreen from './src/screens/SmartPracticeScreen';
import QuizScreen from './src/screens/QuizScreen';
import AiTutorScreen from './src/screens/AiTutorScreen';
import SupportHomeScreen from './src/screens/SupportHomeScreen';
import SupportChatScreen from './src/screens/SupportChatScreen';
import ProfileScreen from './src/screens/ProfileScreen';
import ShopScreen from './src/screens/ShopScreen';
import CosmeticCollectionScreen from './src/screens/CosmeticCollectionScreen';
import ProfileEditScreen from './src/screens/ProfileEditScreen';
import PublicProfileScreen from './src/screens/PublicProfileScreen';
import DiscoverUsersScreen from './src/screens/DiscoverUsersScreen';
import BattleScreen from './src/screens/BattleScreen';
import SettingsScreen from './src/screens/SettingsScreen';
import PremiumScreen from './src/screens/PremiumScreen';
import QaAdminScreen from './src/screens/QaAdminScreen';
import LoginScreen from './src/screens/auth/LoginScreen';
import RegisterScreen from './src/screens/auth/RegisterScreen';

import { AuthProvider, useAuth } from './src/context/AuthContext';
import {
  AppSettingsProvider,
  useAppSettings,
} from './src/context/AppSettingsContext';

import { ThemeProvider, useTheme } from './src/theme/ThemeContext';
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
    refreshUser,
    login,
    register,
    requestEmailVerification,
    verifyEmail,
    requestEmailPasswordReset,
    resetEmailPassword,
    startGoogleLogin,
    startTelegramLogin,
  } = useAuth();
  const { theme, language, ready } = useAppSettings();
  const insets = useSafeAreaInsets();
  const { tokens } = useTheme();

  const dockStretch = useSharedValue(0);
  const lastDockScrollY = useSharedValue(0);
  const seenAdminNoticeIds = useRef<Set<string>>(new Set());
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
  const [homeDailyTasks, setHomeDailyTasks] = useState<DailyTask[]>([]);
  const homeDailyDateRef = useRef('');
  const [homeDailyLoading, setHomeDailyLoading] = useState(false);

  const loadHomeDailyTasks = async () => {
    if (!user) return;
    setHomeDailyLoading(true);
    try {
      const result = await getDailyTasks();
      setHomeDailyTasks(result.tasks);
      homeDailyDateRef.current = result.date;
    } catch {
      // Keep the home screen usable if the daily-task service is temporarily unavailable.
    } finally {
      setHomeDailyLoading(false);
    }
  };

  const [tab, setTab] = useState<Tab>('home');
  const [authScreen, setAuthScreen] = useState<'login' | 'register'>('login');
  const [selectedSubject, setSelectedSubject] = useState<Subject | null>(null);
  const [selectedTopic, setSelectedTopic] = useState<Topic | null>(null);
  const [showSettings, setShowSettings] = useState(false);
  const [showCosmeticCollection, setShowCosmeticCollection] = useState(false);
  const [showProfileEdit, setShowProfileEdit] = useState(false);
  const [showNavigationDrawer, setShowNavigationDrawer] = useState(false);
  const [showDailyTasks, setShowDailyTasks] = useState(false);
  const [supportScreen, setSupportScreen] = useState<'home' | 'chat' | null>(null);
  const [supportInitialPrompt, setSupportInitialPrompt] = useState('');
  const [showPremium, setShowPremium] = useState(false);
  const [showDocumentQuiz, setShowDocumentQuiz] = useState(false);
  const [showSmartPractice, setShowSmartPractice] = useState(false);
  const [showShop, setShowShop] = useState(false);
  const [showQaAdmin, setShowQaAdmin] = useState(false);
  const [selectedPublicUsername, setSelectedPublicUsername] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');

  useEffect(() => {
    if (tab !== 'home' || !user) return;
    void loadHomeDailyTasks();
    const refreshAtDayChange = setInterval(() => {
      const tashkentDate = new Intl.DateTimeFormat('en-CA', {
        timeZone: 'Asia/Tashkent', year: 'numeric', month: '2-digit', day: '2-digit',
      }).format(new Date());
      if (homeDailyDateRef.current && tashkentDate !== homeDailyDateRef.current) void loadHomeDailyTasks();
    }, 60_000);
    return () => clearInterval(refreshAtDayChange);
  }, [tab, user?.id]);


  useEffect(() => {
    if (!user) { seenAdminNoticeIds.current.clear(); return; }
    let active = true;
    const pollNotifications = async () => {
      try {
        const result = await getNotifications();
        if (!active) return;
        const fresh = result.items.filter(item => !item.isRead && !seenAdminNoticeIds.current.has(item.id));
        fresh.forEach(item => seenAdminNoticeIds.current.add(item.id));
        if (fresh.length) {
          const latest = fresh.slice(0, 3);
          Alert.alert(latest.length === 1 ? latest[0].title : 'Yangi bildirishnomalar', latest.map(item => `${item.title}\n${item.body}`).join('\n\n'));
        }
      } catch { /* Notification polling must never block normal app use. */ }
    };
    void pollNotifications();
    const timer = setInterval(() => { void pollNotifications(); }, 25000);
    return () => { active = false; clearInterval(timer); };
  }, [user?.id]);

  const backgroundColor = tokens.colors.background;
  const textColor = tokens.colors.text;
  const mutedColor = tokens.colors.textMuted;
  const borderColor = tokens.colors.glassBorder;

  const openTab = (nextTab: Tab) => {
    setShowNavigationDrawer(false);
    setShowDailyTasks(false);
    // A tab selection must dismiss every modal/secondary screen, including Support.
    // Otherwise the Support screen remains mounted above the selected tab.
    setSupportScreen(null);
    setSupportInitialPrompt('');
    setTab(nextTab);
    setShowSettings(false);
    setShowCosmeticCollection(false);
    setShowProfileEdit(false);
    setShowPremium(false);
    setShowDocumentQuiz(false);
    setShowSmartPractice(false);
    setShowShop(false);
    setSelectedPublicUsername(null);
    setSelectedTopic(null);
    setSelectedSubject(null);
  };

  const renderHome = () => {
    const normalizedQuery = searchQuery.trim().normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLocaleLowerCase();
    const features = [
      { key: 'learn', title: translateText('Fanlar va testlar', language), detail: translateText('Fanlarni tanlang, mavzularni yeching', language), icon: 'book-outline' as const },
      { key: 'battle', title: 'Battle', detail: translateText('Raqiblar bilan bilim bellashuvi', language), icon: 'flash-outline' as const },
      { key: 'ranking', title: translateText('Reyting', language), detail: translateText('Liderlar va natijalarni ko‘ring', language), icon: 'trophy-outline' as const },
      { key: 'tutor', title: translateText('AI Ustoz', language), detail: translateText('Savol bering, mavzuni tushuning', language), icon: 'sparkles-outline' as const },
      { key: 'friends', title: translateText('Hamjamiyat', language), detail: translateText('Bilimdonlarni toping va kuzating', language), icon: 'people-outline' as const },
      { key: 'profile', title: translateText('Profil', language), detail: translateText('Hisob, avatar va yutuqlaringiz', language), icon: 'person-outline' as const },
      { key: 'premium', title: 'Premium', detail: translateText('Qo‘shimcha tarif va imkoniyatlar', language), icon: 'diamond-outline' as const },
      { key: 'settings', title: translateText('Sozlamalar', language), detail: translateText('Til, mavzu va bildirishnomalar', language), icon: 'settings-outline' as const },
    ];
    const featureMatches = normalizedQuery
      ? features.filter((item) => `${item.title} ${item.detail}`.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLocaleLowerCase().includes(normalizedQuery))
      : [];
    const subjectMatches = normalizedQuery
      ? learningSubjects.filter((subject) => `${subject.name} ${translateText(subject.name, language)} ${subject.description} ${translateText(subject.description, language)}`.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLocaleLowerCase().includes(normalizedQuery)).slice(0, 8)
      : [];
    const topicMatches = normalizedQuery
      ? learningSubjects.flatMap((subject) => subject.topics.filter((topic) => `${subject.name} ${topic.name} ${topic.description}`.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLocaleLowerCase().includes(normalizedQuery)).map((topic) => ({ subject, topic }))).slice(0, 20)
      : [];
    const openFeature = (key: string) => {
      if (key === 'friends') {
        openTab('profile');
        setSelectedPublicUsername('__discover__');
        return;
      }
      if (key === 'premium') {
        openTab('profile');
        setShowPremium(true);
        return;
      }
      if (key === 'settings') {
        openTab('profile');
        setShowSettings(true);
        return;
      }
      if (key === 'tutor') {
        setTab('tutor');
        setShowSettings(false);
        setShowPremium(false);
        setSelectedPublicUsername(null);
        setSelectedSubject(null);
        setSelectedTopic(null);
        return;
      }
      openTab(key as Tab);
    };

    return (
      <>
        <View style={styles.homeHeader}>
          <Pressable
            style={[styles.homeMenuButton, { backgroundColor: tokens.colors.surfaceElevated, borderColor }]}
            onPress={() => setShowNavigationDrawer(true)}
            accessibilityRole="button"
            accessibilityLabel="Yon menyuni ochish"
            hitSlop={8}
          >
            <Ionicons name="menu" size={24} color={textColor} />
          </Pressable>
          <View style={styles.homeBrand}>
            <View style={styles.homeBrandIcon}><LocalizedText style={styles.homeBrandLetter}>Z</LocalizedText></View>
            <View style={styles.homeBrandText}>
              <LocalizedText style={[styles.homeEyebrow, { color: mutedColor }]}>ZELQEN CORE</LocalizedText>
              <LocalizedText style={[styles.homeGreeting, { color: textColor }]}>Salom, {user?.displayName || 'Bilimdon'}!</LocalizedText>
            </View>
          </View>
          <Pressable style={[styles.homeProfileButton, { backgroundColor: tokens.colors.surfaceElevated, borderColor }]} onPress={() => openTab('profile')} accessibilityRole="button" accessibilityLabel="Profil">
            <Ionicons name="person-outline" size={19} color={textColor} />
          </Pressable>
        </View>

        <View style={[styles.homeSearch, { borderColor, backgroundColor: tokens.colors.surface }]}>
          <Ionicons name="search-outline" size={19} color={mutedColor} />
          <LocalizedTextInput value={searchQuery} onChangeText={setSearchQuery} placeholder="Funksiya, fan yoki mavzuni qidiring" placeholderTextColor={mutedColor} style={[styles.homeSearchInput, { color: textColor }]} returnKeyType="search" autoCorrect={false} accessibilityLabel="Ilova bo‘ylab qidirish" />
          {searchQuery.length > 0 && <Pressable onPress={() => setSearchQuery('')} hitSlop={10}><Ionicons name="close-circle" size={18} color={mutedColor} /></Pressable>}
        </View>

        {normalizedQuery.length === 0 && (
          <Pressable
            style={[styles.dailyHomeCard, { backgroundColor: tokens.colors.surface, borderColor }]}
            onPress={() => setShowDailyTasks(true)}
            accessibilityRole="button"
            accessibilityLabel="Barcha kunlik vazifalarni ochish"
          >
            <View style={styles.dailyHomeTop}>
              <View style={styles.dailyHomeHeading}>
                <View style={styles.dailyHomeIcon}><Ionicons name="flash" size={18} color="#FFFFFF" /></View>
                <View style={{ flex: 1 }}>
                  <LocalizedText style={[styles.dailyHomeTitle, { color: textColor }]}>Kunlik vazifalar</LocalizedText>
                  <LocalizedText style={[styles.dailyHomeSubtitle, { color: mutedColor }]}>Asosiy maqsadlaringiz va bugungi natija</LocalizedText>
                </View>
              </View>
              <View style={styles.dailyTodayPill}><LocalizedText style={styles.dailyTodayText}>BUGUN</LocalizedText></View>
            </View>
            {homeDailyLoading ? (
              <View style={styles.dailyLoading}><ActivityIndicator size="small" color={tokens.colors.primary} /><LocalizedText style={[styles.dailyHomeSubtitle, { color: mutedColor }]}>Vazifalar yuklanmoqda...</LocalizedText></View>
            ) : (
              <>
                <View style={styles.dailyTaskList}>
                  {homeDailyTasks.slice(0, 2).map((task) => (
                    <View key={task.id} style={styles.dailyTaskRow}>
                      <View style={styles.dailyTaskMain}>
                        <View style={[styles.dailyTaskCheck, task.completed && styles.dailyTaskCheckDone]}>
                          <Ionicons name={task.completed ? "checkmark" : "ellipse-outline"} size={15} color={task.completed ? "#FFFFFF" : mutedColor} />
                        </View>
                        <View style={styles.dailyTaskCopy}>
                          <LocalizedText style={[styles.dailyTaskName, { color: textColor }]} numberOfLines={1}>{task.title}</LocalizedText>
                          <LocalizedText style={[styles.dailyTaskDescription, { color: mutedColor }]} numberOfLines={1}>{task.description}</LocalizedText>
                        </View>
                        <View style={styles.dailyRewardPill}><LocalizedText style={styles.dailyRewardText}>+{task.reward} ZC</LocalizedText></View>
                      </View>
                    </View>
                  ))}
                  {homeDailyTasks.length === 0 && <LocalizedText style={[styles.dailyHomeSubtitle, { color: mutedColor }]}>{homeDailyLoading ? "Yuklanmoqda..." : "Bugungi vazifalarni ko‘rish uchun bosing."}</LocalizedText>}
                </View>
                <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginTop: 12 }}>
                  <LocalizedText style={[styles.dailyHomeSubtitle, { color: mutedColor }]}>{homeDailyTasks.filter((task) => task.completed).length}/{homeDailyTasks.length} ta vazifa bajarildi</LocalizedText>
                  <View style={{ flexDirection: "row", alignItems: "center", gap: 5 }}>
                    <LocalizedText style={{ color: tokens.colors.primary, fontSize: 10, fontWeight: "900" }}>Barchasini ko‘rish</LocalizedText>
                    <Ionicons name="chevron-forward" size={14} color={tokens.colors.primary} />
                  </View>
                </View>
              </>
            )}
          </Pressable>
        )}

        {normalizedQuery.length > 0 ? (
          <View style={styles.homeSearchResults}>
            {featureMatches.length > 0 && <LocalizedText style={[styles.homeSectionTitle, { color: mutedColor }]}>FUNKSIYALAR</LocalizedText>}
            {featureMatches.map((item) => (
              <Pressable key={item.key} style={[styles.homeSearchRow, { backgroundColor: tokens.colors.surface, borderColor }]} onPress={() => openFeature(item.key)}>
                <View style={[styles.homeSearchIcon, { backgroundColor: 'rgba(88,101,242,0.14)' }]}><Ionicons name={item.icon} size={19} color={tokens.colors.primaryLight} /></View>
                <View style={styles.homeFeatureCopy}><LocalizedText style={[styles.homeFeatureTitle, { color: textColor }]}>{item.title}</LocalizedText><LocalizedText style={[styles.homeFeatureDescription, { color: mutedColor }]}>{item.detail}</LocalizedText></View>
                <Ionicons name="chevron-forward" size={17} color={mutedColor} />
              </Pressable>
            ))}
            {subjectMatches.length > 0 && <LocalizedText style={[styles.homeSectionTitle, { color: mutedColor }]}>FANLAR</LocalizedText>}
            {subjectMatches.map((subject) => (
              <Pressable key={subject.id} style={[styles.homeSearchRow, { backgroundColor: tokens.colors.surface, borderColor }]} onPress={() => { openTab('learn'); setSelectedSubject(subject); }}>
                <View style={[styles.homeSearchIcon, { backgroundColor: 'rgba(88,101,242,0.14)' }]}><LocalizedText style={styles.homeSearchGlyph}>{subject.icon}</LocalizedText></View>
                <View style={styles.homeFeatureCopy}><LocalizedText style={[styles.homeFeatureTitle, { color: textColor }]}>{subject.name}</LocalizedText><LocalizedText style={[styles.homeFeatureDescription, { color: mutedColor }]}>{subject.description}</LocalizedText></View>
                <Ionicons name="chevron-forward" size={17} color={mutedColor} />
              </Pressable>
            ))}
            {topicMatches.length > 0 && <LocalizedText style={[styles.homeSectionTitle, { color: mutedColor }]}>MAVZULAR</LocalizedText>}
            {topicMatches.map(({ subject, topic }) => (
              <Pressable key={subject.id + ':' + topic.id} style={[styles.homeSearchRow, { backgroundColor: tokens.colors.surface, borderColor }]} onPress={() => { setSelectedSubject(subject); setSelectedTopic(topic); setTab('learn'); }}>
                <View style={[styles.homeSearchIcon, { backgroundColor: 'rgba(88,101,242,0.14)' }]}><Ionicons name="book-outline" size={18} color={tokens.colors.primaryLight} /></View>
                <View style={styles.homeFeatureCopy}><LocalizedText style={[styles.homeFeatureTitle, { color: textColor }]}>{topic.name}</LocalizedText><LocalizedText style={[styles.homeFeatureDescription, { color: mutedColor }]}>{subject.name} · {topic.description}</LocalizedText></View>
                <Ionicons name="chevron-forward" size={17} color={mutedColor} />
              </Pressable>
            ))}
            {featureMatches.length + subjectMatches.length + topicMatches.length === 0 && <LocalizedText style={[styles.homeEmpty, { color: mutedColor }]}>“{searchQuery}” bo‘yicha natija topilmadi.</LocalizedText>}
          </View>
        ) : (
          <>
            <View style={styles.homeSectionHeader}>
              <LocalizedText style={[styles.homeSectionTitle, { color: mutedColor }]}>BARCHA IMKONIYATLAR</LocalizedText>
              <View style={styles.homeXpChip}>
                <Ionicons name="star" size={13} color="#F5C451" />
                <LocalizedText style={styles.homeXpText}>{user?.xp ?? 0} XP</LocalizedText>
              </View>
            </View>
            <View style={styles.homeFeatureGrid}>
              {features.map((item) => (
                <Pressable key={item.key} style={({ pressed }) => [styles.homeFeatureCard, { backgroundColor: tokens.colors.surface, borderColor }, pressed && styles.homeFeaturePressed]} onPress={() => openFeature(item.key)}>
                  <View style={[styles.homeFeatureIcon, { backgroundColor: 'rgba(88,101,242,0.14)' }]}>
                    <Ionicons name={item.icon} size={21} color={tokens.colors.primaryLight} />
                  </View>
                  <LocalizedText style={[styles.homeFeatureTitle, { color: textColor }]}>{item.title}</LocalizedText>
                  <LocalizedText style={[styles.homeFeatureDescription, { color: mutedColor }]} numberOfLines={2}>{item.detail}</LocalizedText>
                  <View style={styles.homeFeatureArrow}><Ionicons name="arrow-forward" size={15} color={mutedColor} /></View>
                </Pressable>
              ))}
            </View>
            <LocalizedText style={[styles.homeFooterText, { color: mutedColor }]}>Bilimingni oshir. Bellash. Natijangni ko‘rsat.</LocalizedText>
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

      if (showShop) {
        return <ShopScreen onBack={() => setShowShop(false)} />;
      }

      if (showPremium) {
        return <PremiumScreen onBack={() => setShowPremium(false)} />;
      }

      return (
        <ProfileScreen
          onClosePress={() => openTab('home')}
          onSettingsPress={() => setShowSettings(true)}
          onEditPress={() => setShowProfileEdit(true)}
          onPremiumPress={() => setShowPremium(true)}
          onShopPress={() => setShowShop(true)}
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
        <LocalizedText style={[styles.pageTitle, { color: textColor }]}>
          {page.title}
        </LocalizedText>
        <LocalizedText style={[styles.pageDescription, { color: mutedColor }]}>
          {page.description}
        </LocalizedText>
        <LocalizedText style={styles.comingSoon}>
          Bu bo'lim keyingi bosqichda ishlab chiqiladi.
        </LocalizedText>
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
        <LocalizedText style={[styles.loadingText, { color: mutedColor }]}>
          ZELQEN CORE yuklanmoqda...
        </LocalizedText>
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

      <Modal
        visible={showNavigationDrawer}
        transparent
        animationType="slide"
        statusBarTranslucent
        onRequestClose={() => setShowNavigationDrawer(false)}
      >
        <View style={styles.drawerOverlay}>
          <Pressable
            style={styles.drawerBackdrop}
            onPress={() => setShowNavigationDrawer(false)}
            accessibilityRole="button"
            accessibilityLabel="Menyani yopish"
          />
          <SafeAreaView
            edges={['top', 'bottom']}
            style={[styles.drawerPanel, { backgroundColor: tokens.colors.background, borderColor }]}
          >
            <View style={styles.drawerTopRow}>
              <LocalizedText style={[styles.drawerBrand, { color: textColor }]}>ZELQEN CORE</LocalizedText>
              <Pressable onPress={() => setShowNavigationDrawer(false)} style={styles.drawerClose} accessibilityRole="button" accessibilityLabel="Yopish">
                <Ionicons name="close" size={22} color={mutedColor} />
              </Pressable>
            </View>
            <Pressable
              style={[styles.drawerProfile, { backgroundColor: tokens.colors.surface, borderColor }]}
              onPress={() => openTab('profile')}
              accessibilityRole="button"
              accessibilityLabel="Profilni ochish"
            >
              {user.avatarUrl ? (
                <Image source={{ uri: user.avatarUrl }} style={styles.drawerAvatar} />
              ) : (
                <View style={[styles.drawerAvatar, styles.drawerAvatarFallback]}>
                  <LocalizedText style={styles.drawerAvatarInitials}>{user.displayName.split(' ').filter(Boolean).map((part) => part[0]).join('').slice(0, 2).toUpperCase()}</LocalizedText>
                </View>
              )}
              <View style={styles.drawerProfileCopy}>
                <LocalizedText style={[styles.drawerUserName, { color: textColor }]} numberOfLines={1}>{user.displayName}</LocalizedText>
                <LocalizedText style={[styles.drawerUsername, { color: mutedColor }]} numberOfLines={1}>@{user.username}</LocalizedText>
                <View style={styles.drawerStats}>
                  <LocalizedText style={styles.drawerStatText}>LVL {user.level}</LocalizedText>
                  <LocalizedText style={styles.drawerStatDivider}>·</LocalizedText>
                  <LocalizedText style={styles.drawerStatText}>{user.zcBalance ?? 0} ZC</LocalizedText>
                  <LocalizedText style={styles.drawerStatDivider}>·</LocalizedText>
                  <LocalizedText style={styles.drawerStatText}>{user.xp ?? 0} XP</LocalizedText>
                </View>
              </View>
              <Ionicons name="chevron-forward" size={18} color={mutedColor} />
            </Pressable>

            <Animated.ScrollView style={styles.drawerScroll} contentContainerStyle={styles.drawerScrollContent} showsVerticalScrollIndicator={false}>
              <LocalizedText style={[styles.drawerSectionLabel, { color: mutedColor }]}>BUGUNGI FAOLLIK</LocalizedText>
              <Pressable
                style={[styles.drawerItem, { backgroundColor: tokens.colors.surface }]}
                onPress={() => { setShowNavigationDrawer(false); setShowDailyTasks(true); }}
                accessibilityRole="button"
                accessibilityLabel="Kunlik vazifalarni ochish"
              >
                <View style={[styles.drawerItemIcon, { backgroundColor: 'rgba(39,185,138,0.16)' }]}>
                  <Ionicons name="flash" size={19} color="#27B98A" />
                </View>
                <View style={styles.drawerItemCopy}>
                  <LocalizedText style={[styles.drawerItemTitle, { color: textColor }]}>Kunlik vazifalar</LocalizedText>
                  <LocalizedText style={[styles.drawerItemDetail, { color: mutedColor }]}>Bugungi maqsadlar va ZC mukofotlari</LocalizedText>
                </View>
                <View style={styles.dailyRewardPill}>
                  <LocalizedText style={styles.dailyRewardText}>{homeDailyTasks.filter((task) => task.completed).length}/{homeDailyTasks.length}</LocalizedText>
                </View>
                <Ionicons name="chevron-forward" size={17} color={mutedColor} />
              </Pressable>

              <LocalizedText style={[styles.drawerSectionLabel, { color: mutedColor }]}>FANLAR</LocalizedText>
              <Pressable style={[styles.drawerItem, { backgroundColor: tokens.colors.surface }]} onPress={() => openTab('learn')}>
                <View style={[styles.drawerItemIcon, { backgroundColor: 'rgba(139,115,230,0.16)' }]}><Ionicons name="book-outline" size={19} color={tokens.colors.primary} /></View>
                <View style={styles.drawerItemCopy}>
                  <LocalizedText style={[styles.drawerItemTitle, { color: textColor }]}>Barcha fanlar</LocalizedText>
                  <LocalizedText style={[styles.drawerItemDetail, { color: mutedColor }]}>Fan va mavzularni tanlang</LocalizedText>
                </View>
                <Ionicons name="chevron-forward" size={17} color={mutedColor} />
              </Pressable>
              <Pressable style={[styles.drawerItem, { backgroundColor: tokens.colors.surface }]} onPress={() => { setShowNavigationDrawer(false); openTab('learn'); setShowSmartPractice(true); }}>
                <View style={[styles.drawerItemIcon, { backgroundColor: 'rgba(39,185,138,0.16)' }]}><Ionicons name="bulb-outline" size={19} color="#27B98A" /></View>
                <View style={styles.drawerItemCopy}>
                  <LocalizedText style={[styles.drawerItemTitle, { color: textColor }]}>Smart Practice</LocalizedText>
                  <LocalizedText style={[styles.drawerItemDetail, { color: mutedColor }]}>Xatolaringiz asosida shaxsiy mashq</LocalizedText>
                </View>
                <Ionicons name="chevron-forward" size={17} color={mutedColor} />
              </Pressable>
              <Pressable style={[styles.drawerItem, { backgroundColor: tokens.colors.surface }]} onPress={() => { setShowNavigationDrawer(false); openTab('learn'); setShowDocumentQuiz(true); }}>
                <View style={[styles.drawerItemIcon, { backgroundColor: 'rgba(121,88,201,0.16)' }]}><Ionicons name="document-text-outline" size={19} color="#A78BFA" /></View>
                <View style={styles.drawerItemCopy}>
                  <LocalizedText style={[styles.drawerItemTitle, { color: textColor }]}>Hujjatdan test yaratish</LocalizedText>
                  <LocalizedText style={[styles.drawerItemDetail, { color: mutedColor }]}>PDF yoki Word fayldan AI test</LocalizedText>
                </View>
                <Ionicons name="chevron-forward" size={17} color={mutedColor} />
              </Pressable>

              <LocalizedText style={[styles.drawerSectionLabel, { color: mutedColor }]}>ASOSIY BO‘LIMLAR</LocalizedText>
              {[
                { key: 'home', title: 'Bosh sahifa', detail: 'Asosiy panel', icon: 'home-outline' as const },
                { key: 'battle', title: 'Battle', detail: 'Bilim bellashuvlari', icon: 'flash-outline' as const },
                { key: 'ranking', title: 'Reyting', detail: 'Yetakchi bilimdonlar', icon: 'trophy-outline' as const },
                { key: 'tutor', title: 'AI Ustoz', detail: 'Shaxsiy AI yordamchi', icon: 'sparkles-outline' as const },
                { key: 'profile', title: 'Profil', detail: 'Hisob va yutuqlar', icon: 'person-outline' as const },
              ].map((item) => (
                <Pressable key={item.key} style={[styles.drawerCompactItem, { borderBottomColor: borderColor }]} onPress={() => openTab(item.key as Tab)}>
                  <Ionicons name={item.icon} size={19} color={tokens.colors.primary} />
                  <LocalizedText style={[styles.drawerCompactTitle, { color: textColor }]}>{item.title}</LocalizedText>
                  <Ionicons name="chevron-forward" size={16} color={mutedColor} />
                </Pressable>
              ))}
              {user.role === 'admin' && (
                <Pressable style={[styles.drawerCompactItem, { borderBottomColor: borderColor }]} onPress={() => { setShowNavigationDrawer(false); setShowQaAdmin(true); }}>
                  <Ionicons name="shield-checkmark-outline" size={19} color="#A78BFA" />
                  <LocalizedText style={[styles.drawerCompactTitle, { color: textColor }]}>QA boshqaruvi</LocalizedText>
                  <Ionicons name="chevron-forward" size={16} color={mutedColor} />
                </Pressable>
              )}
              <Pressable style={[styles.drawerCompactItem, { borderBottomColor: borderColor }]} onPress={() => { setShowNavigationDrawer(false); openTab('profile'); setShowSettings(true); }}>
                <Ionicons name="settings-outline" size={19} color={tokens.colors.primary} />
                <LocalizedText style={[styles.drawerCompactTitle, { color: textColor }]}>Sozlamalar</LocalizedText>
                <Ionicons name="chevron-forward" size={16} color={mutedColor} />
              </Pressable>
            </Animated.ScrollView>
            <LocalizedText style={[styles.drawerFooter, { color: mutedColor }]}>Bilimingni oshir. Bellash. Rivojlan.</LocalizedText>
          </SafeAreaView>
        </View>
      </Modal>

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

      {showQaAdmin && user.role === 'admin' ? (
        <QaAdminScreen onBack={() => setShowQaAdmin(false)} />
      ) : showDailyTasks ? (
        <DailyTasksScreen onBack={() => setShowDailyTasks(false)} />
      ) : supportScreen === 'chat' ? (
        <SupportChatScreen
          onBack={() => setSupportScreen('home')}
          bottomDockSpace={96}
          dockStretch={dockStretch}
          language={language}
          initialPrompt={supportInitialPrompt}
        />
      ) : supportScreen === 'home' ? (
        <SupportHomeScreen
          onBack={() => { setSupportScreen(null); setShowSettings(true); }}
          onOpenChat={(prompt) => {
            setSupportInitialPrompt(prompt ?? '');
            setSupportScreen('chat');
          }}
        />
      ) : showCosmeticCollection ? (
        <CosmeticCollectionScreen onBack={() => { setShowCosmeticCollection(false); setShowProfileEdit(true); }} />
      ) : showProfileEdit ? (
        <ProfileEditScreen onBack={() => setShowProfileEdit(false)} onCollectionPress={() => { setShowProfileEdit(false); setShowCosmeticCollection(true); }} />
      ) : showSettings ? (
        <SettingsScreen
          onBack={() => setShowSettings(false)}
          onHelp={() => { setShowSettings(false); setSupportScreen('home'); }}
          dockStretch={dockStretch}
        />
      ) : showSmartPractice ? (
        <SmartPracticeScreen
          onBack={() => setShowSmartPractice(false)}
          language={language}
        />
      ) : showDocumentQuiz ? (
        <DocumentQuizScreen
          onBack={() => setShowDocumentQuiz(false)}
          language={language}
        />
      ) : selectedTopic && selectedSubject ? (
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
      <LiquidDock
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



  homeMenuButton: { width: 40, height: 40, borderRadius: 12, borderWidth: 1, alignItems: 'center', justifyContent: 'center', marginRight: 10 },
  drawerOverlay: { flex: 1, flexDirection: 'row', backgroundColor: 'rgba(8,7,18,0.56)' },
  drawerBackdrop: StyleSheet.absoluteFill,
  drawerPanel: { width: '86%', maxWidth: 380, height: '100%', borderRightWidth: 1, paddingHorizontal: 17, paddingTop: 8, paddingBottom: 8, shadowColor: '#000000', shadowOffset: { width: 8, height: 0 }, shadowOpacity: 0.24, shadowRadius: 20, elevation: 24 },
  drawerTopRow: { minHeight: 43, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 },
  drawerBrand: { fontSize: 12, fontWeight: '900', letterSpacing: 1.8 },
  drawerClose: { width: 36, height: 36, borderRadius: 11, alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(140,130,170,0.12)' },
  drawerProfile: { minHeight: 92, borderWidth: 1, borderRadius: 17, padding: 12, flexDirection: 'row', alignItems: 'center', gap: 11, marginBottom: 20 },
  drawerAvatar: { width: 54, height: 54, borderRadius: 17, backgroundColor: '#7657E8' },
  drawerAvatarFallback: { alignItems: 'center', justifyContent: 'center' },
  drawerAvatarInitials: { color: '#FFFFFF', fontSize: 19, fontWeight: '900' },
  drawerProfileCopy: { flex: 1, minWidth: 0, gap: 3 },
  drawerUserName: { fontSize: 14, fontWeight: '900' },
  drawerUsername: { fontSize: 10, fontWeight: '600' },
  drawerStats: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 3 },
  drawerStatText: { color: '#A995FF', fontSize: 9, fontWeight: '900' },
  drawerStatDivider: { color: '#8A839C', fontSize: 10 },
  drawerScroll: { flex: 1 },
  drawerScrollContent: { paddingBottom: 16, gap: 8 },
  drawerSectionLabel: { fontSize: 9, fontWeight: '900', letterSpacing: 1.5, marginTop: 7, marginBottom: 3 },
  drawerItem: { minHeight: 66, borderRadius: 13, paddingHorizontal: 10, paddingVertical: 9, flexDirection: 'row', alignItems: 'center', gap: 10 },
  drawerItemIcon: { width: 37, height: 37, borderRadius: 11, alignItems: 'center', justifyContent: 'center' },
  drawerItemCopy: { flex: 1, minWidth: 0, gap: 3 },
  drawerItemTitle: { fontSize: 11, fontWeight: '900' },
  drawerItemDetail: { fontSize: 9, lineHeight: 13 },
  drawerCompactItem: { minHeight: 45, flexDirection: 'row', alignItems: 'center', gap: 12, borderBottomWidth: StyleSheet.hairlineWidth, paddingHorizontal: 4 },
  drawerCompactTitle: { flex: 1, fontSize: 11, fontWeight: '700' },
  drawerFooter: { fontSize: 9, textAlign: 'center', paddingVertical: 8 },
  homeHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 19 },
  homeBrand: { flexDirection: 'row', alignItems: 'center', gap: 11, flex: 1 },
  homeBrandIcon: { width: 42, height: 42, borderRadius: 13, backgroundColor: '#5865F2', alignItems: 'center', justifyContent: 'center' },
  homeBrandLetter: { color: '#FFFFFF', fontSize: 23, fontWeight: '900' },
  homeBrandText: { flex: 1, minWidth: 0 },
  homeEyebrow: { fontSize: 9, fontWeight: '900', letterSpacing: 1.6 },
  homeGreeting: { fontSize: 18, fontWeight: '800', marginTop: 3 },
  homeProfileButton: { width: 40, height: 40, borderRadius: 12, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
  homeSearch: { minHeight: 46, borderRadius: 12, borderWidth: 1, paddingHorizontal: 12, flexDirection: 'row', alignItems: 'center', gap: 9, marginBottom: 22 },
  homeSearchInput: { flex: 1, minWidth: 0, paddingVertical: 10, fontSize: 12 },
  dailyHomeCard: { borderWidth: 1, borderRadius: 17, padding: 14, marginBottom: 21, overflow: 'hidden' },
  dailyHomeTop: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 13 },
  dailyHomeHeading: { flexDirection: 'row', alignItems: 'center', gap: 10, flex: 1 },
  dailyHomeIcon: { width: 34, height: 34, borderRadius: 11, backgroundColor: '#7862D8', alignItems: 'center', justifyContent: 'center' },
  dailyHomeTitle: { fontSize: 14, fontWeight: '900' },
  dailyHomeSubtitle: { fontSize: 10, lineHeight: 15, marginTop: 3 },
  dailyTodayPill: { borderRadius: 7, backgroundColor: 'rgba(120,98,216,0.14)', paddingHorizontal: 8, paddingVertical: 5 },
  dailyTodayText: { color: '#A995FF', fontSize: 9, fontWeight: '900', letterSpacing: 0.8 },
  dailyLoading: { flexDirection: 'row', alignItems: 'center', gap: 9, paddingVertical: 12 },
  dailyTaskList: { gap: 13 },
  dailyTaskRow: { paddingTop: 11, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: 'rgba(140,130,170,0.2)' },
  dailyTaskMain: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  dailyTaskCheck: { width: 25, height: 25, borderRadius: 9, borderWidth: 1, borderColor: 'rgba(160,150,190,0.45)', alignItems: 'center', justifyContent: 'center' },
  dailyTaskCheckDone: { backgroundColor: '#27B98A', borderColor: '#27B98A' },
  dailyTaskCopy: { flex: 1, minWidth: 0 },
  dailyTaskName: { fontSize: 11, fontWeight: '800' },
  dailyTaskDescription: { fontSize: 9, lineHeight: 13, marginTop: 3 },
  dailyRewardPill: { backgroundColor: 'rgba(39,185,138,0.13)', borderRadius: 7, paddingHorizontal: 7, paddingVertical: 5 },
  dailyRewardText: { color: '#27B98A', fontSize: 9, fontWeight: '900' },
  dailyProgressLine: { flexDirection: 'row', alignItems: 'center', gap: 8, marginLeft: 33, marginTop: 8 },
  dailyProgressTrack: { flex: 1, height: 5, borderRadius: 9, overflow: 'hidden' },
  dailyProgressFill: { height: 5, borderRadius: 9, backgroundColor: '#8B73E6' },
  dailyProgressText: { fontSize: 9, fontWeight: '800', minWidth: 27, textAlign: 'right' },
  dailyClaimButton: { alignSelf: 'flex-start', marginLeft: 33, marginTop: 8, minHeight: 29, borderRadius: 8, backgroundColor: '#7862D8', paddingHorizontal: 10, flexDirection: 'row', alignItems: 'center', gap: 6 },
  dailyClaimText: { color: '#FFFFFF', fontSize: 9, fontWeight: '900' },
  dailyClaimedText: { color: '#27B98A', fontSize: 9, fontWeight: '800', marginLeft: 33, marginTop: 7 },
  dailyHomeFooter: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 13, paddingTop: 10, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: 'rgba(140,130,170,0.2)' },
  dailyHomeFooterText: { fontSize: 9, flex: 1 },
  homeSectionHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 11 },
  homeSectionTitle: { fontSize: 10, fontWeight: '900', letterSpacing: 1.1 },
  homeXpChip: { flexDirection: 'row', alignItems: 'center', gap: 5, backgroundColor: 'rgba(245,196,81,0.12)', borderRadius: 7, paddingHorizontal: 8, paddingVertical: 5 },
  homeXpText: { color: '#F5C451', fontSize: 10, fontWeight: '900' },
  homeFeatureGrid: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between', rowGap: 10 },
  homeFeatureCard: { width: '48.5%', minHeight: 128, borderRadius: 13, borderWidth: 1, padding: 12, position: 'relative' },
  homeFeaturePressed: { opacity: 0.72, transform: [{ scale: 0.985 }] },
  homeFeatureIcon: { width: 34, height: 34, borderRadius: 10, alignItems: 'center', justifyContent: 'center', marginBottom: 10 },
  homeFeatureTitle: { fontSize: 12, fontWeight: '800' },
  homeFeatureDescription: { fontSize: 10, lineHeight: 14, marginTop: 4, paddingRight: 5 },
  homeFeatureArrow: { position: 'absolute', right: 10, top: 11, opacity: 0.7 },
  homeFeatureCopy: { flex: 1, minWidth: 0 },
  homeSearchResults: { gap: 8, marginBottom: 20 },
  homeSearchRow: { minHeight: 61, borderRadius: 12, borderWidth: 1, paddingHorizontal: 10, paddingVertical: 8, flexDirection: 'row', alignItems: 'center', gap: 10 },
  homeSearchIcon: { width: 36, height: 36, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  homeSearchGlyph: { color: '#AAB7FF', fontSize: 19, fontWeight: '700' },
  homeEmpty: { fontSize: 12, paddingVertical: 20, textAlign: 'center' },
  homeFooterText: { textAlign: 'center', fontSize: 10, marginTop: 18, marginBottom: 10 },
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
