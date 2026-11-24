
import { useCallback, useEffect, useRef, useState } from 'react';
import Animated, {
  useAnimatedScrollHandler,
  useSharedValue,
  withSpring,
  type SharedValue,
} from 'react-native-reanimated';
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';

import {
  generateQuestions,
  type Question,
} from '../data/questions';
import type { Difficulty, Subject, Topic } from '../types';
import { API_BASE_URL } from '../config/api';
import { useTheme } from '../theme/ThemeContext';
import { saveLearningAttempt } from '../services/learningService';

interface QuizScreenProps {
  subject: Subject;
  topic: Topic;
  onBack: () => void;
  dockStretch?: SharedValue<number>;
}

export default function QuizScreen({
  subject,
  topic,
  onBack,
  dockStretch,
}: QuizScreenProps) {
  const { tokens } = useTheme();
  const colors = tokens.colors;
  const styles = makeStyles(colors);
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

  const [questions, setQuestions] = useState<Question[]>([]);
  const [selectedCount, setSelectedCount] = useState(Math.min(10, topic.questionCount));
  const [selectedDifficulty, setSelectedDifficulty] = useState<Difficulty>(topic.difficulty);
  const [selectedLanguage, setSelectedLanguage] = useState<'uz' | 'ru' | 'en'>('uz');
  const [currentIndex, setCurrentIndex] = useState(0);
  const [selectedAnswer, setSelectedAnswer] = useState<number | null>(null);
  const [score, setScore] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [savingAttempt, setSavingAttempt] = useState(false);
  const [attemptSaved, setAttemptSaved] = useState(false);
  const [attemptSaveError, setAttemptSaveError] = useState(false);
  const savedAttemptKey = useRef<string | null>(null);

  const loadQuestions = useCallback(async () => {
    savedAttemptKey.current = null;
    setAttemptSaved(false);
    setAttemptSaveError(false);
    setLoading(true);
    setError('');

    try {
      const totalCount = selectedCount;
      const batchSize = 20;
      const allQuestions: Question[] = [];

      const batchCount = Math.ceil(totalCount / batchSize);

      for (let i = 0; i < batchCount; i++) {
        const count = Math.min(
          batchSize,
          totalCount - allQuestions.length,
        );

        const result = await generateQuestions(API_BASE_URL, {
          subjectId: subject.id,
          topicId: topic.id,
          count,
          difficulty: selectedDifficulty,
          language: selectedLanguage,
        });

        if (result.length !== count) {
          throw new Error(
            `AI ${count} ta savol o'rniga ${result.length} ta savol yaratdi. Qayta urinib ko'ring.`,
          );
        }

        allQuestions.push(...result);
      }

      setQuestions(allQuestions);
      setCurrentIndex(0);
      setSelectedAnswer(null);
      setScore(0);
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : 'Savollarni yuklashda xatolik yuz berdi.',
      );
    } finally {
      setLoading(false);
    }
  }, [
    subject.id,
    topic.id,
    selectedCount,
    selectedDifficulty,
    selectedLanguage,
  ]);

  const countOptions = Array.from(new Set([5, 10, 15, 20, topic.questionCount])).filter((count) => count <= topic.questionCount).sort((a, b) => a - b);

  const currentQuestion = questions[currentIndex];
  const finished = questions.length > 0 && currentIndex >= questions.length;

  const saveFinishedAttempt = useCallback(async () => {
    if (!finished || questions.length === 0) return;

    const attemptKey = [
      subject.id,
      topic.id,
      questions[0]?.id ?? 'quiz',
      questions.length,
      score,
    ].join(':');

    if (savedAttemptKey.current === attemptKey) return;
    savedAttemptKey.current = attemptKey;
    setSavingAttempt(true);
    setAttemptSaveError(false);

    try {
      await saveLearningAttempt({
        subjectId: subject.id,
        subjectName: subject.name,
        topicId: topic.id,
        topicName: topic.name,
        totalQuestions: questions.length,
        correctAnswers: score,
      });
      setAttemptSaved(true);
    } catch {
      savedAttemptKey.current = null;
      setAttemptSaveError(true);
    } finally {
      setSavingAttempt(false);
    }
  }, [finished, questions, score, subject.id, subject.name, topic.id, topic.name]);

  useEffect(() => {
    if (finished) void saveFinishedAttempt();
  }, [finished, saveFinishedAttempt]);

  const chooseAnswer = (index: number) => {
    if (selectedAnswer !== null || !currentQuestion) return;

    setSelectedAnswer(index);

    if (index === currentQuestion.correctAnswer) {
      setScore((previous) => previous + 1);
    }
  };

  const nextQuestion = () => {
    setSelectedAnswer(null);
    setCurrentIndex((previous) => previous + 1);
  };

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color={colors.primary} />
        <Text style={styles.loadingText}>
          AI Ustoz savollar tayyorlamoqda...
        </Text>
        <Text style={styles.muted}>Bir necha soniya kuting</Text>
      </View>
    );
  }

  if (error) {
    return (
      <View style={styles.center}>
        <Text style={styles.errorTitle}>Xatolik yuz berdi</Text>
        <Text style={styles.muted}>{error}</Text>

        <Pressable
          style={styles.primaryButton}
          onPress={() => void loadQuestions()}
        >
          <Text style={styles.buttonText}>Qayta urinish</Text>
        </Pressable>

        <Pressable onPress={onBack} style={styles.backButton}>
          <Text style={styles.backText}>Orqaga</Text>
        </Pressable>
      </View>
    );
  }

  if (finished) {
    return (
      <View style={styles.center}>
        <Text style={styles.resultEmoji}>🏆</Text>
        <Text style={styles.title}>Test yakunlandi!</Text>
        <Text style={styles.score}>
          {score} / {questions.length}
        </Text>
        <Text style={styles.muted}>To‘g‘ri javoblar soni · {Math.round((score / questions.length) * 100)}% aniqlik</Text>

        {savingAttempt ? (
          <Text style={styles.muted}>Natija statistika uchun saqlanmoqda...</Text>
        ) : attemptSaved ? (
          <Text style={styles.savedAttemptText}>✓ Natija statistikaga qo‘shildi</Text>
        ) : attemptSaveError ? (
          <Pressable onPress={() => void saveFinishedAttempt()}>
            <Text style={styles.retryAttemptText}>Natija saqlanmadi. Qayta urinish</Text>
          </Pressable>
        ) : null}

        <Pressable
          style={styles.primaryButton}
          onPress={() => void loadQuestions()}
        >
          <Text style={styles.buttonText}>Yangi test yaratish</Text>
        </Pressable>

        <Pressable onPress={onBack} style={styles.backButton}>
          <Text style={styles.backText}>Mavzularga qaytish</Text>
        </Pressable>
      </View>
    );
  }

  if (questions.length === 0) {
    return (
      <Animated.ScrollView onScroll={dockScrollHandler} scrollEventThrottle={16} style={styles.container} contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <Pressable onPress={onBack} style={styles.backButton}><Text style={styles.backText}>‹ Mavzularga qaytish</Text></Pressable>
        <Text style={styles.eyebrow}>{subject.name.toUpperCase()}</Text>
        <Text style={styles.title}>{topic.name}</Text>
        <Text style={styles.setupDescription}>Testni o‘zingizga moslang. AI tanlangan sozlamalar asosida yangi savollar tayyorlaydi.</Text>
        <View style={styles.setupCard}>
          <Text style={styles.setupLabel}>SAVOLLAR SONI</Text>
          <View style={styles.choiceRow}>{countOptions.map((count) => <Pressable key={count} onPress={() => setSelectedCount(count)} style={[styles.choiceChip, selectedCount === count && styles.selectedChoiceChip]}><Text style={[styles.choiceText, selectedCount === count && styles.selectedChoiceText]}>{count === topic.questionCount ? `${count} · Barchasi` : String(count)}</Text></Pressable>)}</View>
          <Text style={styles.setupLabel}>QIYINLIK DARAJASI</Text>
          <View style={styles.choiceRow}>{([{ value: 'easy', label: 'Oson' }, { value: 'medium', label: 'O‘rta' }, { value: 'hard', label: 'Qiyin' }, { value: 'expert', label: 'Ekspert' }] as const).map((item) => <Pressable key={item.value} onPress={() => setSelectedDifficulty(item.value)} style={[styles.choiceChip, selectedDifficulty === item.value && styles.selectedChoiceChip]}><Text style={[styles.choiceText, selectedDifficulty === item.value && styles.selectedChoiceText]}>{item.label}</Text></Pressable>)}</View>
          <Text style={styles.setupLabel}>TEST TILI</Text>
          <View style={styles.choiceRow}>{([{ value: 'uz', label: 'O‘zbekcha' }, { value: 'ru', label: 'Русский' }, { value: 'en', label: 'English' }] as const).map((item) => <Pressable key={item.value} onPress={() => setSelectedLanguage(item.value)} style={[styles.choiceChip, selectedLanguage === item.value && styles.selectedChoiceChip]}><Text style={[styles.choiceText, selectedLanguage === item.value && styles.selectedChoiceText]}>{item.label}</Text></Pressable>)}</View>
        </View>
        <View style={styles.setupNote}><Text style={styles.setupNoteTitle}>AI Ustoz nimalar qiladi?</Text><Text style={styles.setupNoteText}>Mavzuga mos savollar yaratadi, har bir javobdan keyin to‘g‘ri javobni va tushuntirishni ko‘rsatadi. Yakuniy natija profilingiz statistikasiga saqlanadi.</Text></View>
        <Pressable style={styles.primaryButton} onPress={() => void loadQuestions()}><Text style={styles.buttonText}>Testni boshlash</Text></Pressable>
      </Animated.ScrollView>
    );
  }

  if (!currentQuestion) return null;

  return (
    <Animated.ScrollView
      onScroll={dockScrollHandler}
      scrollEventThrottle={16}
      style={styles.container}
      contentContainerStyle={styles.content}
    >
      <Pressable onPress={onBack} style={styles.backButton}>
        <Text style={styles.backText}>‹ Orqaga</Text>
      </Pressable>

      <Text style={styles.eyebrow}>{subject.name.toUpperCase()}</Text>
      <Text style={styles.title}>{topic.name}</Text>

      <View style={styles.progressCard}>
        <Text style={styles.muted}>
          Savol {currentIndex + 1} / {questions.length}
        </Text>
        <View style={styles.progressBackground}>
          <View
            style={[
              styles.progressFill,
              { width: `${((currentIndex + 1) / questions.length) * 100}%` },
            ]}
          />
        </View>
      </View>

      <View style={styles.questionCard}>
        <Text style={styles.questionLabel}>SAVOL</Text>
        <Text style={styles.questionText}>
          {currentQuestion.question}
        </Text>
      </View>

      <Text style={styles.sectionTitle}>Javobni tanlang</Text>

      {currentQuestion.options.map((option, index) => {
        const isCorrect = index === currentQuestion.correctAnswer;
        const isSelected = index === selectedAnswer;

        return (
          <Pressable
            key={`${currentQuestion.id}-${index}`}
            style={[
              styles.option,
              selectedAnswer !== null && isCorrect && styles.correctOption,
              isSelected && !isCorrect && styles.wrongOption,
            ]}
            onPress={() => chooseAnswer(index)}
            disabled={selectedAnswer !== null}
          >
            <Text style={styles.optionLetter}>
              {String.fromCharCode(65 + index)}
            </Text>
            <Text style={styles.optionText}>{option}</Text>
          </Pressable>
        );
      })}

      {selectedAnswer !== null && (
        <View style={styles.explanationCard}>
          <Text style={styles.explanationTitle}>
            {selectedAnswer === currentQuestion.correctAnswer
              ? 'To‘g‘ri javob!'
              : 'Noto‘g‘ri javob'}
          </Text>

          <Text style={styles.explanationText}>
            {currentQuestion.explanation}
          </Text>

          <Pressable style={styles.primaryButton} onPress={nextQuestion}>
            <Text style={styles.buttonText}>
              {currentIndex === questions.length - 1
                ? 'Natijani ko‘rish'
                : 'Keyingi savol'}
            </Text>
          </Pressable>
        </View>
      )}

      <Text style={styles.scoreText}>Joriy ball: {score}</Text>
    </Animated.ScrollView>
  );
}

