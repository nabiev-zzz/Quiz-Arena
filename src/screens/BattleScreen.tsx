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
  Text as NativeText,
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
        const data = await getBattleHistory(30);
        setHistory(Array.isArray(data) ? data : []);
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
        err instanceof Error ? err.message : 'MaвЂ™lumotlarni olishda xato.',
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
          setConnected(true);
          setConnecting(false);
        });

        socket.on('battle:queue:waiting', () => {
          setSearching(true);
          setError('');
        });

        socket.on('battle:queue:cancelled', () => {
          setSearching(false);
        });

        socket.on('battle:private:created', (data: { roomCode: string }) => {
          setPrivateRoomCode(data.roomCode);
          setCreatingPrivate(false);
          setSearching(false);
          setError('');
        });

        socket.on('battle:private:cancelled', () => setPrivateRoomCode(null));
        socket.on('battle:private:expired', () => {
          setPrivateRoomCode(null);
          setError('Do‘stni kutish muddati tugadi. Yangi xona yarating.');
        });

        socket.on('battle:matched', (data: BattleMatched) => {
          matchIdRef.current = data.matchId;
          setMatch(data);
          setPrivateRoomCode(null);
          setSearching(false);
          setFinished(null);
          setError('');
        });

        socket.on('battle:started', (data: BattleStarted) => {
          matchIdRef.current = data.matchId;
          setStarted(data);
          setScores({});
          setQuestion(null);
          setReadyForNext(false);
          setReadyCount(0);
          setResult(null);
          setFinished(null);
        });

        socket.on('battle:question', (data: BattleQuestion & {
          alreadyReady?: boolean;
          readyPlayerIds?: string[];
        }) => {
          matchIdRef.current = data.matchId;
          questionIndexRef.current = data.questionIndex;
          setQuestion(data);
          setSelectedAnswer(null);
          setAnswerAccepted(Boolean(data.alreadyAnswered));
          setReadyForNext(Boolean(data.alreadyReady));
          setReadyCount(Array.isArray(data.readyPlayerIds) ? data.readyPlayerIds.length : 0);
          setResult(null);

          const endTime = new Date(data.endsAt).getTime();
          const seconds = Math.max(
            0,
            Math.ceil((endTime - Date.now()) / 1000),
          );
          setRemaining(seconds);
        });

        socket.on('battle:answer:accepted', () => {
          setAnswerAccepted(true);
        });

        socket.on('battle:next:status', (data: {
          matchId?: string;
          questionIndex?: number;
          readyCount?: number;
          readyPlayerIds?: string[];
        }) => {
          if (
            (data.matchId && data.matchId !== matchIdRef.current) ||
            (Number.isInteger(data.questionIndex) &&
              data.questionIndex !== questionIndexRef.current)
          ) return;

          const count = typeof data.readyCount === 'number'
            ? data.readyCount
            : Array.isArray(data.readyPlayerIds)
              ? data.readyPlayerIds.length
              : 0;
          setReadyCount(count);
        });

        socket.on(
          'battle:question:result',
          (data: BattleQuestionResult) => {
            setResult(data);
            setScores(data.scores || {});
            setAnswerAccepted(true);
          },
        );

        socket.on('battle:finished', (data: BattleFinished) => {
          setFinished(data);
          setScores(data.scores || {});
          setQuestion(null);
          setReadyForNext(false);
          setReadyCount(0);
          setResult(null);
          setSearching(false);
          matchIdRef.current = null;
          questionIndexRef.current = null;

          void refreshUser().catch(() => undefined);
        });

        socket.on('battle:reconnected', (data: {
          connected: boolean;
          matchId: string;
          roomCode: string;
          scores: BattleScores;
          questionIndex: number;
          totalQuestions: number;
        }) => {
          setConnected(true);
          setScores(data.scores || {});
        });

        socket.on('battle:reconnect:failed', (data: {
          message?: string;
        }) => {
          setError(data.message || 'Battlega qayta ulanib boвЂlmadi.');
          clearMatchState();
        });

        socket.on('battle:cancelled', (data: {
          reason?: string;
        }) => {
          setError(data.reason || 'Battle bekor qilindi.');
          clearMatchState();
        });

        socket.on('battle:error', (data: { message?: string }) => {
          setError(data.message || 'Battle xatoligi yuz berdi.');
          setCreatingPrivate(false);
          setSearching(false);
        });
      } catch (err) {
        if (!disposed) {
          setError(
            err instanceof Error ? err.message : 'Socket ulanishida xato.',
          );
          setConnecting(false);
        }
      }
    }

    connect();

    return () => {
      disposed = true;
      socketRef.current?.removeAllListeners();
      socketRef.current?.disconnect();
      socketRef.current = null;
    };
  }, [clearMatchState]);

  useEffect(() => {
    if (!question || result || finished || answerAccepted) return;

    const timer = setInterval(() => {
      const endTime = new Date(question.endsAt).getTime();
      const seconds = Math.max(
        0,
        Math.ceil((endTime - Date.now()) / 1000),
      );
      setRemaining(seconds);
    }, 250);

    return () => clearInterval(timer);
  }, [question, result, finished, answerAccepted]);

  useEffect(() => {
    if (section !== 'battle') {
      loadSectionData(section);
    }
  }, [section, loadSectionData]);

  function joinQueue(selectedMode: BattleMode) {
    const socket = socketRef.current;

    if (!socket || !socket.connected) {
      setError('Serverga ulanish kutilmoqda. Birozdan soвЂng urinib koвЂring.');
      return;
    }

    if (searching || matchIdRef.current) return;

    modeRef.current = selectedMode;
    setMode(selectedMode);
    setError('');
    setSearching(true);

    socket.emit('battle:queue:join', {
      mode: selectedMode,
    });
  }

  function cancelQueue() {
    socketRef.current?.emit('battle:queue:cancel', {
      mode: modeRef.current,
    });
    setSearching(false);
  }

  function createPrivateBattleRoom() {
    const socket = socketRef.current;
    if (!socket?.connected) {
      setError('Battle serveriga ulanish kutilmoqda.');
      return;
    }
    if (searching || matchIdRef.current || creatingPrivate) return;
    setCreatingPrivate(true);
    setError('');
    socket.emit('battle:private:create');
  }

  function joinPrivateBattleRoom() {
    const socket = socketRef.current;
    const code = privateJoinCode.trim().toUpperCase();
    if (!socket?.connected) {
      setError('Battle serveriga ulanish kutilmoqda.');
      return;
    }
    if (!/^[A-F0-9]{12}$/.test(code)) {
      showLocalizedAlert('Xona kodi noto‘g‘ri', 'Do‘stingiz yuborgan 12 belgili kodni kiriting.');
      return;
    }
    if (searching || matchIdRef.current) return;
    setError('');
    socket.emit('battle:private:join', { roomCode: code });
  }

  function cancelPrivateBattleRoom() {
    if (!privateRoomCode) return;
    socketRef.current?.emit('battle:private:cancel', { roomCode: privateRoomCode });
    setPrivateRoomCode(null);
  }

  function sharePrivateBattleCode() {
    if (!privateRoomCode) return;
    void Share.share({
      message: `QUIZ ARENA'da sizni Battle'ga taklif qilaman! Ilovada Battle → Do‘st bilan o‘ynash bo‘limiga kiring va ushbu kodni kiriting: ${privateRoomCode}`,
    });
  }

  function submitAnswer(answerIndex: number) {
    if (!question || answerAccepted || result || remaining <= 0) return;

    const socket = socketRef.current;
    if (!socket?.connected) {
      setError('Server bilan aloqa uzildi.');
      return;
    }

    setSelectedAnswer(answerIndex);

    socket.emit('battle:answer', {
      matchId: question.matchId,
      questionIndex: question.questionIndex,
      answerIndex,
    });
  }

  function markReadyForNext() {
    if (!question || readyForNext) return;

    const socket = socketRef.current;
    if (!socket?.connected) {
      setError('Server bilan aloqa uzildi.');
      return;
    }

    setReadyForNext(true);
    socket.emit('battle:next:ready', {
      matchId: question.matchId,
      questionIndex: question.questionIndex,
    });
  }

  function cancelMatch() {
    const activeMatchId = matchIdRef.current;
    if (!activeMatchId) return;

    showLocalizedAlert(
      'Battle dan chiqish',
      'Haqiqatan ham joriy Battle ni bekor qilmoqchimisiz?',
      [
        { text: 'YoвЂq', style: 'cancel' },
        {
          text: 'Ha, chiqish',
          style: 'destructive',
          onPress: () => {
            socketRef.current?.emit('battle:match:cancel', {
              matchId: activeMatchId,
            });
          },
        },
      ],
    );
  }

  function returnToBattle() {
    clearMatchState();
    setError('');
    setSection('battle');
  }

  function getMyScore(): number {
    const values = Object.values(scores);
    return values.length ? Math.max(...values) : 0;
  }

  function renderBattle() {
    if (finished) {
      const myRankChange = user
        ? finished.rankChanges?.[user.id]
        : undefined;

      const title = finished.draw
        ? 'Durang!'
        : finished.winnerId
          ? 'Battle yakunlandi!'
          : 'Battle tugadi';

      return (
        <View style={styles.card}>
          <LocalizedText style={styles.resultEmoji}>
            {finished.draw ? 'рџ¤ќ' : 'рџЏ†'}
          </LocalizedText>
          <LocalizedText style={styles.cardTitle}>{title}</LocalizedText>
          <LocalizedText style={styles.muted}>Xona: {finished.roomCode}</LocalizedText>

          {myRankChange ? (
            <View style={styles.rankResultCard}>
              <LocalizedText style={styles.rankResultTitle}>
                RANK NATIJASI
              </LocalizedText>
              <LocalizedText style={[
                styles.rankResultDelta,
                { color: myRankChange.delta >= 0 ? '#22C55E' : '#F87171' },
              ]}>
                {myRankChange.delta > 0 ? '+' : ''}
                {myRankChange.delta} RP
              </LocalizedText>
              <LocalizedText style={styles.rankResultTier}>
                {myRankChange.rankTier} · {myRankChange.rankPoints} RP
              </LocalizedText>
            </View>
          ) : null}

          <LocalizedText style={styles.scoreTitle}>Yakuniy hisob</LocalizedText>
          {Object.entries(finished.scores || {}).map(([id, score]) => (
            <LocalizedText key={id} style={styles.scoreLine}>
              {match?.players.find((player) => player.id === id)?.username ||
                `OвЂyinchi ${id.slice(0, 6)}`}
              {' вЂ” '}
              {score} ball
            </LocalizedText>
          ))}

          <ActionButton
            title="Battle sahifasiga qaytish"
            onPress={returnToBattle}
            styles={styles}
          />
        </View>
      );
    }

    if (result) {
      const correct = selectedAnswer === result.correctAnswer;

      return (
        <View style={styles.card}>
          <LocalizedText style={styles.cardTitle}>
            {correct ? 'ToвЂgвЂri javob!' : 'Keyingi safar omad!'}
          </LocalizedText>
          <LocalizedText style={styles.muted}>
            ToвЂgвЂri javob: {result.correctAnswer + 1}-variant
          </LocalizedText>
          <LocalizedText style={styles.bodyText}>{result.explanation}</LocalizedText>

          <LocalizedText style={styles.scoreTitle}>Joriy hisob</LocalizedText>
          {Object.entries(result.scores || {}).map(([id, score]) => (
            <LocalizedText key={id} style={styles.scoreLine}>
              {match?.players.find((player) => player.id === id)?.username ||
                `OвЂyinchi ${id.slice(0, 6)}`}
              {' вЂ” '}
              {score} ball
            </LocalizedText>
          ))}
          {readyForNext ? (
            <LocalizedText style={styles.muted}>
              {readyCount >= 2
                ? "Ikkala o‘yinchi tayyor. Keyingi savol yuklanmoqda..."
                : "Siz tayyorsiz. Raqib kutilmoqda..."}
            </LocalizedText>
          ) : (
            <ActionButton
              title="Keyingi savol"
              onPress={markReadyForNext}
              styles={styles}
            />
          )}
          <LocalizedText style={styles.muted}>
            Tayyor o'yinchilar: {readyCount}/2
          </LocalizedText>
        </View>
      );
    }

    if (question) {
      return (
        <View style={styles.card}>
          <LocalizedText style={styles.muted}>
            Savol {question.questionIndex + 1} / {question.totalQuestions}
          </LocalizedText>

          <LocalizedText style={styles.timer}>
            {remaining} soniya
          </LocalizedText>

          <LocalizedText style={styles.questionText}>{question.question}</LocalizedText>

          {question.options.map((option, index) => {
            const selected = selectedAnswer === index;

            return (
              <Pressable
                key={`${question.questionId}-${index}`}
                disabled={answerAccepted || remaining <= 0}
                onPress={() => submitAnswer(index)}
                style={[
                  styles.option,
                  selected && styles.selectedOption,
                  (answerAccepted || remaining <= 0) &&
                    styles.disabledOption,
                ]}
              >
                <LocalizedText style={styles.optionLetter}>
                  {String.fromCharCode(65 + index)}.
                </LocalizedText>
                <LocalizedText style={styles.optionText}>{option}</LocalizedText>
                {selected ? (
                  <LocalizedText style={styles.optionLetter}>вњ“</LocalizedText>
                ) : null}
              </Pressable>
            );
          })}

          {answerAccepted ? (
            <LocalizedText style={styles.muted}>Javobingiz qabul qilindi.</LocalizedText>
          ) : remaining <= 0 ? (
            <LocalizedText style={styles.dangerText}>Vaqt tugadi.</LocalizedText>
          ) : null}

          {(answerAccepted || remaining <= 0) ? (
            readyForNext ? (
              <LocalizedText style={styles.muted}>
                {readyCount >= 2
                  ? "Ikkala o‘yinchi tayyor. Keyingi savol yuklanmoqda..."
                  : "Siz tayyorsiz. Raqib javob berishi yoki vaqt tugashini kuting."}
              </LocalizedText>
            ) : (
              <ActionButton
                title="Keyingi savol"
                onPress={markReadyForNext}
                styles={styles}
              />
            )
          ) : null}
        </View>
      );
    }

    if (started || match) {
      return (
        <View style={styles.card}>
          <LocalizedText style={styles.resultEmoji}>вљ”пёЏ</LocalizedText>
          <LocalizedText style={styles.cardTitle}>
            {started ? 'Battle boshlandi!' : 'Raqib topildi!'}
          </LocalizedText>

          <LocalizedText style={styles.muted}>
            Xona: {started?.roomCode || match?.roomCode}
          </LocalizedText>

          {(started?.players || match?.players || []).map((player) => (
            <LocalizedText key={player.id} style={styles.scoreLine}>
              {player.username}
            </LocalizedText>
          ))}

          <ActivityIndicator
            size="large"
            color={colors.primary}
            style={{ marginTop: 20 }}
          />
          <LocalizedText style={styles.muted}>Savol kutilmoqda...</LocalizedText>

          <ActionButton
            title="Battle dan chiqish"
            onPress={cancelMatch}
            styles={styles}
            danger
          />
        </View>
      );
    }

    if (searching) {
      return (
        <View style={styles.card}>
          <ActivityIndicator size="large" color={colors.primary} />
          <LocalizedText style={styles.cardTitle}>Raqib qidirilmoqda...</LocalizedText>
          <LocalizedText style={styles.muted}>
            {mode === 'ranked' ? 'Ranked rejimi' : 'Casual rejimi'}
          </LocalizedText>
          <ActionButton
            title="Qidirishni bekor qilish"
            onPress={cancelQueue}
            styles={styles}
            danger
          />
        </View>
      );
    }

    const recentMatches = Array.isArray(stats?.recentMatches)
      ? stats.recentMatches as Array<{
          id: string;
          mode: string;
          result: 'win' | 'loss' | 'draw';
          myScore: number;
          finishedAt: string | null;
        }>
      : [];
    const latestMatch = recentMatches[0];
    const canStart = connected && !connecting;

    return (
      <View style={styles.homeContent}>
        <View style={styles.battleHero}>
          <View pointerEvents="none" style={styles.heroGlowTop} />
          <View pointerEvents="none" style={styles.heroGlowBottom} />
          <View style={styles.heroTopLine}>
            <View style={styles.heroBadge}>
              <Ionicons name="flash" size={13} color="#FFFFFF" />
              <LocalizedText style={styles.heroBadgeText}>BATTLE ARENA</LocalizedText>
            </View>
            <View style={styles.heroLive}>
              <View style={[styles.liveDot, { backgroundColor: connected ? '#35E6A0' : '#F6B94A' }]} />
              <LocalizedText style={styles.heroLiveText}>{connected ? 'ONLINE' : 'CONNECTING'}</LocalizedText>
            </View>
          </View>
          <View style={styles.heroArtwork}>
            <View style={styles.trophyHalo}>
              <Ionicons name="trophy" size={62} color="#FFC85A" />
            </View>
            <View style={styles.heroCrossedSwords}>
              <Ionicons name="flash" size={27} color="#C9B8FF" />
            </View>
          </View>
          <LocalizedText style={styles.heroTitle}>Bilim janglari</LocalizedText>
          <LocalizedText style={styles.heroSubtitle}>
            Eng kuchli raqib bilan bilimingizni sinang. Har bir savolda 20 soniya!
          </LocalizedText>
          <Pressable
            onPress={() => joinQueue('casual')}
            disabled={!canStart}
            style={[styles.heroPlayButton, !canStart && styles.disabledButton]}
          >
            <Ionicons name="play" size={19} color="#FFFFFF" />
            <LocalizedText style={styles.heroPlayText}>Raqib topish</LocalizedText>
            <Ionicons name="arrow-forward" size={18} color="#FFFFFF" />
          </Pressable>
        </View>

        <View style={styles.sectionHeading}>
          <View style={styles.sectionHeadingLeft}>
            <Ionicons name="flash" size={21} color="#FFC84A" />
            <LocalizedText style={styles.sectionHeadingTitle}>O‘yin rejimlari</LocalizedText>
          </View>
          <LocalizedText style={styles.sectionHeadingHint}>1 ga 1</LocalizedText>
        </View>

        <View style={styles.modeGrid}>
          <Pressable
            onPress={() => joinQueue('casual')}
            disabled={!canStart}
            style={[styles.modeCard, styles.casualMode]}
          >
            <View style={styles.modeIconBlue}>
              <Ionicons name="stopwatch" size={31} color="#70BFFF" />
            </View>
            <LocalizedText style={styles.modeTitle}>Tez jang</LocalizedText>
            <LocalizedText style={styles.modeSubtitle}>Oddiy o‘yin</LocalizedText>
            <View style={styles.modeBottom}>
              <LocalizedText style={styles.modeMeta}>20 soniya / savol</LocalizedText>
              <Ionicons name="arrow-forward-circle" size={27} color="#A9BFFF" />
            </View>
          </Pressable>

          <Pressable
            onPress={() => joinQueue('ranked')}
            disabled={!canStart}
            style={[styles.modeCard, styles.rankedMode]}
          >
            <View style={styles.modeIconGold}>
              <Ionicons name="trophy" size={31} color="#FFC85A" />
            </View>
            <LocalizedText style={styles.modeTitle}>Ranked</LocalizedText>
            <LocalizedText style={styles.modeSubtitle}>Reyting uchun</LocalizedText>
            <View style={styles.modeBottom}>
              <LocalizedText style={styles.modeMeta}>Rank ochkolari</LocalizedText>
              <Ionicons name="arrow-forward-circle" size={27} color="#F7C46B" />
            </View>
          </Pressable>
        </View>

        <View style={styles.privateBattleCard}>
          <View style={styles.privateBattleHeading}>
            <View style={styles.privateBattleIcon}><Ionicons name="people" size={20} color="#FFFFFF" /></View>
            <View style={styles.privateBattleCopy}>
              <LocalizedText style={styles.privateBattleTitle}>Do‘st bilan o‘ynash</LocalizedText>
              <LocalizedText style={styles.privateBattleDescription}>Xususiy xona yarating yoki do‘stingiz kodiga qo‘shiling · 1 ga 1</LocalizedText>
            </View>
          </View>
          {privateRoomCode ? (
            <View style={styles.privateRoomBox}>
              <LocalizedText style={styles.privateRoomLabel}>DO‘STINGIZGA YUBORILADIGAN KOD</LocalizedText>
              <LocalizedText style={styles.privateRoomCode}>{privateRoomCode}</LocalizedText>
              <LocalizedText style={styles.privateBattleDescription}>Xona 10 daqiqa davomida faol bo‘ladi.</LocalizedText>
              <View style={styles.privateRoomActions}>
                <Pressable onPress={sharePrivateBattleCode} style={styles.privateShareButton}>
                  <Ionicons name="share-social-outline" size={16} color="#FFFFFF" />
                  <LocalizedText style={styles.privateShareText}>Kodni ulashish</LocalizedText>
                </Pressable>
                <Pressable onPress={cancelPrivateBattleRoom} style={styles.privateCancelButton}>
                  <LocalizedText style={styles.privateCancelText}>Bekor qilish</LocalizedText>
                </Pressable>
              </View>
            </View>
          ) : (
            <>
              <Pressable onPress={createPrivateBattleRoom} disabled={!canStart || creatingPrivate || searching} style={[styles.privateCreateButton, (!canStart || creatingPrivate || searching) && styles.disabledButton]}>
                {creatingPrivate ? <ActivityIndicator size="small" color="#FFFFFF" /> : <Ionicons name="add-circle-outline" size={18} color="#FFFFFF" />}
                <LocalizedText style={styles.privateCreateText}>{creatingPrivate ? 'Xona yaratilmoqda...' : 'Xususiy xona yaratish'}</LocalizedText>
              </Pressable>
              <View style={styles.privateJoinRow}>
                <LocalizedTextInput
                  value={privateJoinCode}
                  onChangeText={(value) => setPrivateJoinCode(value.toUpperCase().replace(/[^A-F0-9]/g, '').slice(0, 12))}
                  placeholder="12 belgili xona kodi"
                  placeholderTextColor={colors.muted}
                  autoCapitalize="characters"
                  autoCorrect={false}
                  maxLength={12}
                  style={styles.privateCodeInput}
                />
                <Pressable onPress={joinPrivateBattleRoom} disabled={!canStart || searching || privateJoinCode.length !== 12} style={[styles.privateJoinButton, (!canStart || searching || privateJoinCode.length !== 8) && styles.disabledButton]}>
                  <LocalizedText style={styles.privateJoinText}>Qo‘shilish</LocalizedText>
                </Pressable>
              </View>
            </>
          )}
        </View>

        {stats ? (
          <View style={styles.quickStatsCard}>
            <View style={styles.quickStatsHeader}>
              <View style={styles.sectionHeadingLeft}>
                <Ionicons name="stats-chart" size={19} color="#A99BFF" />
                <LocalizedText style={styles.quickStatsTitle}>Sizning statistikangiz</LocalizedText>
              </View>
              <Pressable onPress={() => setSection('stats')}>
                <LocalizedText style={styles.quickStatsLink}>Batafsil ›</LocalizedText>
              </Pressable>
            </View>
            <View style={styles.quickStatsRow}>
              <View style={styles.quickStatItem}>
                <LocalizedText style={styles.quickStatValue}>{Math.round(Number(stats.winRate) || 0)}%</LocalizedText>
                <LocalizedText style={styles.quickStatLabel}>G‘alaba</LocalizedText>
              </View>
              <View style={styles.quickStatDivider} />
              <View style={styles.quickStatItem}>
                <LocalizedText style={styles.quickStatValue}>{stats.wins}</LocalizedText>
                <LocalizedText style={styles.quickStatLabel}>Yutuqlar</LocalizedText>
              </View>
              <View style={styles.quickStatDivider} />
              <View style={styles.quickStatItem}>
                <LocalizedText style={styles.quickStatValue}>{stats.totalMatches}</LocalizedText>
                <LocalizedText style={styles.quickStatLabel}>O‘yinlar</LocalizedText>
              </View>
            </View>
          </View>
        ) : null}

        {latestMatch ? (
          <View style={styles.latestMatchCard}>
            <View style={styles.quickStatsHeader}>
              <View style={styles.sectionHeadingLeft}>
                <Ionicons name="trophy" size={18} color="#FFC85A" />
                <LocalizedText style={styles.quickStatsTitle}>Oxirgi jang</LocalizedText>
              </View>
              <Pressable onPress={() => setSection('history')}>
                <LocalizedText style={styles.quickStatsLink}>Tarix ›</LocalizedText>
              </Pressable>
            </View>
            <View style={styles.latestMatchRow}>
              <View style={styles.latestMatchAvatar}>
                <Ionicons name="person" size={21} color="#D7CCFF" />
              </View>
              <View style={styles.latestMatchCopy}>
                <LocalizedText style={styles.latestMatchName}>1 ga 1 Battle</LocalizedText>
                <LocalizedText style={styles.modeMeta}>{latestMatch.mode === 'private' ? 'Do‘stlar Battle' : latestMatch.mode === 'ranked' ? 'Ranked' : 'Casual'}</LocalizedText>
              </View>
              <LocalizedText style={[styles.latestMatchResult, { color: latestMatch.result === 'win' ? '#35D99A' : latestMatch.result === 'loss' ? '#FF7D91' : '#AEB8D0' }]}>
                {latestMatch.result === 'win' ? 'G‘alaba' : latestMatch.result === 'loss' ? 'Mag‘lubiyat' : 'Durang'}
              </LocalizedText>
            </View>
          </View>
        ) : null}

        <View style={styles.connectionNote}>
          <View style={[styles.liveDot, { backgroundColor: connected ? '#35D99A' : '#F6B94A' }]} />
          <LocalizedText style={styles.connectionNoteText}>
            {connecting ? 'Battle serveriga ulanmoqda…' : connected ? 'Battle serveriga ulangan' : 'Server bilan aloqa kutilmoqda'}
          </LocalizedText>
        </View>
      </View>
    );
  }

  function renderHistory() {
    if (loadingData) {
      return <ActivityIndicator color={colors.primary} />;
    }

    if (!history.length) {
      return <LocalizedText style={styles.muted}>Battle tarixi hozircha yoвЂq.</LocalizedText>;
    }

    return history.map((item) => (
      <View key={item.id} style={styles.listCard}>
        <LocalizedText style={styles.cardTitle}>
          {item.mode === 'private' ? 'Do‘stlar Battle' : item.mode === 'ranked' ? 'Ranked' : 'Casual'} · {item.roomCode}
        </LocalizedText>
        <LocalizedText style={styles.muted}>
          Holati: {item.status} · {new Date(item.createdAt).toLocaleString()}
        </LocalizedText>
        <LocalizedText style={styles.bodyText}>
          {item.winnerId ? `GвЂolib ID: ${item.winnerId}` : 'GвЂolib: aniqlanmagan'}
        </LocalizedText>
      </View>
    ));
  }

  function renderBattleStats() {
    if (loadingData && !stats) {
      return (
        <View style={styles.statsLoading}>
          <ActivityIndicator color={colors.primary} size="large" />
          <LocalizedText style={styles.muted}>Natijalaringiz yuklanmoqda...</LocalizedText>
        </View>
      );
    }

    if (!stats) {
      return (
        <View style={styles.emptyStats}>
          <View style={styles.emptyStatsIcon}>
            <Ionicons name="analytics-outline" size={30} color={colors.primary} />
          </View>
          <LocalizedText style={styles.cardTitle}>Statistika hozircha yo‘q</LocalizedText>
          <LocalizedText style={styles.muted}>
            Birinchi Battle o‘yinini yakunlaganingizdan so‘ng natijalaringiz shu yerda ko‘rinadi.
          </LocalizedText>
          <ActionButton
            title="Qayta yuklash"
            onPress={() => loadSectionData('stats')}
            styles={styles}
          />
        </View>
      );
    }

    const total = Math.max(0, Number(stats.totalMatches) || 0);
    const wins = Math.max(0, Number(stats.wins) || 0);
    const losses = Math.max(0, Number(stats.losses) || 0);
    const draws = Math.max(0, Number(stats.draws) || 0);
    const points = Math.max(0, Number(stats.totalPoints) || 0);
    const average = Math.max(0, Number(stats.averagePoints) || 0);
    const calculatedRate = total > 0 ? (wins / total) * 100 : 0;
    const winRate = Math.min(
      100,
      Math.max(0, Number.isFinite(Number(stats.winRate))
        ? Number(stats.winRate)
        : calculatedRate),
    );
    const winWidth = total > 0 ? `${(wins / total) * 100}%` : '0%';
    const lossWidth = total > 0 ? `${(losses / total) * 100}%` : '0%';
    const drawWidth = total > 0 ? `${(draws / total) * 100}%` : '0%';

    const recentMatches = Array.isArray(stats.recentMatches)
      ? stats.recentMatches as Array<{
          id: string;
          mode: string;
          result: 'win' | 'loss' | 'draw';
          myScore: number;
          finishedAt: string | null;
        }>
      : [];

    const resultMeta = {
      win: {
        label: 'G‘alaba',
        icon: 'trophy' as const,
        color: colors.success,
        surface: dark ? 'rgba(54, 214, 160, 0.13)' : 'rgba(21, 155, 112, 0.09)',
      },
      loss: {
        label: 'Mag‘lubiyat',
        icon: 'close-circle' as const,
        color: colors.danger,
        surface: dark ? 'rgba(255, 100, 124, 0.13)' : 'rgba(217, 67, 91, 0.09)',
      },
      draw: {
        label: 'Durang',
        icon: 'remove-circle' as const,
        color: colors.muted,
        surface: dark ? 'rgba(161, 171, 192, 0.13)' : 'rgba(116, 128, 150, 0.09)',
      },
    };

    return (
      <View style={styles.statsContent}>
        <View style={styles.statsHero}>
          <View style={styles.statsHeroTop}>
            <View>
              <LocalizedText style={styles.statsEyebrow}>SIZNING NATIJALARINGIZ</LocalizedText>
              <LocalizedText style={styles.statsHeroTitle}>Battle statistikasi</LocalizedText>
            </View>
            <View style={styles.statsHeroIcon}>
              <Ionicons name="analytics" size={23} color="#FFFFFF" />
            </View>
          </View>

          <View style={styles.statsRateRow}>
            <View style={styles.statsRateCircle}>
              <LocalizedText style={styles.statsRateValue}>{Math.round(winRate)}%</LocalizedText>
              <LocalizedText style={styles.statsRateCaption}>g‘alaba</LocalizedText>
            </View>
            <View style={styles.statsHeroCopy}>
              <LocalizedText style={styles.statsHeroNumber}>{total}</LocalizedText>
              <LocalizedText style={styles.statsHeroLabel}>ta yakunlangan o‘yin</LocalizedText>
              <View style={styles.statsHeroPill}>
                <Ionicons name="trending-up" size={13} color="#D9D0FF" />
                <LocalizedText style={styles.statsHeroPillText}>
                  {wins} ta g‘alaba
                </LocalizedText>
              </View>
            </View>
          </View>
          <View style={styles.statsHeroFooter}>
            <LocalizedText style={styles.statsHeroFooterText}>Har bir o‘yin — yangi imkoniyat</LocalizedText>
            <Ionicons name="sparkles" size={16} color="#D9D0FF" />
          </View>
        </View>

        <View style={styles.statsSectionHeading}>
          <LocalizedText style={styles.statsSectionTitle}>Asosiy ko‘rsatkichlar</LocalizedText>
          <LocalizedText style={styles.statsSectionHint}>Umumiy natija</LocalizedText>
        </View>

        <View style={styles.statsGrid}>
          <View style={styles.statTile}>
            <View style={[styles.statTileIcon, { backgroundColor: dark ? 'rgba(54,214,160,0.14)' : '#E7F7F0' }]}>
              <Ionicons name="trophy-outline" size={19} color={colors.success} />
            </View>
            <LocalizedText style={styles.statTileValue}>{wins}</LocalizedText>
            <LocalizedText style={styles.statTileLabel}>G‘alabalar</LocalizedText>
          </View>
          <View style={styles.statTile}>
            <View style={[styles.statTileIcon, { backgroundColor: dark ? 'rgba(255,100,124,0.14)' : '#FCECEF' }]}>
              <Ionicons name="close-circle-outline" size={19} color={colors.danger} />
            </View>
            <LocalizedText style={styles.statTileValue}>{losses}</LocalizedText>
            <LocalizedText style={styles.statTileLabel}>Mag‘lubiyatlar</LocalizedText>
          </View>
          <View style={styles.statTile}>
            <View style={[styles.statTileIcon, { backgroundColor: dark ? 'rgba(85,184,255,0.14)' : '#EAF4FF' }]}>
              <Ionicons name="star-outline" size={19} color={dark ? '#55B8FF' : '#247CC5'} />
            </View>
            <LocalizedText style={styles.statTileValue}>{points}</LocalizedText>
            <LocalizedText style={styles.statTileLabel}>Jami ball</LocalizedText>
          </View>
          <View style={styles.statTile}>
            <View style={[styles.statTileIcon, { backgroundColor: dark ? 'rgba(255,196,107,0.14)' : '#FFF4E2' }]}>
              <Ionicons name="speedometer-outline" size={19} color={dark ? '#FFC46B' : '#B7791F'} />
            </View>
            <LocalizedText style={styles.statTileValue}>{average.toFixed(1)}</LocalizedText>
            <LocalizedText style={styles.statTileLabel}>O‘rtacha ball</LocalizedText>
          </View>
        </View>

        <View style={styles.statsPanel}>
          <View style={styles.statsPanelHeading}>
            <View>
              <LocalizedText style={styles.statsSectionTitle}>O‘yinlar taqsimoti</LocalizedText>
              <LocalizedText style={styles.statsSectionHint}>Natijalaringiz nisbati</LocalizedText>
            </View>
            <Ionicons name="pie-chart-outline" size={20} color={colors.primary} />
          </View>

          <View style={styles.outcomeTrack}>
            <View style={[styles.outcomeWin, { width: winWidth }]} />
            <View style={[styles.outcomeLoss, { width: lossWidth }]} />
            <View style={[styles.outcomeDraw, { width: drawWidth }]} />
          </View>

          <View style={styles.outcomeLegend}>
            <View style={styles.outcomeLegendItem}>
              <View style={[styles.outcomeDot, { backgroundColor: colors.success }]} />
              <LocalizedText style={styles.outcomeLegendLabel}>G‘alaba</LocalizedText>
              <LocalizedText style={styles.outcomeLegendValue}>{wins}</LocalizedText>
            </View>
            <View style={styles.outcomeLegendItem}>
              <View style={[styles.outcomeDot, { backgroundColor: colors.danger }]} />
              <LocalizedText style={styles.outcomeLegendLabel}>Mag‘lubiyat</LocalizedText>
              <LocalizedText style={styles.outcomeLegendValue}>{losses}</LocalizedText>
            </View>
            <View style={styles.outcomeLegendItem}>
              <View style={[styles.outcomeDot, { backgroundColor: colors.muted }]} />
              <LocalizedText style={styles.outcomeLegendLabel}>Durang</LocalizedText>
              <LocalizedText style={styles.outcomeLegendValue}>{draws}</LocalizedText>
            </View>
          </View>
        </View>

        <View style={styles.statsPanel}>
          <View style={styles.statsPanelHeading}>
            <View>
              <LocalizedText style={styles.statsSectionTitle}>So‘nggi o‘yinlar</LocalizedText>
              <LocalizedText style={styles.statsSectionHint}>Oxirgi 5 ta natija</LocalizedText>
            </View>
            <Ionicons name="time-outline" size={20} color={colors.primary} />
          </View>

          {recentMatches.length ? recentMatches.map((item) => {
            const meta = resultMeta[item.result] || resultMeta.draw;
            const dateLabel = item.finishedAt
              ? new Date(item.finishedAt).toLocaleDateString('uz-UZ', {
                  day: '2-digit',
                  month: 'short',
                })
              : 'Sana yo‘q';

            return (
              <View key={item.id} style={styles.recentMatchRow}>
                <View style={[styles.recentMatchIcon, { backgroundColor: meta.surface }]}>
                  <Ionicons name={meta.icon} size={17} color={meta.color} />
                </View>
                <View style={styles.recentMatchCopy}>
                  <LocalizedText style={styles.recentMatchTitle}>{meta.label}</LocalizedText>
                  <LocalizedText style={styles.recentMatchMeta}>
                    {item.mode === 'private' ? 'Do‘stlar Battle' : item.mode === 'ranked' ? 'Ranked' : 'Casual'} · {dateLabel}
                  </LocalizedText>
                </View>
                <LocalizedText style={styles.recentMatchScore}>{Number(item.myScore) || 0} ball</LocalizedText>
              </View>
            );
          }) : (
            <LocalizedText style={styles.muted}>Hozircha yakunlangan o‘yinlar mavjud emas.</LocalizedText>
          )}
        </View>

      </View>
    );
  }

  function renderEducationStats() {
    const totalAttempts = learningStats?.totalAttempts ?? 0;
    const totalQuestions = learningStats?.totalQuestions ?? 0;
    const correctAnswers = learningStats?.correctAnswers ?? 0;
    const accuracy = learningStats?.accuracy ?? 0;
    const level = Math.max(1, Number(user?.level) || 1);
    const xp = Math.max(0, Number(user?.xp) || 0);
    const rankPoints = Math.max(0, Number(user?.rankPoints) || 0);
    const totalTopics = subjects.reduce((sum, subject) => sum + subject.topics.length, 0);
    const activity = learningStats?.weeklyActivity ?? [];
    const maxActivity = Math.max(1, ...activity.map((item) => item.attempts));
    const subjectRows = learningStats?.subjectBreakdown ?? [];
    const recentAttempts = learningStats?.recentAttempts ?? [];

    return (
      <View style={styles.statsContent}>
        <View style={styles.learningHero}>
          <View style={styles.learningHeroGlow} />
          <View style={styles.learningHeroTop}>
            <View>
              <LocalizedText style={styles.learningEyebrow}>LEARNING JOURNEY</LocalizedText>
              <LocalizedText style={styles.learningHeroTitle}>Bilim sari o‘sish</LocalizedText>
            </View>
            <View style={styles.learningHeroIcon}>
              <Ionicons name="school-outline" size={23} color="#FFFFFF" />
            </View>
          </View>

          <View style={styles.learningLevelRow}>
            <View style={styles.learningLevelBadge}>
              <LocalizedText style={styles.learningLevelCaption}>DARAJA</LocalizedText>
              <LocalizedText style={styles.learningLevelValue}>{level}</LocalizedText>
            </View>
            <View style={styles.learningXpCopy}>
              <LocalizedText style={styles.learningXpValue}>{xp.toLocaleString('uz-UZ')} XP</LocalizedText>
              <LocalizedText style={styles.learningXpLabel}>To‘plangan tajriba</LocalizedText>
              <LocalizedText style={styles.learningXpLabel}>Battle reytingi: {rankPoints.toLocaleString('uz-UZ')} RP</LocalizedText>
            </View>
          </View>

          <View style={styles.learningHeroFooter}>
            <LocalizedText style={styles.learningHeroFooterText}>
              Har bir yakunlangan test bilimlaringiz tarixiga qo‘shiladi
            </LocalizedText>
            <Ionicons name="sparkles" size={16} color="#E0D9FF" />
          </View>
        </View>

        <View style={styles.learningMetricGrid}>
          <View style={styles.learningMetricCard}>
            <View style={[styles.learningMetricIcon, { backgroundColor: dark ? 'rgba(117,104,245,0.18)' : '#EEEAFE' }]}>
              <Ionicons name="document-text-outline" size={18} color={colors.primary} />
            </View>
            <LocalizedText style={styles.learningMetricValue}>{totalAttempts}</LocalizedText>
            <LocalizedText style={styles.learningMetricLabel}>Yakunlangan test</LocalizedText>
          </View>
          <View style={styles.learningMetricCard}>
            <View style={[styles.learningMetricIcon, { backgroundColor: dark ? 'rgba(54,214,160,0.14)' : '#E7F7F0' }]}>
              <Ionicons name="checkmark-done-outline" size={18} color={colors.success} />
            </View>
            <LocalizedText style={styles.learningMetricValue}>{accuracy.toFixed(1)}%</LocalizedText>
            <LocalizedText style={styles.learningMetricLabel}>Umumiy aniqlik</LocalizedText>
          </View>
          <View style={styles.learningMetricCard}>
            <View style={[styles.learningMetricIcon, { backgroundColor: dark ? 'rgba(85,184,255,0.14)' : '#EAF4FF' }]}>
              <Ionicons name="help-circle-outline" size={18} color={dark ? '#55B8FF' : '#247CC5'} />
            </View>
            <LocalizedText style={styles.learningMetricValue}>{totalQuestions}</LocalizedText>
            <LocalizedText style={styles.learningMetricLabel}>Jami savollar</LocalizedText>
          </View>
          <View style={styles.learningMetricCard}>
            <View style={[styles.learningMetricIcon, { backgroundColor: dark ? 'rgba(255,196,107,0.14)' : '#FFF4E2' }]}>
              <Ionicons name="book-outline" size={18} color={dark ? '#FFC46B' : '#B7791F'} />
            </View>
            <LocalizedText style={styles.learningMetricValue}>{subjects.length}</LocalizedText>
            <LocalizedText style={styles.learningMetricLabel}>Fanlar</LocalizedText>
          </View>
        </View>

        <View style={styles.learningPanel}>
          <View style={styles.statsPanelHeading}>
            <View>
              <LocalizedText style={styles.statsSectionTitle}>Haftalik o‘qish faolligi</LocalizedText>
              <LocalizedText style={styles.statsSectionHint}>Oxirgi 7 kun ichida yakunlangan testlar</LocalizedText>
            </View>
            <Ionicons name="calendar-outline" size={20} color={colors.primary} />
          </View>
          {activity.length ? (
            <View style={styles.learningWeekRow}>
              {activity.map((item) => {
                const date = new Date(`${item.day}T12:00:00`);
                const dayLabel = date.toLocaleDateString('uz-UZ', { weekday: 'short' }).replace('.', '');
                const height = item.attempts > 0
                  ? Math.max(7, (item.attempts / maxActivity) * 58)
                  : 4;
                return (
                  <View key={item.day} style={styles.learningDayColumn}>
                    <LocalizedText style={styles.learningDayCount}>{item.attempts || ''}</LocalizedText>
                    <View style={styles.learningBarTrack}>
                      <View style={[
                        styles.learningBarFill,
                        {
                          height,
                          backgroundColor: item.attempts > 0 ? colors.primary : colors.border,
                        },
                      ]} />
                    </View>
                    <LocalizedText style={styles.learningDayLabel}>{dayLabel}</LocalizedText>
                  </View>
                );
              })}
            </View>
          ) : (
            <LocalizedText style={styles.muted}>Haftalik faollik hali mavjud emas.</LocalizedText>
          )}
        </View>

        <View style={styles.learningPanel}>
          <View style={styles.statsPanelHeading}>
            <View>
              <LocalizedText style={styles.statsSectionTitle}>Fanlar bo‘yicha natija</LocalizedText>
              <LocalizedText style={styles.statsSectionHint}>{totalTopics} ta mavzu mavjud</LocalizedText>
            </View>
            <Ionicons name="library-outline" size={20} color={colors.primary} />
          </View>
          {subjectRows.length ? subjectRows.slice(0, 6).map((item) => (
            <View key={item.subjectId} style={styles.learningSubjectRow}>
              <View style={styles.learningSubjectTop}>
                <LocalizedText style={styles.learningSubjectName}>{item.subjectName}</LocalizedText>
                <LocalizedText style={styles.learningSubjectValue}>{item.accuracy.toFixed(0)}% · {item.attempts} test</LocalizedText>
              </View>
              <View style={styles.learningSubjectTrack}>
                <View style={[
                  styles.learningSubjectFill,
                  { width: `${Math.max(0, Math.min(100, item.accuracy))}%` },
                ]} />
              </View>
            </View>
          )) : (
            <View style={styles.learningEmpty}>
              <Ionicons name="book-outline" size={24} color={colors.muted} />
              <LocalizedText style={styles.muted}>Birinchi testingizni yakunlang — fanlar kesimidagi natijalar shu yerda paydo bo‘ladi.</LocalizedText>
            </View>
          )}
        </View>

        <View style={styles.learningPanel}>
          <View style={styles.statsPanelHeading}>
            <View>
              <LocalizedText style={styles.statsSectionTitle}>So‘nggi testlar</LocalizedText>
              <LocalizedText style={styles.statsSectionHint}>Oxirgi 8 ta yakunlangan urinish</LocalizedText>
            </View>
            <Ionicons name="time-outline" size={20} color={colors.primary} />
          </View>
          {recentAttempts.length ? recentAttempts.map((item) => (
            <View key={item.id} style={styles.learningRecentRow}>
              <View style={styles.learningRecentIcon}>
                <Ionicons name="school-outline" size={17} color={colors.primary} />
              </View>
              <View style={styles.learningRecentCopy}>
                <LocalizedText style={styles.learningRecentTitle}>{item.topicName}</LocalizedText>
                <LocalizedText style={styles.learningRecentMeta}>{item.subjectName} · {new Date(item.completedAt).toLocaleDateString('uz-UZ')}</LocalizedText>
              </View>
              <View style={styles.learningRecentScore}>
                <LocalizedText style={styles.learningRecentScoreValue}>{item.correctAnswers}/{item.totalQuestions}</LocalizedText>
                <LocalizedText style={styles.learningRecentScoreMeta}>{Number(item.accuracy).toFixed(0)}%</LocalizedText>
              </View>
            </View>
          )) : (
            <LocalizedText style={styles.muted}>Hozircha saqlangan test natijalari yo‘q.</LocalizedText>
          )}
        </View>

        <View style={styles.learningNote}>
          <Ionicons name="information-circle-outline" size={17} color={colors.primary} />
          <LocalizedText style={styles.learningNoteText}>
            Test natijalari hisobingizga saqlanadi. XP va daraja profil tizimidan olinadi; statistika ularni o‘zgartirmaydi.
          </LocalizedText>
        </View>
      </View>
    );
  }

  function renderOverviewStats() {
    const battleTotal = Math.max(0, Number(stats?.totalMatches) || 0);
    const testsTotal = learningStats?.totalAttempts ?? 0;
    const learningAccuracy = learningStats?.accuracy ?? 0;
    const xp = Math.max(0, Number(user?.xp) || 0);
    const level = Math.max(1, Number(user?.level) || 1);

    return (
      <View style={styles.statsContent}>
        <View style={styles.learningHero}>
          <View style={styles.learningHeroGlow} />
          <View style={styles.learningHeroTop}>
            <View>
              <LocalizedText style={styles.learningEyebrow}>YOUR PERFORMANCE</LocalizedText>
              <LocalizedText style={styles.learningHeroTitle}>Shaxsiy natijalar</LocalizedText>
            </View>
            <View style={styles.learningHeroIcon}>
              <Ionicons name="analytics-outline" size={23} color="#FFFFFF" />
            </View>
          </View>
          <View style={styles.learningLevelRow}>
            <View style={styles.learningLevelBadge}>
              <LocalizedText style={styles.learningLevelCaption}>LEVEL</LocalizedText>
              <LocalizedText style={styles.learningLevelValue}>{level}</LocalizedText>
            </View>
            <View style={styles.learningXpCopy}>
              <LocalizedText style={styles.learningXpValue}>{xp.toLocaleString('uz-UZ')} XP</LocalizedText>
              <LocalizedText style={styles.learningXpLabel}>Umumiy tajriba</LocalizedText>
              <LocalizedText style={styles.learningXpLabel}>Ta’lim va Battle natijalari bir joyda</LocalizedText>
            </View>
          </View>
        </View>

        <View style={styles.learningMetricGrid}>
          <View style={styles.learningMetricCard}>
            <Ionicons name="school-outline" size={19} color={colors.primary} />
            <LocalizedText style={styles.learningMetricValue}>{testsTotal}</LocalizedText>
            <LocalizedText style={styles.learningMetricLabel}>Testlar</LocalizedText>
          </View>
          <View style={styles.learningMetricCard}>
            <Ionicons name="game-controller-outline" size={19} color={colors.success} />
            <LocalizedText style={styles.learningMetricValue}>{battleTotal}</LocalizedText>
            <LocalizedText style={styles.learningMetricLabel}>Battle o‘yinlari</LocalizedText>
          </View>
          <View style={styles.learningMetricCard}>
            <Ionicons name="checkmark-circle-outline" size={19} color={colors.primary} />
            <LocalizedText style={styles.learningMetricValue}>{learningAccuracy.toFixed(1)}%</LocalizedText>
            <LocalizedText style={styles.learningMetricLabel}>Test aniqligi</LocalizedText>
          </View>
          <View style={styles.learningMetricCard}>
            <Ionicons name="trophy-outline" size={19} color={dark ? '#FFC46B' : '#B7791F'} />
            <LocalizedText style={styles.learningMetricValue}>{Math.max(0, Number(stats?.wins) || 0)}</LocalizedText>
            <LocalizedText style={styles.learningMetricLabel}>Battle g‘alabalari</LocalizedText>
          </View>
        </View>

        <View style={styles.learningPanel}>
          <LocalizedText style={styles.statsSectionTitle}>Qisqa xulosa</LocalizedText>
          <LocalizedText style={styles.learningSummaryText}>
            {testsTotal + battleTotal > 0
              ? `Siz ${testsTotal} ta test va ${battleTotal} ta Battle o‘yinini yakunlagansiz. Keyingi maqsad — natijangizni muntazam yaxshilash.`
              : 'Birinchi testingiz yoki Battle o‘yiningizni yakunlang. Natijalaringiz shu yerda jamlanadi.'}
          </LocalizedText>
          <View style={styles.learningQuickLinks}>
            <Pressable onPress={() => setStatsView('education')} style={styles.learningQuickLink}>
              <Ionicons name="book-outline" size={16} color={colors.primary} />
              <LocalizedText style={styles.learningQuickLinkText}>Ta’lim natijalari</LocalizedText>
            </Pressable>
            <Pressable onPress={() => setStatsView('battle')} style={styles.learningQuickLink}>
              <Ionicons name="game-controller-outline" size={16} color={colors.primary} />
              <LocalizedText style={styles.learningQuickLinkText}>Battle natijalari</LocalizedText>
            </Pressable>
          </View>
        </View>
      </View>
    );
  }

  function renderStats() {
    if (loadingData && !stats && !learningStats) {
      return (
        <View style={styles.statsLoading}>
          <ActivityIndicator color={colors.primary} size="large" />
          <LocalizedText style={styles.muted}>Ta’lim va Battle statistikasi yuklanmoqda...</LocalizedText>
        </View>
      );
    }

    return (
      <View style={styles.statsContent}>
        <View style={styles.statsIntro}>
          <LocalizedText style={styles.statsIntroTitle}>Statistika markazi</LocalizedText>
          <LocalizedText style={styles.statsIntroSubtitle}>Ta’limdagi o‘sish va Battle natijalaringiz</LocalizedText>
        </View>
        <Pressable
          onPress={() => void exportStatisticsPdf()}
          disabled={exportingPdf || loadingData || (!stats && !learningStats)}
          style={[styles.statsRefresh, (exportingPdf || loadingData || (!stats && !learningStats)) && { opacity: 0.55 }]}
        >
          {exportingPdf ? <ActivityIndicator size="small" color={colors.primary} /> : <Ionicons name="document-text-outline" size={16} color={colors.primary} />}
          <LocalizedText style={styles.statsRefreshText}>
            {exportingPdf ? 'PDF tayyorlanmoqda...' : 'PDF hisobotni ulashish'}
          </LocalizedText>
        </Pressable>
        <View style={styles.statsViewSwitch}>
          {([
            ['overview', 'Umumiy'],
            ['education', 'Ta’lim'],
            ['battle', 'Battle'],
          ] as [StatsView, string][]).map(([value, label]) => (
            <Pressable
              key={value}
              onPress={() => setStatsView(value)}
              style={[
                styles.statsViewButton,
                statsView === value && styles.statsViewButtonActive,
              ]}
            >
              <LocalizedText style={[
                styles.statsViewButtonText,
                statsView === value && styles.statsViewButtonTextActive,
              ]}>{label}</LocalizedText>
            </Pressable>
          ))}
        </View>
        {statsView === 'overview'
          ? renderOverviewStats()
          : statsView === 'education'
            ? renderEducationStats()
            : renderBattleStats()}
        <Pressable
          onPress={() => loadSectionData('stats')}
          disabled={loadingData}
          style={styles.statsRefresh}
        >
          <Ionicons name="refresh-outline" size={16} color={colors.primary} />
          <LocalizedText style={styles.statsRefreshText}>
            {loadingData ? 'Yangilanmoqda...' : 'Barcha statistikani yangilash'}
          </LocalizedText>
        </Pressable>
      </View>
    );
  }

  if (section === 'leaderboard') {
    return (
      <LeaderboardScreen
        leaderboard={leaderboard}
        currentUserId={user?.id}
        loading={loadingData}
        error={error}
        onRefresh={() => loadSectionData('leaderboard')}
      />
    );
  }

  return (
    <View style={styles.screen}>
      <View pointerEvents="none" style={styles.ambientGlowOne} />
      <View pointerEvents="none" style={styles.ambientGlowTwo} />
      <View style={styles.header}>
        {onBack ? (
          <Pressable onPress={onBack} style={styles.backButton}>
            <LocalizedText style={styles.backText}>вЂ№</LocalizedText>
          </Pressable>
        ) : null}
        <View style={{ flex: 1 }}>
          <LocalizedText style={styles.heading}>Battle Arena</LocalizedText>
          <LocalizedText style={styles.muted}>
            {connected ? 'в—Џ Ulangan' : 'в—‹ Ulanmagan'}
          </LocalizedText>
        </View>
      </View>

      <View style={styles.tabs}>
        {([
          ['battle', 'Battle'],
          ['history', 'Tarix'],
          ['stats', 'Statistika'],
          ['leaderboard', 'Reyting'],
        ] as [Section, string][]).map(([value, label]) => (
          <Pressable
            key={value}
            onPress={() => setSection(value)}
            style={[
              styles.tab,
              section === value && styles.activeTab,
            ]}
          >
            <LocalizedText
              style={[
                styles.tabText,
                section === value && styles.activeTabText,
              ]}
            >
              {label}
            </LocalizedText>
          </Pressable>
        ))}
      </View>

      {!!error && (
        <View style={styles.errorBox}>
          <LocalizedText style={styles.dangerText}>{error}</LocalizedText>
        </View>
      )}

      <Animated.ScrollView
        onScroll={dockScrollHandler}
        scrollEventThrottle={16}
        style={styles.content}
        contentContainerStyle={styles.contentInner}
        showsVerticalScrollIndicator={false}
      >
        {section === 'battle' && renderBattle()}
        {section === 'history' && renderHistory()}
        {section === 'stats' && renderStats()}
      </Animated.ScrollView>
    </View>
  );
}

