import { LocalizedText, LocalizedTextInput, showLocalizedAlert } from '../i18n/LocalizedText';

import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Ionicons } from '@expo/vector-icons';
import Animated, {
  useAnimatedScrollHandler,
  useSharedValue,
  withSpring,
  type SharedValue,
} from 'react-native-reanimated';
import {
  ActivityIndicator,
  Alert,
  Pressable,
  Share,
  StyleSheet,
  TextInput,
  View,
} from 'react-native';

import { useAuth } from '../context/AuthContext';
import { subjects } from '../data/subjects';
import { getLearningStats, type LearningStats } from '../services/learningService';
import { consumePremiumFeature } from '../services/subscriptionService';
import { shareStatisticsPdf } from '../services/statisticsReportService';
import LeaderboardScreen from './leaderboard/LeaderboardScreen';

import {
  BattleFinished,
  BattleHistoryItem,
  BattleHistoryDetail,
  BattleLeaderboardEntry,
  BattleMatched,
  BattleMode,
  BattleQuestion,
  BattleQuestionResult,
  BattleScores,
  BattleSocket,
  BattleStarted,
  BattleStats,
  createBattleSocket,
  getBattleHistory,
  getBattleHistoryDetail,
  getBattleLeaderboard,
  getBattleStats,
} from '../services/battleService';

type Section = 'battle' | 'history' | 'stats' | 'leaderboard';
type StatsView = 'overview' | 'battle' | 'education';

interface BattleScreenProps {
  isDark?: boolean;
  onBack?: () => void;
  initialSection?: Section;
  dockStretch?: SharedValue<number>;
}

const COLORS = {
  background: '#F3F5FC',
  card: '#FFFFFF',
  text: '#172033',
  muted: '#748096',
  primary: '#6558E8',
  border: '#E5E8F0',
  success: '#159B68',
  danger: '#DC4C64',
};

