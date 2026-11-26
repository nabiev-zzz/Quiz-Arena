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

import LearnScreen from './src/screens/LearnScreen';
import DocumentQuizScreen from './src/screens/DocumentQuizScreen';
import SmartPracticeScreen from './src/screens/SmartPracticeScreen';
import QuizScreen from './src/screens/QuizScreen';
import AiTutorScreen from './src/screens/AiTutorScreen';
import ProfileScreen from './src/screens/ProfileScreen';
import ShopScreen from './src/screens/ShopScreen';
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
  const [homeClaimingTaskId, setHomeClaimingTaskId] = useState<string | null>(null);

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

  const handleHomeTaskClaim = async (task: DailyTask) => {
    if (!task.completed || task.claimed || homeClaimingTaskId) return;
    setHomeClaimingTaskId(task.id);
    try {
      await claimDailyTask(task.id);
      await Promise.all([loadHomeDailyTasks(), refreshUser()]);
      Alert.alert('Mukofot olindi!', `Hisobingizga ${task.reward} ZC qo‘shildi.`);
    } catch (error) {
      Alert.alert('Xatolik', error instanceof Error ? error.message : 'Mukofotni olish amalga oshmadi.');
    } finally {
      setHomeClaimingTaskId(null);
    }
  };

  const [tab, setTab] = useState<Tab>('home');
  const [authScreen, setAuthScreen] = useState<'login' | 'register'>('login');
  const [selectedSubject, setSelectedSubject] = useState<Subject | null>(null);
  const [selectedTopic, setSelectedTopic] = useState<Topic | null>(null);
  const [showSettings, setShowSettings] = useState(false);
  const [showPremium, setShowPremium] = useState(false);
  const [showDocumentQuiz, setShowDocumentQuiz] = useState(false);
  const [showSmartPractice, setShowSmartPractice] = useState(false);
  const [showShop, setShowShop] = useState(false);
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

  const backgroundColor = tokens.colors.background;
  const textColor = tokens.colors.text;
  const mutedColor = tokens.colors.textMuted;
  const borderColor = tokens.colors.glassBorder;

  const openTab = (nextTab: Tab) => {
    setTab(nextTab);
    setShowSettings(false);
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

        <Animated.View entering={FadeInDown.duration(480)} style={[styles.dailyHomeCard, { backgroundColor: tokens.colors.surface, borderColor }]}>
          <View style={styles.dailyHomeTop}>
            <View style={styles.dailyHomeHeading}>
              <View style={styles.dailyHomeIcon}><Ionicons name="flash" size={17} color="#FFFFFF" /></View>
              <View style={{ flex: 1 }}>
                <LocalizedText style={[styles.dailyHomeTitle, { color: textColor }]}>Kunlik vazifalar</LocalizedText>
                <LocalizedText style={[styles.dailyHomeSubtitle, { color: mutedColor }]}>Har kuni yangi maqsadlar va ZC mukofotlari</LocalizedText>
              </View>
            </View>
            <View style={styles.dailyTodayPill}><LocalizedText style={styles.dailyTodayText}>BUGUN</LocalizedText></View>
          </View>
          {homeDailyLoading && homeDailyTasks.length === 0 ? (
            <View style={styles.dailyLoading}><ActivityIndicator size="small" color={tokens.colors.primary} /><LocalizedText style={[styles.dailyHomeSubtitle, { color: mutedColor }]}>Vazifalar yuklanmoqda...</LocalizedText></View>
          ) : homeDailyTasks.length > 0 ? (
            <View style={styles.dailyTaskList}>
              {homeDailyTasks.map((task, index) => {
                const progress = Math.min(100, Math.round((task.progress / Math.max(1, task.target)) * 100));
                const readyToClaim = task.completed && !task.claimed;
                return (
                  <Animated.View key={task.id} entering={FadeInDown.delay(index * 90).duration(380)} style={styles.dailyTaskRow}>
                    <View style={styles.dailyTaskMain}>
                      <View style={[styles.dailyTaskCheck, task.completed && styles.dailyTaskCheckDone]}>
                        <Ionicons name={task.completed ? 'checkmark' : 'ellipse-outline'} size={15} color={task.completed ? '#FFFFFF' : mutedColor} />
                      </View>
                      <View style={styles.dailyTaskCopy}>
                        <LocalizedText style={[styles.dailyTaskName, { color: textColor }]}>{task.title}</LocalizedText>
                        <LocalizedText style={[styles.dailyTaskDescription, { color: mutedColor }]}>{task.description}</LocalizedText>
                      </View>
                      <View style={styles.dailyRewardPill}><LocalizedText style={styles.dailyRewardText}>+{task.reward} ZC</LocalizedText></View>
                    </View>
                    <View style={styles.dailyProgressLine}>
                      <View style={[styles.dailyProgressTrack, { backgroundColor: isDark ? 'rgba(255,255,255,0.09)' : '#E9E7F2' }]}>
                        <Animated.View style={[styles.dailyProgressFill, { width: `${progress}%` }]} />
                      </View>
                      <LocalizedText style={[styles.dailyProgressText, { color: mutedColor }]}>{Math.min(task.progress, task.target)}/{task.target}</LocalizedText>
                    </View>
                    {readyToClaim ? (
                      <Pressable disabled={homeClaimingTaskId !== null} onPress={() => void handleHomeTaskClaim(task)} style={({ pressed }) => [styles.dailyClaimButton, pressed && { opacity: 0.78 }]}>
                        <LocalizedText style={styles.dailyClaimText}>{homeClaimingTaskId === task.id ? 'Olinmoqda...' : 'Mukofotni olish'}</LocalizedText>
                        <Ionicons name="gift-outline" size={14} color="#FFFFFF" />
                      </Pressable>
                    ) : task.claimed ? (
                      <LocalizedText style={styles.dailyClaimedText}>Mukofot olindi ✓</LocalizedText>
                    ) : null}
                  </Animated.View>
                );
              })}
            </View>
          ) : (
            <LocalizedText style={[styles.dailyHomeSubtitle, { color: mutedColor }]}>Kunlik vazifalarni ko‘rish uchun keyinroq qayta urinib ko‘ring.</LocalizedText>
          )}
          <View style={styles.dailyHomeFooter}>
            <Ionicons name="refresh-circle-outline" size={15} color={mutedColor} />
            <LocalizedText style={[styles.dailyHomeFooterText, { color: mutedColor }]}>Vazifalar Toshkent vaqti bilan har kuni 00:00 da yangilanadi</LocalizedText>
          </View>
        </Animated.View>

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
                <Vie