function ActionButton({
  title,
  onPress,
  styles,
  disabled = false,
  danger = false,
}: {
  title: string;
  onPress: () => void;
  styles: ReturnType<typeof makeStyles>;
  disabled?: boolean;
  danger?: boolean;
}) {
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      style={[
        styles.actionButton,
        danger && styles.dangerButton,
        disabled && styles.disabledButton,
      ]}
    >
      <LocalizedText style={styles.actionButtonText}>{title}</LocalizedText>
    </Pressable>
  );
}

function makeStyles(colors: typeof COLORS, dark: boolean) {
  return StyleSheet.create({
    screen: {
      flex: 1,
      backgroundColor: colors.background,
      overflow: 'hidden',
    },
    ambientGlowOne: {
      position: 'absolute',
      top: -105,
      right: -95,
      width: 270,
      height: 270,
      borderRadius: 135,
      backgroundColor: dark ? 'rgba(117,104,245,0.16)' : 'rgba(117,104,245,0.10)',
    },
    ambientGlowTwo: {
      position: 'absolute',
      bottom: 90,
      left: -135,
      width: 260,
      height: 260,
      borderRadius: 130,
      backgroundColor: dark ? 'rgba(63,190,190,0.09)' : 'rgba(76,190,178,0.10)',
    },
    homeContent: { gap: 16 },
    battleHero: {
      position: 'relative',
      overflow: 'hidden',
      borderRadius: 30,
      padding: 20,
      minHeight: 350,
      backgroundColor: dark ? '#211052' : '#4B32A8',
      borderWidth: 1,
      borderColor: dark ? 'rgba(188,151,255,0.55)' : 'rgba(255,255,255,0.55)',
      shadowColor: '#7C35FF',
      shadowOpacity: 0.35,
      shadowRadius: 24,
      shadowOffset: { width: 0, height: 10 },
      elevation: 8,
    },
    heroGlowTop: {
      position: 'absolute', width: 240, height: 240, borderRadius: 120,
      top: -115, right: -75, backgroundColor: 'rgba(160,82,255,0.30)',
    },
    heroGlowBottom: {
      position: 'absolute', width: 190, height: 190, borderRadius: 95,
      bottom: -105, left: -70, backgroundColor: 'rgba(39,132,255,0.22)',
    },
    heroTopLine: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
    heroBadge: {
      flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 11,
      paddingVertical: 7, borderRadius: 18, backgroundColor: 'rgba(255,255,255,0.16)',
      borderWidth: 1, borderColor: 'rgba(255,255,255,0.24)',
    },
    heroBadgeText: { color: '#FFFFFF', fontSize: 10, fontWeight: '900', letterSpacing: 1.1 },
    heroLive: { flexDirection: 'row', alignItems: 'center', gap: 6 },
    liveDot: { width: 7, height: 7, borderRadius: 4 },
    heroLiveText: { color: '#E5DCFF', fontSize: 9, fontWeight: '800', letterSpacing: 1 },
    heroArtwork: { height: 112, alignItems: 'center', justifyContent: 'center', marginTop: 7 },
    trophyHalo: {
      width: 104, height: 104, borderRadius: 52, alignItems: 'center', justifyContent: 'center',
      backgroundColor: 'rgba(255,199,80,0.13)', borderWidth: 1,
      borderColor: 'rgba(255,211,111,0.32)',
      shadowColor: '#FFC85A', shadowOpacity: 0.55, shadowRadius: 24, elevation: 8,
    },
    heroCrossedSwords: {
      position: 'absolute', right: '20%', bottom: 4, width: 47, height: 47,
      borderRadius: 16, alignItems: 'center', justifyContent: 'center',
      backgroundColor: 'rgba(255,255,255,0.13)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.2)',
    },
    heroTitle: { color: '#FFFFFF', fontSize: 27, fontWeight: '900', textAlign: 'center', marginTop: 7 },
    heroSubtitle: { color: '#E2D9FF', fontSize: 13, lineHeight: 20, textAlign: 'center', marginTop: 7, marginBottom: 17 },
    heroPlayButton: {
      minHeight: 55, borderRadius: 19, flexDirection: 'row', alignItems: 'center',
      justifyContent: 'center', gap: 10, paddingHorizontal: 17,
      backgroundColor: '#8B3DFF', borderWidth: 1, borderColor: 'rgba(255,255,255,0.68)',
      shadowColor: '#B14CFF', shadowOpacity: 0.55, shadowRadius: 17,
      shadowOffset: { width: 0, height: 5 }, elevation: 7,
    },
    heroPlayText: { color: '#FFFFFF', fontSize: 17, fontWeight: '900', flex: 1, textAlign: 'center' },
    sectionHeading: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 3 },
    sectionHeadingLeft: { flexDirection: 'row', alignItems: 'center', gap: 9 },
    sectionHeadingTitle: { color: colors.text, fontSize: 17, fontWeight: '900' },
    sectionHeadingHint: { color: colors.muted, fontSize: 12, fontWeight: '700' },
    modeGrid: { flexDirection: 'row', gap: 11 },
    modeCard: {
      flex: 1, minHeight: 177, borderRadius: 24, padding: 14, overflow: 'hidden',
      borderWidth: 1, justifyContent: 'space-between',
      shadowColor: '#7C35FF', shadowOpacity: dark ? 0.20 : 0.08, shadowRadius: 15, elevation: 4,
    },
    casualMode: { backgroundColor: dark ? '#102653' : '#E7F0FF', borderColor: dark ? 'rgba(105,166,255,0.50)' : '#B9D4FF' },
    rankedMode: { backgroundColor: dark ? '#382039' : '#FFF0DF', borderColor: dark ? 'rgba(255,183,99,0.42)' : '#F2C99D' },
    modeIconBlue: { width: 52, height: 52, borderRadius: 18, alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(66,145,255,0.17)' },
    modeIconGold: { width: 52, height: 52, borderRadius: 18, alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(255,190,75,0.17)' },
    modeTitle: { color: colors.text, fontSize: 16, fontWeight: '900', marginTop: 10 },
    modeSubtitle: { color: colors.muted, fontSize: 11, marginTop: 3 },
    modeBottom: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 13 },
    modeMeta: { color: colors.muted, fontSize: 10, fontWeight: '700' },
    privateBattleCard: { padding: 16, borderRadius: 22, backgroundColor: colors.card, borderWidth: 1, borderColor: colors.border, gap: 13 },
    privateBattleHeading: { flexDirection: 'row', alignItems: 'center', gap: 11 },
    privateBattleIcon: { width: 42, height: 42, borderRadius: 14, alignItems: 'center', justifyContent: 'center', backgroundColor: '#7059D6' },
    privateBattleCopy: { flex: 1, gap: 4 },
    privateBattleTitle: { color: colors.text, fontSize: 14, fontWeight: '900' },
    privateBattleDescription: { color: colors.muted, fontSize: 10, lineHeight: 15 },
    privateCreateButton: { minHeight: 45, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, borderRadius: 13, backgroundColor: '#6653D8' },
    privateCreateText: { color: '#FFFFFF', fontSize: 12, fontWeight: '900' },
    privateJoinRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
    privateCodeInput: { flex: 1, minWidth: 0, minHeight: 44, borderRadius: 12, paddingHorizontal: 12, color: colors.text, backgroundColor: colors.background, borderWidth: 1, borderColor: colors.border, fontSize: 12, letterSpacing: 1.2 },
    privateJoinButton: { minHeight: 44, paddingHorizontal: 15, borderRadius: 12, alignItems: 'center', justifyContent: 'center', backgroundColor: dark ? '#3A315F' : '#EDE9FF', borderWidth: 1, borderColor: colors.border },
    privateJoinText: { color: dark ? '#E4DDFF' : '#5B49B6', fontSize: 11, fontWeight: '900' },
    privateRoomBox: { borderRadius: 16, padding: 14, backgroundColor: dark ? 'rgba(117,104,245,0.12)' : '#F2EEFF', borderWidth: 1, borderColor: colors.border, alignItems: 'center', gap: 8 },
    privateRoomLabel: { color: colors.muted, fontSize: 9, fontWeight: '900', letterSpacing: 1.2 },
    privateRoomCode: { color: colors.primary, fontSize: 30, fontWeight: '900', letterSpacing: 5 },
    privateRoomActions: { flexDirection: 'row', gap: 8, width: '100%', marginTop: 5 },
    privateShareButton: { flex: 1, minHeight: 42, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 7, borderRadius: 12, backgroundColor: '#6653D8' },
    privateShareText: { color: '#FFFFFF', fontSize: 11, fontWeight: '900' },
    privateCancelButton: { minHeight: 42, paddingHorizontal: 13, alignItems: 'center', justifyContent: 'center', borderRadius: 12, backgroundColor: dark ? 'rgba(220,76,100,0.13)' : '#FFF0F2' },
    privateCancelText: { color: colors.danger, fontSize: 11, fontWeight: '800' },
    quickStatsCard: {
      padding: 16, borderRadius: 24, backgroundColor: dark ? 'rgba(27,24,59,0.88)' : 'rgba(255,255,255,0.9)',
      borderWidth: 1, borderColor: dark ? 'rgba(160,135,255,0.36)' : 'rgba(117,104,245,0.18)',
    },
    quickStatsHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
    quickStatsTitle: { color: colors.text, fontSize: 14, fontWeight: '800' },
    quickStatsLink: { color: dark ? '#B69AFF' : '#7254E8', fontSize: 11, fontWeight: '800' },
    quickStatsRow: { flexDirection: 'row', alignItems: 'center', marginTop: 18 },
    quickStatItem: { flex: 1, alignItems: 'center', gap: 4 },
    quickStatValue: { color: colors.text, fontSize: 23, fontWeight: '900' },
    quickStatLabel: { color: colors.muted, fontSize: 10, fontWeight: '600' },
    quickStatDivider: { width: 1, height: 38, backgroundColor: colors.border },
    latestMatchCard: {
      padding: 16, borderRadius: 24, backgroundColor: dark ? 'rgba(24,28,53,0.86)' : 'rgba(255,255,255,0.9)',
      borderWidth: 1, borderColor: colors.border,
    },
    latestMatchRow: { flexDirection: 'row', alignItems: 'center', gap: 11, marginTop: 15 },
    latestMatchAvatar: { width: 43, height: 43, borderRadius: 22, alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(117,104,245,0.22)' },
    latestMatchCopy: { flex: 1, gap: 3 },
    latestMatchName: { color: colors.text, fontSize: 13, fontWeight: '800' },
    latestMatchResult: { fontSize: 11, fontWeight: '900' },
    connectionNote: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, paddingVertical: 8 },
    connectionNoteText: { color: colors.muted, fontSize: 10, fontWeight: '600' },
    arenaBadge: {
      alignSelf: 'center',
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
      paddingHorizontal: 12,
      paddingVertical: 7,
      marginBottom: 13,
      borderRadius: 30,
      backgroundColor: dark ? 'rgba(117,104,245,0.16)' : 'rgba(101,88,232,0.09)',
      borderWidth: 1,
      borderColor: dark ? 'rgba(171,161,255,0.22)' : 'rgba(101,88,232,0.13)',
    },
    arenaBadgeText: {
      color: colors.primary,
      fontSize: 9,
      fontWeight: '900',
      letterSpacing: 1.4,
    },
    header: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingHorizontal: 18,
      paddingTop: 14,
      paddingBottom: 16,
      gap: 12,
      zIndex: 1,
    },
    backButton: {
      width: 38,
      height: 38,
      borderRadius: 12,
      backgroundColor: colors.card,
      alignItems: 'center',
      justifyContent: 'center',
    },
    backText: {
      color: colors.text,
      fontSize: 30,
      lineHeight: 34,
    },
    heading: {
      color: colors.text,
      fontSize: 23,
      fontWeight: '800',
    },
    muted: {
      color: colors.muted,
      fontSize: 13,
      marginTop: 5,
    },
    tabs: {
      flexDirection: 'row',
      marginHorizontal: 12,
      marginBottom: 12,
      backgroundColor: dark ? 'rgba(27,34,55,0.78)' : 'rgba(255,255,255,0.72)',
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: 18,
      padding: 5,
    },
    tab: {
      flex: 1,
      alignItems: 'center',
      justifyContent: 'center',
      paddingVertical: 10,
      borderRadius: 10,
    },
    activeTab: {
      backgroundColor: dark ? '#7568F5' : '#6554D9',
      shadowColor: '#7568F5',
      shadowOpacity: 0.22,
      shadowRadius: 10,
      elevation: 3,
    },
    tabText: {
      color: colors.muted,
      fontSize: 11,
      fontWeight: '700',
    },
    activeTabText: {
      color: '#FFFFFF',
    },
    content: {
      flex: 1,
      zIndex: 1,
    },
    contentInner: {
      padding: 14,
      paddingBottom: 124,
      gap: 12,
    },
    card: {
      backgroundColor: dark ? 'rgba(24,31,51,0.84)' : 'rgba(255,255,255,0.82)',
      borderRadius: 28,
      padding: 21,
      alignItems: 'stretch',
      borderWidth: 1,
      borderColor: dark ? 'rgba(177,188,225,0.20)' : 'rgba(255,255,255,0.92)',
      shadowColor: dark ? '#000000' : '#6B68A8',
      shadowOpacity: dark ? 0.22 : 0.09,
      shadowRadius: 24,
      shadowOffset: { width: 0, height: 12 },
      elevation: 5,
    },
    listCard: {
      backgroundColor: dark ? 'rgba(24,31,51,0.82)' : 'rgba(255,255,255,0.80)',
      borderRadius: 22,
      padding: 17,
      borderWidth: 1,
      borderColor: colors.border,
      marginBottom: 11,
      shadowColor: dark ? '#000000' : '#6B68A8',
      shadowOpacity: dark ? 0.14 : 0.06,
      shadowRadius: 16,
      shadowOffset: { width: 0, height: 7 },
      elevation: 3,
    },
    statsIntro: {
      paddingHorizontal: 2,
      gap: 4,
    },
    statsIntroTitle: {
      color: colors.text,
      fontSize: 23,
      fontWeight: '900',
      letterSpacing: -0.5,
    },
    statsIntroSubtitle: {
      color: colors.muted,
      fontSize: 12,
      lineHeight: 18,
    },
    statsViewSwitch: {
      flexDirection: 'row',
      padding: 4,
      borderRadius: 17,
      borderWidth: 1,
      borderColor: colors.border,
      backgroundColor: dark ? 'rgba(29,36,53,0.9)' : 'rgba(255,255,255,0.9)',
      gap: 4,
    },
    statsViewButton: {
      flex: 1,
      minHeight: 38,
      alignItems: 'center',
      justifyContent: 'center',
      borderRadius: 13,
      paddingHorizontal: 8,
    },
    statsViewButtonActive: {
      backgroundColor: dark ? '#7568F5' : '#6554D9',
    },
    statsViewButtonText: {
      color: colors.muted,
      fontSize: 12,
      fontWeight: '700',
    },
    statsViewButtonTextActive: {
      color: '#FFFFFF',
    },
    learningHero: {
      borderRadius: 26,
      padding: 20,
      overflow: 'hidden',
      backgroundColor: dark ? '#26304C' : '#5549B9',
      borderWidth: 1,
      borderColor: dark ? 'rgba(166,181,255,0.25)' : 'rgba(255,255,255,0.22)',
    },
    learningHeroGlow: {
      position: 'absolute',
      width: 180,
      height: 180,
      borderRadius: 90,
      top: -105,
      right: -55,
      backgroundColor: 'rgba(190,180,255,0.13)',
    },
    learningHeroTop: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
    },
    learningEyebrow: {
      color: '#D8D0FF',
      fontSize: 10,
      fontWeight: '800',
      letterSpacing: 1.5,
    },
    learningHeroTitle: {
      color: '#FFFFFF',
      fontSize: 19,
      fontWeight: '800',
      marginTop: 5,
    },
    learningHeroIcon: {
      width: 42,
      height: 42,
      borderRadius: 15,
      backgroundColor: 'rgba(255,255,255,0.16)',
      alignItems: 'center',
      justifyContent: 'center',
    },
    learningLevelRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 15,
      marginTop: 20,
    },
    learningLevelBadge: {
      width: 82,
      height: 82,
      borderRadius: 25,
      backgroundColor: 'rgba(255,255,255,0.13)',
      borderWidth: 1,
      borderColor: 'rgba(255,255,255,0.25)',
      alignItems: 'center',
      justifyContent: 'center',
    },
    learningLevelCaption: {
      color: '#D8D0FF',
      fontSize: 9,
      fontWeight: '800',
      letterSpacing: 1,
    },
    learningLevelValue: {
      color: '#FFFFFF',
      fontSize: 31,
      fontWeight: '900',
      marginTop: 1,
    },
    learningXpCopy: {
      flex: 1,
      gap: 4,
    },
    learningXpValue: {
      color: '#FFFFFF',
      fontSize: 25,
      fontWeight: '900',
    },
    learningXpLabel: {
      color: '#D8D0FF',
      fontSize: 11,
    },
    learningHeroFooter: {
      borderTopWidth: 1,
      borderTopColor: 'rgba(255,255,255,0.16)',
      marginTop: 17,
      paddingTop: 12,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      gap: 8,
    },
    learningHeroFooterText: {
      color: '#E0D9FF',
      fontSize: 10,
      fontWeight: '600',
      flex: 1,
    },
    learningMetricGrid: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: 10,
    },
    learningMetricCard: {
      width: '48%',
      flexGrow: 1,
      flexBasis: '44%',
      minHeight: 112,
      padding: 14,
      borderRadius: 20,
      borderWidth: 1,
      borderColor: colors.border,
      backgroundColor: dark ? 'rgba(29,36,53,0.84)' : 'rgba(255,255,255,0.9)',
      gap: 7,
    },
    learningMetricIcon: {
      width: 32,
      height: 32,
      borderRadius: 11,
      alignItems: 'center',
      justifyContent: 'center',
    },
    learningMetricValue: {
      color: colors.text,
      fontSize: 22,
      fontWeight: '900',
      letterSpacing: -0.4,
    },
    learningMetricLabel: {
      color: colors.muted,
      fontSize: 10,
      fontWeight: '600',
    },
    learningPanel: {
      padding: 17,
      borderRadius: 22,
      borderWidth: 1,
      borderColor: colors.border,
      backgroundColor: dark ? 'rgba(29,36,53,0.84)' : 'rgba(255,255,255,0.9)',
    },
    learningWeekRow: {
      flexDirection: 'row',
      alignItems: 'flex-end',
      justifyContent: 'space-between',
      height: 104,
      gap: 8,
    },
    learningDayColumn: {
      flex: 1,
      alignItems: 'center',
      justifyContent: 'flex-end',
      gap: 6,
      height: '100%',
    },
    learningDayCount: {
      color: colors.muted,
      fontSize: 9,
      fontWeight: '700',
      height: 12,
    },
    learningBarTrack: {
      width: '100%',
      height: 60,
      borderRadius: 8,
      overflow: 'hidden',
      justifyContent: 'flex-end',
      backgroundColor: dark ? '#30394E' : '#EEF0F7',
    },
    learningBarFill: {
      width: '100%',
      borderRadius: 8,
      minHeight: 4,
    },
    learningDayLabel: {
      color: colors.muted,
      fontSize: 9,
      fontWeight: '600',
    },
    learningSubjectRow: {
      marginTop: 14,
      gap: 8,
    },
    learningSubjectTop: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      gap: 8,
    },
    learningSubjectName: {
      color: colors.text,
      fontSize: 12,
      fontWeight: '700',
      flex: 1,
    },
    learningSubjectValue: {
      color: colors.muted,
      fontSize: 10,
      fontWeight: '600',
    },
    learningSubjectTrack: {
      height: 7,
      borderRadius: 9,
      overflow: 'hidden',
      backgroundColor: colors.border,
    },
    learningSubjectFill: {
      height: '100%',
      borderRadius: 9,
      backgroundColor: colors.primary,
    },
    learningEmpty: {
      minHeight: 90,
      alignItems: 'center',
      justifyContent: 'center',
      gap: 9,
      paddingVertical: 12,
    },
    learningRecentRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 10,
      paddingVertical: 11,
      borderTopWidth: 1,
      borderTopColor: colors.border,
    },
    learningRecentIcon: {
      width: 36,
      height: 36,
      borderRadius: 13,
      backgroundColor: dark ? 'rgba(117,104,245,0.17)' : '#EEEAFE',
      alignItems: 'center',
      justifyContent: 'center',
    },
    learningRecentCopy: {
      flex: 1,
    },
    learningRecentTitle: {
      color: colors.text,
      fontSize: 12,
      fontWeight: '700',
    },
    learningRecentMeta: {
      color: colors.muted,
      fontSize: 9,
      marginTop: 4,
    },
    learningRecentScore: {
      alignItems: 'flex-end',
      gap: 3,
    },
    learningRecentScoreValue: {
      color: colors.text,
      fontSize: 12,
      fontWeight: '800',
    },
    learningRecentScoreMeta: {
      color: colors.primary,
      fontSize: 10,
      fontWeight: '700',
    },
    learningNote: {
      flexDirection: 'row',
      alignItems: 'flex-start',
      gap: 9,
      padding: 13,
      borderRadius: 16,
      backgroundColor: dark ? 'rgba(117,104,245,0.10)' : 'rgba(101,88,232,0.07)',
    },
    learningNoteText: {
      flex: 1,
      color: colors.muted,
      fontSize: 10,
      lineHeight: 16,
    },
    learningSummaryText: {
      color: colors.muted,
      fontSize: 12,
      lineHeight: 19,
      marginTop: 9,
    },
    learningQuickLinks: {
      flexDirection: 'row',
      gap: 9,
      marginTop: 15,
    },
    learningQuickLink: {
      flex: 1,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 6,
      paddingVertical: 11,
      paddingHorizontal: 8,
      borderRadius: 13,
      backgroundColor: dark ? 'rgba(117,104,245,0.12)' : 'rgba(101,88,232,0.08)',
    },
    learningQuickLinkText: {
      color: colors.primary,
      fontSize: 10,
      fontWeight: '700',
    },
    statsContent: {
      gap: 14,
    },
    statsLoading: {
      minHeight: 220,
      alignItems: 'center',
      justifyContent: 'center',
      gap: 12,
    },
    emptyStats: {
      backgroundColor: colors.card,
      borderRadius: 24,
      borderWidth: 1,
      borderColor: colors.border,
      padding: 24,
      alignItems: 'center',
    },
    emptyStatsIcon: {
      width: 64,
      height: 64,
      borderRadius: 22,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: dark ? 'rgba(117,104,245,0.18)' : '#EEEAFE',
      marginBottom: 16,
    },
    statsHero: {
      borderRadius: 26,
      padding: 20,
      overflow: 'hidden',
      backgroundColor: dark ? '#30285F' : '#6554D9',
      borderWidth: 1,
      borderColor: dark ? 'rgba(190,178,255,0.28)' : 'rgba(255,255,255,0.24)',
    },
    statsHeroTop: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
    },
    statsEyebrow: {
      color: '#D8D0FF',
      fontSize: 10,
      fontWeight: '800',
      letterSpacing: 1.5,
    },
    statsHeroTitle: {
      color: '#FFFFFF',
      fontSize: 19,
      fontWeight: '800',
      marginTop: 5,
    },
    statsHeroIcon: {
      width: 42,
      height: 42,
      borderRadius: 15,
      backgroundColor: 'rgba(255,255,255,0.16)',
      alignItems: 'center',
      justifyContent: 'center',
    },
    statsRateRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 18,
      marginTop: 20,
    },
    statsRateCircle: {
      width: 104,
      height: 104,
      borderRadius: 52,
      borderWidth: 7,
      borderColor: 'rgba(255,255,255,0.32)',
      backgroundColor: 'rgba(255,255,255,0.10)',
      alignItems: 'center',
      justifyContent: 'center',
    },
    statsRateValue: {
      color: '#FFFFFF',
      fontSize: 25,
      fontWeight: '900',
      letterSpacing: -0.7,
    },
    statsRateCaption: {
      color: '#E2DCFF',
      fontSize: 11,
      fontWeight: '600',
      marginTop: 1,
    },
    statsHeroCopy: {
      flex: 1,
    },
    statsHeroNumber: {
      color: '#FFFFFF',
      fontSize: 36,
      lineHeight: 42,
      fontWeight: '900',
    },
    statsHeroLabel: {
      color: '#E2DCFF',
      fontSize: 12,
      marginTop: 1,
    },
    statsHeroPill: {
      alignSelf: 'flex-start',
      flexDirection: 'row',
      alignItems: 'center',
      gap: 5,
      marginTop: 11,
      borderRadius: 20,
      paddingHorizontal: 10,
      paddingVertical: 6,
      backgroundColor: 'rgba(255,255,255,0.15)',
    },
    statsHeroPillText: {
      color: '#FFFFFF',
      fontSize: 11,
      fontWeight: '700',
    },
    statsHeroFooter: {
      borderTopWidth: 1,
      borderTopColor: 'rgba(255,255,255,0.16)',
      marginTop: 18,
      paddingTop: 12,
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
    },
    statsHeroFooterText: {
      color: '#D8D0FF',
      fontSize: 11,
      fontWeight: '600',
    },
    statsSectionHeading: {
      flexDirection: 'row',
      alignItems: 'baseline',
      justifyContent: 'space-between',
      paddingHorizontal: 2,
      marginTop: 4,
    },
    statsSectionTitle: {
      color: colors.text,
      fontSize: 16,
      fontWeight: '800',
    },
    statsSectionHint: {
      color: colors.muted,
      fontSize: 11,
      marginTop: 4,
    },
    statsGrid: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: 10,
    },
    statTile: {
      width: '48%',
      minHeight: 126,
      flexGrow: 1,
      flexBasis: '44%',
      padding: 14,
      borderRadius: 20,
      borderWidth: 1,
      borderColor: colors.border,
      backgroundColor: dark ? 'rgba(29,36,53,0.82)' : 'rgba(255,255,255,0.88)',
    },
    statTileIcon: {
      width: 34,
      height: 34,
      borderRadius: 12,
      alignItems: 'center',
      justifyContent: 'center',
      marginBottom: 10,
    },
    statTileValue: {
      color: colors.text,
      fontSize: 23,
      fontWeight: '900',
      letterSpacing: -0.4,
    },
    statTileLabel: {
      color: colors.muted,
      fontSize: 11,
      fontWeight: '600',
      marginTop: 3,
    },
    statsPanel: {
      padding: 17,
      borderRadius: 22,
      borderWidth: 1,
      borderColor: colors.border,
      backgroundColor: dark ? 'rgba(29,36,53,0.82)' : 'rgba(255,255,255,0.88)',
    },
    statsPanelHeading: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      marginBottom: 17,
    },
    outcomeTrack: {
      height: 10,
      width: '100%',
      flexDirection: 'row',
      borderRadius: 99,
      overflow: 'hidden',
      backgroundColor: colors.border,
    },
    outcomeWin: {
      height: '100%',
      backgroundColor: colors.success,
    },
    outcomeLoss: {
      height: '100%',
      backgroundColor: colors.danger,
    },
    outcomeDraw: {
      height: '100%',
      backgroundColor: colors.muted,
    },
    outcomeLegend: {
      gap: 12,
      marginTop: 17,
    },
    outcomeLegendItem: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
    },
    outcomeDot: {
      width: 8,
      height: 8,
      borderRadius: 4,
    },
    outcomeLegendLabel: {
      color: colors.muted,
      fontSize: 12,
      flex: 1,
    },
    outcomeLegendValue: {
      color: colors.text,
      fontSize: 12,
      fontWeight: '800',
    },
    recentMatchRow: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingVertical: 11,
      borderTopWidth: 1,
      borderTopColor: colors.border,
      gap: 11,
    },
    recentMatchIcon: {
      width: 36,
      height: 36,
      borderRadius: 13,
      alignItems: 'center',
      justifyContent: 'center',
    },
    recentMatchCopy: {
      flex: 1,
    },
    recentMatchTitle: {
      color: colors.text,
      fontSize: 13,
      fontWeight: '700',
    },
    recentMatchMeta: {
      color: colors.muted,
      fontSize: 10,
      marginTop: 4,
    },
    recentMatchScore: {
      color: colors.text,
      fontSize: 12,
      fontWeight: '800',
    },
    statsRefresh: {
      alignSelf: 'center',
      flexDirection: 'row',
      alignItems: 'center',
      gap: 7,
      paddingHorizontal: 14,
      paddingVertical: 10,
      borderRadius: 16,
      backgroundColor: dark ? 'rgba(117,104,245,0.12)' : 'rgba(101,88,232,0.08)',
    },
    statsRefreshText: {
      color: colors.primary,
      fontSize: 12,
      fontWeight: '700',
    },
    rankResultCard: {
      marginTop: 14,
      padding: 16,
      borderRadius: 18,
      backgroundColor: '#F2EDFF',
      borderWidth: 1,
      borderColor: '#C9B8F5',
    },
    rankResultTitle: {
      fontSize: 14,
      fontWeight: '700',
      color: '#5940A8',
    },
    rankResultDelta: {
      marginTop: 8,
      fontSize: 28,
      fontWeight: '800',
      color: '#6848D8',
    },
    rankResultTier: {
      marginTop: 5,
      fontSize: 13,
      fontWeight: '600',
      color: '#625A78',
    },
    resultEmoji: {
      fontSize: 44,
      textAlign: 'center',
      marginBottom: 10,
    },
    cardTitle: {
      color: colors.text,
      fontSize: 19,
      fontWeight: '800',
      marginBottom: 8,
      textAlign: 'center',
    },
    bodyText: {
      color: colors.text,
      fontSize: 14,
      lineHeight: 22,
      marginVertical: 10,
    },
    scoreTitle: {
      color: colors.text,
      fontWeight: '800',
      fontSize: 15,
      marginTop: 18,
      marginBottom: 8,
    },
    scoreLine: {
      color: colors.text,
      fontSize: 14,
      paddingVertical: 6,
    },
    timer: {
      alignSelf: 'center',
      overflow: 'hidden',
      color: colors.primary,
      fontSize: 25,
      fontWeight: '900',
      textAlign: 'center',
      marginVertical: 13,
      paddingHorizontal: 22,
      paddingVertical: 10,
      borderRadius: 22,
      backgroundColor: dark ? 'rgba(117,104,245,0.16)' : 'rgba(101,88,232,0.09)',
    },
    questionText: {
      color: colors.text,
      fontSize: 19,
      fontWeight: '800',
      lineHeight: 27,
      marginVertical: 12,
    },
    option: {
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: dark ? 'rgba(39,48,73,0.62)' : 'rgba(246,247,253,0.92)',
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: 18,
      padding: 16,
      marginTop: 10,
      gap: 11,
    },
    selectedOption: {
      borderColor: colors.primary,
      backgroundColor: dark ? 'rgba(117,104,245,0.22)' : 'rgba(101,88,232,0.10)',
    },
    disabledOption: {
      opacity: 0.75,
    },
    optionLetter: {
      color: colors.primary,
      fontWeight: '900',
      fontSize: 15,
    },
    optionText: {
      color: colors.text,
      fontSize: 14,
      flex: 1,
    },
    actionButton: {
      backgroundColor: colors.primary,
      paddingVertical: 16,
      paddingHorizontal: 16,
      borderRadius: 18,
      alignItems: 'center',
      marginTop: 14,
      shadowColor: colors.primary,
      shadowOpacity: 0.24,
      shadowRadius: 13,
      shadowOffset: { width: 0, height: 6 },
      elevation: 4,
    },
    dangerButton: {
      backgroundColor: colors.danger,
    },
    disabledButton: {
      opacity: 0.45,
    },
    actionButtonText: {
      color: '#FFFFFF',
      fontWeight: '800',
      fontSize: 14,
    },
    errorBox: {
      marginHorizontal: 14,
      marginBottom: 8,
      backgroundColor: colors.card,
      borderColor: colors.danger,
      borderWidth: 1,
      borderRadius: 12,
      padding: 12,
    },
    dangerText: {
      color: colors.danger,
      fontSize: 13,
      fontWeight: '700',
      marginTop: 8,
    },
  });
}