function makeStyles(colors: ReturnType<typeof useTheme>['tokens']['colors']) {
  return StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  content: {
    paddingHorizontal: 18,
    paddingTop: 8,
    paddingBottom: 128,
  },
  center: {
    flex: 1,
    minHeight: 450,
    backgroundColor: colors.background,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 25,
    gap: 14,
  },
  savedAttemptText: {
    color: '#159B68',
    fontSize: 12,
    fontWeight: '700',
    marginTop: 4,
  },
  retryAttemptText: {
    color: colors.primary,
    fontSize: 12,
    fontWeight: '700',
    marginTop: 4,
    textAlign: 'center',
  },
  setupDescription: { color: colors.textMuted, fontSize: 14, lineHeight: 21, marginBottom: 18 },
  setupCard: { backgroundColor: colors.surface, borderRadius: 20, borderWidth: 1, borderColor: colors.border, padding: 16, gap: 12 },
  setupLabel: { color: colors.textMuted, fontSize: 10, fontWeight: '800', letterSpacing: 1.1, marginTop: 5 },
  choiceRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 5 },
  choiceChip: { minHeight: 38, justifyContent: 'center', paddingHorizontal: 12, borderRadius: 12, borderWidth: 1, borderColor: colors.borderStrong, backgroundColor: colors.surfaceElevated },
  selectedChoiceChip: { borderColor: colors.primary, backgroundColor: colors.primary + '22' },
  choiceText: { color: colors.textSecondary, fontSize: 12, fontWeight: '700' },
  selectedChoiceText: { color: colors.primary },
  setupNote: { padding: 16, marginTop: 14, borderRadius: 17, backgroundColor: colors.surfaceElevated },
  setupNoteTitle: { color: colors.text, fontSize: 14, fontWeight: '800', marginBottom: 7 },
  setupNoteText: { color: colors.textSecondary, fontSize: 12, lineHeight: 19 },
  loadingText: {
    color: colors.text,
    fontSize: 17,
    fontWeight: '700',
  },
  muted: {
    color: colors.textMuted,
    fontSize: 13,
    textAlign: 'center',
  },
  eyebrow: {
    color: colors.primary,
    fontSize: 12,
    fontWeight: '800',
    marginBottom: 8,
  },
  title: {
    color: colors.text,
    fontSize: 25,
    fontWeight: '800',
    marginBottom: 20,
  },
  backButton: {
    minHeight: 44,
    justifyContent: 'center',
    paddingVertical: 8,
    alignSelf: 'flex-start',
  },
  backText: {
    color: colors.primary,
    fontWeight: '700',
    fontSize: 14,
  },
  progressCard: {
    backgroundColor: colors.surface,
    minHeight: 66,
    padding: 16,
    borderRadius: 17,
    marginBottom: 16,
  },
  progressBackground: {
    height: 7,
    backgroundColor: colors.borderStrong,
    borderRadius: 10,
    marginTop: 12,
    overflow: 'hidden',
  },
  progressFill: {
    height: 7,
    backgroundColor: colors.primary,
    borderRadius: 10,
  },
  questionCard: {
    minHeight: 138,
    backgroundColor: colors.surface,
    borderRadius: 21,
    padding: 20,
    marginBottom: 20,
    justifyContent: 'center',
  },
  questionLabel: {
    color: colors.primary,
    fontSize: 11,
    fontWeight: '800',
    marginBottom: 12,
  },
  questionText: {
    color: colors.text,
    fontSize: 18,
    fontWeight: '700',
    lineHeight: 27,
  },
  sectionTitle: {
    color: colors.text,
    fontSize: 16,
    fontWeight: '700',
    marginBottom: 12,
  },
  option: {
    minHeight: 58,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.borderStrong,
    borderRadius: 16,
    paddingHorizontal: 16,
    paddingVertical: 13,
    marginBottom: 10,
  },
  optionLetter: {
    color: colors.primary,
    fontWeight: '800',
    marginRight: 13,
  },
  optionText: {
    color: colors.text,
    flex: 1,
    fontSize: 14,
    lineHeight: 20,
  },
  correctOption: {
    borderColor: '#36C98F',
    backgroundColor: colors.successSurface,
  },
  wrongOption: {
    borderColor: '#F06B78',
    backgroundColor: colors.dangerSurface,
  },
  explanationCard: {
    backgroundColor: colors.surfaceElevated,
    borderRadius: 16,
    padding: 17,
    marginTop: 12,
  },
  explanationTitle: {
    color: colors.primary,
    fontWeight: '800',
    fontSize: 16,
    marginBottom: 9,
  },
  explanationText: {
    color: colors.text,
    fontSize: 14,
    lineHeight: 22,
  },
  primaryButton: {
    minHeight: 52,
    backgroundColor: '#7657E8',
    paddingHorizontal: 18,
    paddingVertical: 14,
    borderRadius: 15,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 18,
  },
  buttonText: {
    color: '#FFFFFF',
    fontWeight: '800',
  },
  scoreText: {
    color: colors.primary,
    textAlign: 'center',
    marginTop: 20,
    fontWeight: '700',
  },
  score: {
    color: colors.primary,
    fontSize: 45,
    fontWeight: '900',
  },
  resultEmoji: {
    fontSize: 55,
  },
  errorTitle: {
    color: colors.danger,
    fontSize: 20,
    fontWeight: '800',
  },
  });
}