export default function BattleScreen({
  isDark = false,
  onBack,
  initialSection = 'battle',
  dockStretch,
}: BattleScreenProps) {
  const { user, refreshUser } = useAuth();

  const [section, setSection] = useState<Section>(initialSection);
  const [mode, setMode] = useState<BattleMode>('casual');

  const [connected, setConnected] = useState(false);
  const [connecting, setConnecting] = useState(false);
  const [searching, setSearching] = useState(false);
  const [privateRoomCode, setPrivateRoomCode] = useState<string | null>(null);
  const [privateJoinCode, setPrivateJoinCode] = useState('');
  const [creatingPrivate, setCreatingPrivate] = useState(false);

  const [match, setMatch] = useState<BattleMatched | null>(null);
  const [started, setStarted] = useState<BattleStarted | null>(null);
  const [question, setQuestion] = useState<BattleQuestion | null>(null);

  const [selectedAnswer, setSelectedAnswer] = useState<number | null>(null);
  const [answerAccepted, setAnswerAccepted] = useState(false);
  const [readyForNext, setReadyForNext] = useState(false);
  const [readyCount, setReadyCount] = useState(0);

  const [result, setResult] = useState<BattleQuestionResult | null>(null);
  const [finished, setFinished] = useState<BattleFinished | null>(null);

  const [scores, setScores] = useState<BattleScores>({});
  const [remaining, setRemaining] = useState(20);
  const [error, setError] = useState('');

  const [history, setHistory] = useState<BattleHistoryItem[]>([]);
  const [historyFilter, setHistoryFilter] = useState<'all' | 'win' | 'loss' | 'draw' | 'ranked' | 'casual'>('all');
  const [historySearch, setHistorySearch] = useState('');
  const [historyDetail, setHistoryDetail] = useState<BattleHistoryDetail | null>(null);
  const [historyDetailLoading, setHistoryDetailLoading] = useState<string | null>(null);
  const [stats, setStats] = useState<BattleStats | null>(null);
  const [learningStats, setLearningStats] = useState<LearningStats | null>(null);
  const [statsView, setStatsView] = useState<StatsView>('overview');
  const [leaderboard, setLeaderboard] = useState<BattleLeaderboardEntry[]>([]);
  const [loadingData, setLoadingData] = useState(false);
  const [exportingPdf, setExportingPdf] = useState(false);

  const socketRef = useRef<BattleSocket | null>(null);
  const matchIdRef = useRef<string | null>(null);
  const modeRef = useRef<BattleMode>('casual');
  const questionIndexRef = useRef<number | null>(null);
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
        dockStretch.value = withSpring(0, { damping: 11, stiffness: 160, mass: 0.7 });
      }
    },
    onMomentumEnd: () => {
      if (dockStretch) {
        dockStretch.value = withSpring(0, { damping: 11, stiffness: 160, mass: 0.7 });
      }
    },
  });

  const dark = isDark;

  const colors = {
    background: dark ? '#0B1020' : '#F1F2FA',
    card: dark ? '#171E31' : 'rgba(255,255,255,0.86)',
    text: dark ? '#F3F5FC' : COLORS.text,
    muted: dark ? '#A1ABC0' : COLORS.muted,
    primary: '#7568F5',
    border: dark ? 'rgba(164,176,215,0.18)' : 'rgba(117,104,245,0.14)',
    success: COLORS.success,
    danger: COLORS.danger,
  };

  const styles = makeStyles(colors, dark);

  const clearMatchState = useCallback(() => {
    matchIdRef.current = null;
    questionIndexRef.current = null;
    setMatch(null);
    setStarted(null);
    setQuestion(null);
    setSelectedAnswer(null);
    setAnswerAccepted(false);
    setReadyForNext(false);
    setReadyCount(0);
    setResult(null);
    setFinished(null);
    setScores({});
    setRemaining(20);
  }, []);

  const exportStatisticsPdf = async () => {
    if (!stats && !learningStats) {
      showLocalizedAlert('Statistika mavjud emas', 'Avval statistika ma’lumotlarini yuklang.');
      return;
    }

    setExportingPdf(true);
    try {
      const usage = await consumePremiumFeature('statsPdf');
      if (!usage.allowed) {
        showLocalizedAlert(
          'PDF limiti tugadi',
          `Sizning ${usage.tier.toUpperCase().replace('_', ' ')} tarifingizda bu davr uchun PDF hisobot limiti tugagan. Ko‘proq hisobot uchun tarifni yangilang.`,
        );
        return;
      }

      await shareStatisticsPdf({
        user: {
          displayName: user?.displayName,
          username: user?.username,
          level: user?.level,
          xp: user?.xp,
          rankPoints: user?.rankPoints,
        },
        learning: learningStats,
        battle: stats,
        tier: usage.tier,
      });
    } catch (err) {
      showLocalizedAlert(
        'PDF yaratilmadi',
        err instanceof Error ? err.message : 'Hisobotni yaratish yoki ulashishda xatolik yuz berdi.',
      );
    } finally {
      setExportingPdf(false);
    }
  };

  const loadSectionData = useCallback(async (target: Section) => {
    if (target === 'battle') return;

    setLoadingData(true);
    setError('');

    try {
      if (target === 'history') {
        const data = await getBattleHistory(50);
        setHistory(Array.isArray(data.matches) ? data.matches : []);
      } else if (target === 'stats') {
        const [battleResult, learningResult] = await Promise.allSettled([
          getBattleStats(),
          getLearningStats(),
        ]);

        if (battleResult.status === 'fulfilled') {
          setStats(battleResult.value);
        }
        if (learningResult.status === 'fulfilled') {
          setLearningStats(learningResult.value);
        }
        if (
          battleResult.status === 'rejected' &&
          learningResult.status === 'rejected'
        ) {
          throw new Error('Statistikani yuklab bo‘lmadi. Internet aloqasini tekshiring.');
        }
      } else if (target === 'leaderboard') {
        const data = await getBattleLeaderboard(50);
        setLeaderboard(Array.isArray(data) ? data : []);
      }
    } catch (err) {
      setError(
        err instanceof Error ? err.message : 'Ma’lumotlarni olishda xato.',
      );
    } finally {
      setLoadingData(false);
    }
  }, []);

  useEffect(() => {
    let disposed = false;

    async function connect() {
      setConnecting(true);
      setError('');

      try {
        const socket = await createBattleSocket();

        if (disposed) {
          socket.disconnect();
          return;
        }

        socketRef.current = socket;

        socket.on('connect', () => {
          setConnected(true);
          setConnecting(false);
          setError('');

          const activeMatchId = matchIdRef.current;
          if (activeMatchId) {
            socket.emit('battle:reconnect', {
              matchId: activeMatchId,
            });
          }
        });

        socket.on('disconnect', () => {
          setConnected(false);
          setPrivateRoomCode(null);
          setCreatingPrivate(false);
        });

        socket.on('connect_error', (err: Error) => {
          setConnected(false);
          setConnecting(false);
          setError(`Serverga ulanishda xato: ${err.message}`);
        });

        socket.on('battle:connected', () => {
          se