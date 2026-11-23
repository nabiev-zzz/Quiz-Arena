
import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';

import { useAuth } from '../context/AuthContext';

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

interface BattleScreenProps {
  isDark?: boolean;
  onBack?: () => void;
  initialSection?: Section;
}

const COLORS = {
  background: '#F4F6FB',
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
}: BattleScreenProps) {
  const { user, refreshUser } = useAuth();

  const [section, setSection] = useState<Section>(initialSection);
  const [mode, setMode] = useState<BattleMode>('casual');

  const [connected, setConnected] = useState(false);
  const [connecting, setConnecting] = useState(false);
  const [searching, setSearching] = useState(false);

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
  const [leaderboard, setLeaderboard] = useState<BattleLeaderboardEntry[]>([]);
  const [loadingData, setLoadingData] = useState(false);

  const socketRef = useRef<BattleSocket | null>(null);
  const matchIdRef = useRef<string | null>(null);
  const modeRef = useRef<BattleMode>('casual');
  const questionIndexRef = useRef<number | null>(null);

  const dark = isDark;

  const colors = {
    background: dark ? '#111522' : COLORS.background,
    card: dark ? '#1D2435' : COLORS.card,
    text: dark ? '#F3F5FC' : COLORS.text,
    muted: dark ? '#A1ABC0' : COLORS.muted,
    primary: '#7568F5',
    border: dark ? '#30394E' : COLORS.border,
    success: COLORS.success,
    danger: COLORS.danger,
  };

  const styles = makeStyles(colors);

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

  const loadSectionData = useCallback(async (target: Section) => {
    if (target === 'battle') return;

    setLoadingData(true);
    setError('');

    try {
      if (target === 'history') {
        const data = await getBattleHistory(30);
        setHistory(Array.isArray(data) ? data : []);
      } else if (target === 'stats') {
        const data = await getBattleStats();
        setStats(data);
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

        socket.on('battle:matched', (data: BattleMatched) => {
          matchIdRef.current = data.matchId;
          setMatch(data);
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
          setError(data.message || 'Battlega qayta ulanib bo‘lmadi.');
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
      setError('Serverga ulanish kutilmoqda. Birozdan so‘ng urinib ko‘ring.');
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

    Alert.alert(
      'Battle dan chiqish',
      'Haqiqatan ham joriy Battle ni bekor qilmoqchimisiz?',
      [
        { text: 'Yo‘q', style: 'cancel' },
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
          <Text style={styles.resultEmoji}>
            {finished.draw ? '🤝' : '🏆'}
          </Text>
          <Text style={styles.cardTitle}>{title}</Text>
          <Text style={styles.muted}>Xona: {finished.roomCode}</Text>

          {myRankChange ? (
            <View style={styles.rankResultCard}>
              <Text style={styles.rankResultTitle}>
                RANK NATIJASI
              </Text>
              <Text style={[
                styles.rankResultDelta,
                { color: myRankChange.delta >= 0 ? '#22C55E' : '#F87171' },
              ]}>
                {myRankChange.delta > 0 ? '+' : ''}
                {myRankChange.delta} RP
              </Text>
              <Text style={styles.rankResultTier}>
                {myRankChange.rankTier} · {myRankChange.rankPoints} RP
              </Text>
            </View>
          ) : null}

          <Text style={styles.scoreTitle}>Yakuniy hisob</Text>
          {Object.entries(finished.scores || {}).map(([id, score]) => (
            <Text key={id} style={styles.scoreLine}>
              {match?.players.find((player) => player.id === id)?.username ||
                `O‘yinchi ${id.slice(0, 6)}`}
              {' — '}
              {score} ball
            </Text>
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
          <Text style={styles.cardTitle}>
            {correct ? 'To‘g‘ri javob!' : 'Keyingi safar omad!'}
          </Text>
          <Text style={styles.muted}>
            To‘g‘ri javob: {result.correctAnswer + 1}-variant
          </Text>
          <Text style={styles.bodyText}>{result.explanation}</Text>

          <Text style={styles.scoreTitle}>Joriy hisob</Text>
          {Object.entries(result.scores || {}).map(([id, score]) => (
            <Text key={id} style={styles.scoreLine}>
              {match?.players.find((player) => player.id === id)?.username ||
                `O‘yinchi ${id.slice(0, 6)}`}
              {' — '}
              {score} ball
            </Text>
          ))}
          {readyForNext ? (
            <Text style={styles.muted}>
              {readyCount >= 2
                ? "Ikkala o‘yinchi tayyor. Keyingi savol yuklanmoqda..."
                : "Siz tayyorsiz. Raqib kutilmoqda..."}
            </Text>
          ) : (
            <ActionButton
              title="Keyingi savol"
              onPress={markReadyForNext}
              styles={styles}
            />
          )}
          <Text style={styles.muted}>
            Tayyor o'yinchilar: {readyCount}/2
          </Text>
        </View>
      );
    }

    if (question) {
      return (
        <View style={styles.card}>
          <Text style={styles.muted}>
            Savol {question.questionIndex + 1} / {question.totalQuestions}
          </Text>

          <Text style={styles.timer}>
            {remaining} soniya
          </Text>

          <Text style={styles.questionText}>{question.question}</Text>

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
                <Text style={styles.optionLetter}>
                  {String.fromCharCode(65 + index)}.
                </Text>
                <Text style={styles.optionText}>{option}</Text>
                {selected ? (
                  <Text style={styles.optionLetter}>✓</Text>
                ) : null}
              </Pressable>
            );
          })}

          {answerAccepted ? (
            <Text style={styles.muted}>Javobingiz qabul qilindi.</Text>
          ) : remaining <= 0 ? (
            <Text style={styles.dangerText}>Vaqt tugadi.</Text>
          ) : null}

          {(answerAccepted || remaining <= 0) ? (
            readyForNext ? (
              <Text style={styles.muted}>
                {readyCount >= 2
                  ? "Ikkala o‘yinchi tayyor. Keyingi savol yuklanmoqda..."
                  : "Siz tayyorsiz. Raqib javob berishi yoki vaqt tugashini kuting."}
              </Text>
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
          <Text style={styles.resultEmoji}>✅</Text>
          <Text style={styles.cardTitle}>
            {started ? 'Battle boshlandi!' : 'Raqib topildi!'}
          </Text>

          <Text style={styles.muted}>
            Xona: {started?.roomCode || match?.roomCode}
          </Text>

          {(started?.players || match?.players || []).map((player) => (
            <Text key={player.id} style={styles.scoreLine}>
              {player.username}
            </Text>
          ))}

          <ActivityIndicator
            size="large"
            color={colors.primary}
            style={{ marginTop: 20 }}
          />
          <Text style={styles.muted}>Savol kutilmoqda...</Text>

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
          <Text style={styles.cardTitle}>Raqib qidirilmoqda...</Text>
          <Text style={styles.muted}>
            {mode === 'ranked' ? 'Ranked rejimi' : 'Casual rejimi'}
          </Text>
          <ActionButton
            title="Qidirishni bekor qilish"
            onPress={cancelQueue}
            styles={styles}
            danger
          />
        </View>
      );
    }

    return (
      <View style={styles.card}>
        <Text style={styles.resultEmoji}>✅</Text>
        <Text style={styles.cardTitle}>1 ga 1 Battle</Text>
        <Text style={styles.bodyText}>
          Boshqa o‘yinchi bilan real vaqt rejimida bilim sinovi.
          Har bir savol uchun 20 soniya vaqt beriladi.
        </Text>

        <Text style={styles.scoreTitle}>O‘yin rejimini tanlang</Text>

        <ActionButton
          title="Casual — oddiy o‘yin"
          onPress={() => joinQueue('casual')}
          styles={styles}
          disabled={!connected || connecting}
        />

        <ActionButton
          title="Ranked — reyting uchun"
          onPress={() => joinQueue('ranked')}
          styles={styles}
          disabled={!connected || connecting}
        />

        <Text style={styles.muted}>
          {connecting
            ? 'Serverga ulanmoqda...'
            : connected
              ? 'Serverga ulangan'
              : 'Server bilan aloqa kutilmoqda'}
        </Text>
      </View>
    );
  }

  function renderHistory() {
    if (loadingData) {
      return <ActivityIndicator color={colors.primary} />;
    }

    if (!history.length) {
      return <Text style={styles.muted}>Battle tarixi hozircha yo‘q.</Text>;
    }

    return history.map((item) => (
      <View key={item.id} style={styles.listCard}>
        <Text style={styles.cardTitle}>
          {item.mode === 'ranked' ? 'Ranked' : 'Casual'} · {item.roomCode}
        </Text>
        <Text style={styles.muted}>
          Holati: {item.status} · {new Date(item.createdAt).toLocaleString()}
        </Text>
        <Text style={styles.bodyText}>
          {item.winnerId ? `G‘olib ID: ${item.winnerId}` : 'G‘olib: aniqlanmagan'}
        </Text>
      </View>
    ));
  }

  function renderStats() {
    if (loadingData) {
      return <ActivityIndicator color={colors.primary} />;
    }

    if (!stats) {
      return <Text style={styles.muted}>Statistika topilmadi.</Text>;
    }

    const entries = Object.entries(stats).filter(
      ([, value]) =>
        typeof value === 'string' ||
        typeof value === 'number' ||
        typeof value === 'boolean',
    );

    return (
      <View style={styles.card}>
        <Text style={styles.cardTitle}>Battle statistikasi</Text>
        {entries.map(([key, value]) => (
          <Text key={key} style={styles.scoreLine}>
            {key}: {String(value)}
          </Text>
        ))}
      </View>
    );
  }

  function renderLeaderboard() {
    if (loadingData) {
      return <ActivityIndicator color={colors.primary} />;
    }

    if (!leaderboard.length) {
      return <Text style={styles.muted}>Reyting hozircha bo'sh.</Text>;
    }

    return leaderboard.map((player, index) => {
      const rankPoints = Math.max(0, Number(player.rankPoints ?? 0));
      const rankTier =
        player.rankTier ||
        (rankPoints >= 1400 ? 'Grandmaster' :
        rankPoints >= 1100 ? 'Master' :
        rankPoints >= 800 ? 'Diamond' :
        rankPoints >= 600 ? 'Platinum' :
        rankPoints >= 400 ? 'Gold' :
        rankPoints >= 200 ? 'Silver' : 'Bronze');

      return (
        <View key={player.userId || String(index)} style={styles.listCard}>
          <Text style={styles.cardTitle}>
            #{player.rank ?? index + 1} {player.username}
          </Text>
          <Text style={styles.rankResultTier}>
            {rankTier} · {rankPoints} RP
          </Text>
          <Text style={styles.bodyText}>
            G'alaba: {player.wins} · Mag'lubiyat: {player.losses} ·
            Durang: {player.draws}
          </Text>
          <Text style={styles.muted}>Battle ball: {player.points}</Text>
        </View>
      );
    });
  }

  return (
    <View style={styles.screen}>
      <View style={styles.header}>
        {onBack ? (
          <Pressable onPress={onBack} style={styles.backButton}>
            <Text style={styles.backText}>‹</Text>
          </Pressable>
        ) : null}
        <View style={{ flex: 1 }}>
          <Text style={styles.heading}>Battle Arena</Text>
          <Text style={styles.muted}>
            {connected ? '● Ulangan' : '○ Ulanmagan'}
          </Text>
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
            <Text
              style={[
                styles.tabText,
                section === value && styles.activeTabText,
              ]}
            >
              {label}
            </Text>
          </Pressable>
        ))}
      </View>

      {!!error && (
        <View style={styles.errorBox}>
          <Text style={styles.dangerText}>{error}</Text>
        </View>
      )}

      <ScrollView
        style={styles.content}
        contentContainerStyle={styles.contentInner}
        showsVerticalScrollIndicator={false}
      >
        {section === 'battle' && renderBattle()}
        {section === 'history' && renderHistory()}
        {section === 'stats' && renderStats()}
        {section === 'leaderboard' && renderLeaderboard()}
      </ScrollView>
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
      <Text style={styles.actionButtonText}>{title}</Text>
    </Pressable>
  );
}

function makeStyles(colors: typeof COLORS) {
  return StyleSheet.create({
    screen: {
      flex: 1,
      backgroundColor: colors.background,
    },
    header: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingHorizontal: 18,
      paddingTop: 14,
      paddingBottom: 12,
      gap: 12,
    },
    backButton: {
      width: 44,
      height: 44,
      borderRadius: 14,
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
      fontSize: 22,
      fontWeight: '800',
      letterSpacing: -0.3,
    },
    muted: {
      color: colors.muted,
      fontSize: 13,
      marginTop: 5,
    },
    tabs: {
      flexDirection: 'row',
      marginHorizontal: 14,
      marginBottom: 14,
      backgroundColor: colors.card,
      borderRadius: 15,
      padding: 4,
      gap: 2,
    },
    tab: {
      flex: 1,
      minWidth: 0,
      minHeight: 43,
      alignItems: 'center',
      justifyContent: 'center',
      paddingHorizontal: 3,
      paddingVertical: 8,
      borderRadius: 11,
    },
    activeTab: {
      backgroundColor: colors.primary,
    },
    tabText: {
      color: colors.muted,
      fontSize: 10,
      fontWeight: '700',
      textAlign: 'center',
    },
    activeTabText: {
      color: '#FFFFFF',
    },
    content: {
      flex: 1,
    },
    contentInner: {
      paddingHorizontal: 16,
      paddingTop: 8,
      paddingBottom: 36,
      gap: 12,
    },
    card: {
      backgroundColor: colors.card,
      borderRadius: 22,
      padding: 18,
      alignItems: 'stretch',
      borderWidth: 1,
      borderColor: colors.border,
    },
    listCard: {
      backgroundColor: colors.card,
      borderRadius: 18,
      padding: 16,
      borderWidth: 1,
      borderColor: colors.border,
      marginBottom: 10,
    },
    rankResultCard: {
      marginTop: 14,
      padding: 16,
      borderRadius: 18,
      backgroundColor: dark ? '#28213F' : '#F2EDFF',
      borderWidth: 1,
      borderColor: dark ? '#514078' : '#C9B8F5',
    },
    rankResultTitle: {
      fontSize: 14,
      fontWeight: '700',
      color: dark ? '#D6C9FF' : '#5940A8',
    },
    rankResultDelta: {
      marginTop: 8,
      fontSize: 28,
      fontWeight: '800',
      color: colors.primary,
    },
    rankResultTier: {
      marginTop: 5,
      fontSize: 13,
      fontWeight: '600',
      color: dark ? '#C0B8D3' : '#625A78',
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
      color: colors.primary,
      fontSize: 27,
      fontWeight: '900',
      textAlign: 'center',
      marginVertical: 12,
    },
    questionText: {
      color: colors.text,
      fontSize: 19,
      fontWeight: '800',
      lineHeight: 27,
      marginVertical: 12,
    },
    option: {
      minHeight: 58,
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: colors.background,
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: 15,
      paddingHorizontal: 15,
      paddingVertical: 13,
      marginTop: 9,
      gap: 10,
    },
    selectedOption: {
      borderColor: colors.primary,
      backgroundColor: colors.primary + '20',
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
      minHeight: 52,
      backgroundColor: colors.primary,
      paddingVertical: 14,
      paddingHorizontal: 16,
      borderRadius: 15,
      alignItems: 'center',
      justifyContent: 'center',
      marginTop: 12,
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
