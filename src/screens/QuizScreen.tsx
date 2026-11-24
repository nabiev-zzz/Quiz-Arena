import { LocalizedText } from '../i18n/LocalizedText';

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
  Text as NativeText,
  View,
} from 'react-native';

import type { Question } from '../data/questions';
import type { Difficulty, Subject, Topic } from '../types';
import { useTheme } from '../theme/ThemeContext';
import { getTopicQuestions, saveLearningAttempt, updateLearningAttemptReview } from '../services/learningService';
import { sendTutorMessage } from '../services/aiTutorService';

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
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [savingAttempt, setSavingAttempt] = useState(false);
  const [attemptSaved, setAttemptSaved] = useState(false);
  const [attemptSaveError, setAttemptSaveError] = useState(false);
  const [attemptId, setAttemptId] = useState<string | null>(null);
  const [showQuestionReview, setShowQuestionReview] = useState(false);
  const [answers, setAnswers] = useState<Array<number | null>>([]);
  const [explainingQuestionIds, setExplainingQuestionIds] = useState<Record<string, boolean>>({});
  const [aiExplanations, setAiExplanations] = useState<Record<string, string>>({});
  const savedAttemptKey = useRef<string | null>(null);
  const reviewSyncQueue = useRef<Promise<void>>(Promise.resolve());

  const loadQuestions = useCallback(async () => {
    savedAttemptKey.current = null;
    setAttemptId(null);
    setShowQuestionReview(false);
    setAttemptSaved(false);
    setAttemptSaveError(false);
    setLoading(true);
    setError('');

    try {
      const result = await getTopicQuestions({
        subjectId: subject.id,
        topicId: topic.id,
        count: selectedCount,
        difficulty: selectedDifficulty,
        language: selectedLanguage,
      });
      const allQuestions = result;

      if (allQuestions.length !== selectedCount) {
        throw new Error(`Bazadan ${selectedCount} ta savol o‘rniga ${allQuestions.length} ta savol olindi.`);
      }

      setQuestions(allQuestions);
      setAnswers(Array(allQuestions.length).fill(null));
      setAiExplanations({});
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
      const saved = await saveLearningAttempt({
        subjectId: subject.id,
        subjectName: subject.name,
        topicId: topic.id,
        topicName: topic.name,
        totalQuestions: questions.length,
        correctAnswers: score,
        review: questions.map((question, index) => ({
          id: question.id,
          question: question.question,
          options: question.options,
          selectedAnswer: answers[index] ?? question.correctAnswer,
          correctAnswer: question.correctAnswer,
          isCorrect: answers[index] === question.correctAnswer,
          explanation: question.explanation || '',
          aiExplanation: aiExplanations[question.id] || '',
        })),
      });
      setAttemptId(saved.id);
      setAttemptSaved(true);
    } catch {
      savedAttemptKey.current = null;
      setAttemptSaveError(true);
    } finally {
      setSavingAttempt(false);
    }
  }, [finished, questions, answers, aiExplanations, score, subject.id, subject.name, topic.id, topic.name]);

  useEffect(() => {
    if (finished) void saveFinishedAttempt();
  }, [finished, saveFinishedAttempt]);

  useEffect(() => {
    if (!attemptId || questions.length === 0) return;
    const review = questions.map((question, index) => ({
      id: question.id,
      question: question.question,
      options: question.options,
      selectedAnswer: answers[index] ?? question.correctAnswer,
      correctAnswer: question.correctAnswer,
      isCorrect: answers[index] === question.correctAnswer,
      explanation: question.explanation || '',
      aiExplanation: aiExplanations[question.id] || '',
    }));
    reviewSyncQueue.current = reviewSyncQueue.current
      .catch(() => undefined)
      .then(async () => { await updateLearningAttemptReview(attemptId, review); })
      .catch(() => undefined);
  }, [attemptId, questions, answers, aiExplanations]);

  const chooseAnswer = (index: number) => {
    if (selectedAnswer !== null || !currentQuestion) return;

    setSelectedAnswer(index);
    setAnswers((previous) => {
      const next = [...previous];
      next[currentIndex] = index;
      return next;
    });

    if (index === currentQuestion.correctAnswer) {
      setScore((previous) => previous + 1);
    }
  };

  const explainQuestionWithAi = async (question: Question, questionIndex: number) => {
    if (explainingQuestionIds[question.id]) return;
    const selected = answers[questionIndex];
    if (selected === null || selected === undefined) return;
    setExplainingQuestionIds((previous) => ({ ...previous, [question.id]: true }));
    try {
      const prompt = [
        `Men ${subject.name} fanining ${topic.name} mavzusidagi testni tugatdim.`,
        `Savol: ${question.question}`,
        `Variantlar: ${question.options.map((option, index) => `${String.fromCharCode(65 + index)}. ${option}`).join(' | ')}`,
        `Mening javobim: ${question.options[selected]}`,
        `To‘g‘ri javob: ${question.options[question.correctAnswer]}`,
        `Test bazasidagi izoh: ${question.explanation || 'Berilmagan'}`,
        'Iltimos, aynan shu savolni sodda o‘zbek tilida bosqichma-bosqich tushuntir. Nima uchun mening javobim xato bo‘lganini ayt, to‘g‘ri javobni asosla va bitta yangi o‘xshash misol yechib ko‘rsat. Boshqa savollarni taxmin qilma.',
      ].join('\n');
      const result = await sendTutorMessage(prompt);
      setAiExplanations((previous) => ({ ...previous, [question.id]: result.assistantMessage.content }));
    } catch (err) {
      setAiExplanations((previous) => ({ ...previous, [question.id]: err instanceof Error ? err.message : 'AI Ustoz bilan bog‘lanib bo‘lmadi. Qayta urinib ko‘ring.' }));
    } finally {
      setExplainingQuestionIds((previous) => ({ ...previous, [question.id]: false }));
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
        <LocalizedText style={styles.loadingText}>
          Mavzuning testlari yuklanmoqda...
        </LocalizedText>
        <LocalizedText style={styles.muted}>Savollar umumiy testlar bazasidan olinadi</LocalizedText>
      </View>
    );
  }

  if (error) {
    return (
      <View style={styles.center}>
        <LocalizedText style={styles.errorTitle}>Xatolik yuz berdi</LocalizedText>
        <LocalizedText style={styles.muted}>{error}</LocalizedText>

        <Pressable
          style={styles.primaryButton}
          onPress={() => void loadQuestions()}
        >
          <LocalizedText style={styles.buttonText}>Qayta urinish</LocalizedText>
        </Pressable>

        <Pressable onPress={onBack} style={styles.backButton}>
          <LocalizedText style={styles.backText}>Orqaga</LocalizedText>
        </Pressable>
      </View>
    );
  }

  if (finished) {
    return (
      <Animated.ScrollView
        onScroll={dockScrollHandler}
        scrollEventThrottle={16}
        style={styles.container}
        contentContainerStyle={styles.resultContent}
        showsVerticalScrollIndicator={false}
      >
        <LocalizedText style={styles.resultEmoji}>🏆</LocalizedText>
        <LocalizedText style={styles.title}>Test yakunlandi!</LocalizedText>
        <LocalizedText style={styles.score}>
          {score} / {questions.length}
        </LocalizedText>
        <LocalizedText style={styles.muted}>To‘g‘ri javoblar soni · {Math.round((score / questions.length) * 100)}% aniqlik</LocalizedText>

        <View style={{ width: '100%', gap: 10, marginTop: 18 }}>
          <Pressable style={styles.primaryButton} onPress={() => setShowQuestionReview((value) => !value)}>
            <LocalizedText style={styles.buttonText}>{showQuestionReview ? 'Natijaga qaytish' : 'Savollar tahlilini ko‘rish'}</LocalizedText>
          </Pressable>
          {showQuestionReview ? (
            <>
              <LocalizedText style={styles.sectionTitle}>Savollar tahlili</LocalizedText>
              {questions.map((question, index) => {
            const selected = answers[index];
            const isCorrect = selected === question.correctAnswer;
            return (
              <View key={question.id} style={styles.reviewCard}>
                <View style={styles.reviewTopRow}>
                  <LocalizedText style={styles.reviewNumber}>{`SAVOL ${String(index + 1).padStart(2, '0')}`}</LocalizedText>
                  <View style={[styles.reviewStatus, isCorrect ? styles.reviewStatusCorrect : styles.reviewStatusWrong]}>
                    <LocalizedText style={[styles.reviewStatusText, { color: isCorrect ? '#35C995' : colors.danger }]}>{isCorrect ? 'To‘g‘ri' : 'Xato'}</LocalizedText>
                  </View>
                </View>
                <LocalizedText style={styles.reviewQuestion}>{question.question}</LocalizedText>
                <View style={styles.reviewAnswerBlock}>
                  <LocalizedText style={styles.reviewLabel}>SIZNING JAVOBINGIZ</LocalizedText>
                  <LocalizedText style={styles.reviewAnswer}>{selected === null || selected === undefined ? 'Javob berilmagan' : question.options[selected]}</LocalizedText>
                </View>
                <View style={styles.reviewAnswerBlock}>
                  <LocalizedText style={styles.reviewLabel}>TO‘G‘RI JAVOB</LocalizedText>
                  <LocalizedText style={[styles.reviewAnswer, { color: '#35C995' }]}>{question.options[question.correctAnswer]}</LocalizedText>
                </View>
                {!!question.explanation && (
                  <View style={styles.reviewExplanation}>
                    <LocalizedText style={styles.reviewLabel}>IZOH</LocalizedText>
                    <LocalizedText style={styles.setupNoteText}>{question.explanation}</LocalizedText>
                  </View>
                )}
                {!isCorrect && selected !== null && selected !== undefined && (
                  <>
                    <Pressable style={styles.reviewAiButton} disabled={!!explainingQuestionIds[question.id]} onPress={() => void explainQuestionWithAi(question, index)}>
                      <Ionicons name="sparkles" size={16} color="#FFFFFF" />
                      <LocalizedText style={styles.buttonText}>{explainingQuestionIds[question.id] ? 'AI Ustoz tushuntirmoqda...' : 'AI Ustozdan batafsil tahlil'}</LocalizedText>
                    </Pressable>
                    {!!aiExplanations[question.id] && (
                      <View style={styles.reviewAiBox}>
                        <LocalizedText style={styles.reviewAiTitle}>AI USTOZ TAHLILI</LocalizedText>
                        <LocalizedText style={styles.reviewAiText}>{aiExplanations[question.id]}</LocalizedText>
                      </View>
                    )}
                  </>
                )}
              </View>
            );
              })}
            </>
          ) : null}
        </View>

        {savingAttempt ? (
          <LocalizedText style={styles.muted}>Natija statistika uchun saqlanmoqda...</LocalizedText>
        ) : attemptSaved ? (
          <LocalizedText style={styles.savedAttemptText}>✓ Natija statistikaga qo‘shildi</LocalizedText>
        ) : attemptSaveError ? (
          <Pressable onPress={() => void saveFinishedAttempt()}>
            <LocalizedText style={styles.retryAttemptText}>Natija saqlanmadi. Qayta urinish</LocalizedText>
          </Pressable>
        ) : null}

        <Pressable
          style={styles.primaryButton}
          onPress={() => void loadQuestions()}
        >
          <LocalizedText style={styles.buttonText}>Yangi test ishlash</LocalizedText>
        </Pressable>

        <Pressable onPress={onBack} style={styles.backButton}>
          <LocalizedText style={styles.backText}>Mavzularga qaytish</LocalizedText>
        </Pressable>
      </Animated.ScrollView>
    );
  }

  if (questions.length === 0) {
    return (
      <Animated.ScrollView onScroll={dockScrollHandler} scrollEventThrottle={16} style={styles.container} contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <Pressable onPress={onBack} style={styles.backButton}><LocalizedText style={styles.backText}>‹ Mavzularga qaytish</LocalizedText></Pressable>
        <LocalizedText style={styles.eyebrow}>{subject.name.toUpperCase()}</LocalizedText>
        <LocalizedText style={styles.title}>{topic.name}</LocalizedText>
        <LocalizedText style={styles.setupDescription}>Test sozlamalarini tanlang. Savollar bazadan olinadi va birinchi tayyorlangandan keyin qayta ishlatiladi.</LocalizedText>
        <View style={styles.setupCard}>
          <LocalizedText style={styles.setupLabel}>SAVOLLAR SONI</LocalizedText>
          <View style={styles.choiceRow}>{countOptions.map((count) => <Pressable key={count} onPress={() => setSelectedCount(count)} style={[styles.choiceChip, selectedCount === count && styles.selectedChoiceChip]}><LocalizedText style={[styles.choiceText, selectedCount === count && styles.selectedChoiceText]}>{count === topic.questionCount ? `${count} · Barchasi` : String(count)}</LocalizedText></Pressable>)}</View>
          <LocalizedText style={styles.setupLabel}>QIYINLIK DARAJASI</LocalizedText>
          <View style={styles.choiceRow}>{([{ value: 'easy', label: 'Oson' }, { value: 'medium', label: 'O‘rta' }, { value: 'hard', label: 'Qiyin' }, { value: 'expert', label: 'Ekspert' }] as const).map((item) => <Pressable key={item.value} onPress={() => setSelectedDifficulty(item.value)} style={[styles.choiceChip, selectedDifficulty === item.value && styles.selectedChoiceChip]}><LocalizedText style={[styles.choiceText, selectedDifficulty === item.value && styles.selectedChoiceText]}>{item.label}</LocalizedText></Pressable>)}</View>
          <LocalizedText style={styles.setupLabel}>TEST TILI</LocalizedText>
          <View style={styles.choiceRow}>{([{ value: 'uz', label: 'O‘zbekcha' }, { value: 'ru', label: 'Русский' }, { value: 'en', label: 'English' }] as const).map((item) => <Pressable key={item.value} onPress={() => setSelectedLanguage(item.value)} style={[styles.choiceChip, selectedLanguage === item.value && styles.selectedChoiceChip]}><LocalizedText style={[styles.choiceText, selectedLanguage === item.value && styles.selectedChoiceText]}>{item.label}</LocalizedText></Pressable>)}</View>
        </View>
        <View style={styles.setupNote}><LocalizedText style={styles.setupNoteTitle}>Testlar bazasi qanday ishlaydi?</LocalizedText><LocalizedText style={styles.setupNoteText}>Har bir mavzu uchun savollar server bazasida saqlanadi. Birinchi tayyorlashdan keyin keyingi foydalanuvchilar ham shu savollarni AI chaqirmasdan oladi. Natijangiz profilingizga saqlanadi.</LocalizedText></View>
        <Pressable style={styles.primaryButton} onPress={() => void loadQuestions()}><LocalizedText style={styles.buttonText}>Testni boshlash</LocalizedText></Pressable>
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
        <LocalizedText style={styles.backText}>‹ Orqaga</LocalizedText>
      </Pressable>

      <LocalizedText style={styles.eyebrow}>{subject.name.toUpperCase()}</LocalizedText>
      <LocalizedText style={styles.title}>{topic.name}</LocalizedText>

      <View style={styles.progressCard}>
        <LocalizedText style={styles.muted}>
          Savol {currentIndex + 1} / {questions.length}
        </LocalizedText>
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
        <LocalizedText style={styles.questionLabel}>SAVOL</LocalizedText>
        <LocalizedText style={styles.questionText}>
          {currentQuestion.question}
        </LocalizedText>
      </View>

      <LocalizedText style={styles.sectionTitle}>Javobni tanlang</LocalizedText>

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
            <LocalizedText style={styles.optionLetter}>
              {String.fromCharCode(65 + index)}
            </LocalizedText>
            <LocalizedText style={styles.optionText}>{option}</LocalizedText>
          </Pressable>
        );
      })}

      {selectedAnswer !== null && (
        <View style={styles.explanationCard}>
          <LocalizedText style={styles.explanationTitle}>
            {selectedAnswer === currentQuestion.correctAnswer
              ? 'To‘g‘ri javob!'
              : 'Noto‘g‘ri javob'}
          </LocalizedText>

          <LocalizedText style={styles.explanationText}>
            {currentQuestion.explanation}
          </LocalizedText>

          <Pressable style={styles.primaryButton} onPress={nextQuestion}>
            <LocalizedText style={styles.buttonText}>
              {currentIndex === questions.length - 1
                ? 'Natijani ko‘rish'
                : 'Keyingi savol'}
            </LocalizedText>
          </Pressable>
        </View>
      )}

      <LocalizedText style={styles.scoreText}>Joriy ball: {score}</LocalizedText>
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
    paddingHorizontal: 20,
    paddingTop: 14,
    paddingBottom: 128,
  },
  resultContent: {
    flexGrow: 1,
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: 140,
    gap: 14,
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
  reviewCard: { padding: 16, borderRadius: 18, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, gap: 11 },
  reviewTopRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  reviewNumber: { color: colors.textMuted, fontSize: 10, fontWeight: '900', letterSpacing: 1.1 },
  reviewStatus: { paddingHorizontal: 10, paddingVertical: 5, borderRadius: 20 },
  reviewStatusCorrect: { backgroundColor: 'rgba(53,201,149,0.12)' },
  reviewStatusWrong: { backgroundColor: colors.dangerSurface },
  reviewStatusText: { fontSize: 10, fontWeight: '900' },
  reviewQuestion: { color: colors.text, fontSize: 15, lineHeight: 22, fontWeight: '800' },
  reviewAnswerBlock: { padding: 11, borderRadius: 12, backgroundColor: colors.surfaceElevated, gap: 5 },
  reviewLabel: { color: colors.textMuted, fontSize: 9, fontWeight: '900', letterSpacing: 0.9 },
  reviewAnswer: { color: colors.text, fontSize: 12, lineHeight: 18, fontWeight: '700' },
  reviewExplanation: { gap: 6, paddingHorizontal: 2 },
  reviewAiButton: { minHeight: 44, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, backgroundColor: colors.primaryDark, borderRadius: 13, paddingHorizontal: 12, marginTop: 2 },
  reviewAiBox: { padding: 13, borderRadius: 13, backgroundColor: colors.primary + '16', borderWidth: 1, borderColor: colors.primary + '35', gap: 7 },
  reviewAiTitle: { color: colors.primary, fontSize: 10, fontWeight: '900', letterSpacing: 0.8 },
  reviewAiText: { color: colors.text, fontSize: 12, lineHeight: 19 },
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
    backgroundColor: colors.surfaceGlass,
    borderWidth: 1,
    borderColor: colors.glassBorder,
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
    backgroundColor: colors.surfaceGlass,
    borderWidth: 1,
    borderColor: colors.glassBorder,
    borderRadius: 22,
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
    backgroundColor: colors.surfaceGlass,
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
    backgroundColor: colors.primaryDark,
    paddingHorizontal: 18,
    paddingVertical: 14,
    borderRadius: 16,
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
