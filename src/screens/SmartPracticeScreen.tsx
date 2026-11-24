import React, { useMemo, useState } from 'react';
import { Ionicons } from '@expo/vector-icons';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, View } from 'react-native';

import { LocalizedText, showLocalizedAlert } from '../i18n/LocalizedText';
import { useTheme } from '../theme/ThemeContext';
import {
  createSmartPractice,
  saveLearningAttempt,
  type DocumentQuizQuestion,
} from '../services/learningService';

interface Props {
  onBack: () => void;
  language: 'uz' | 'ru' | 'en';
}

type Phase = 'start' | 'loading' | 'quiz' | 'result';

export default function SmartPracticeScreen({ onBack, language }: Props) {
  const { tokens } = useTheme();
  const colors = tokens.colors;
  const s = useMemo(() => makeStyles(colors), [colors]);
  const [phase, setPhase] = useState<Phase>('start');
  const [questions, setQuestions] = useState<DocumentQuizQuestion[]>([]);
  const [topicId, setTopicId] = useState('');
  const [personalized, setPersonalized] = useState(false);
  const [index, setIndex] = useState(0);
  const [answers, setAnswers] = useState<number[]>([]);
  const [selectedAnswer, setSelectedAnswer] = useState<number | null>(null);
  const [saving, setSaving] = useState(false);

  const startPractice = async () => {
    setPhase('loading');
    try {
      const result = await createSmartPractice(10, language);
      setQuestions(result.questions);
      setTopicId(result.topicId);
      setPersonalized(result.personalized);
      setIndex(0);
      setAnswers([]);
      setSelectedAnswer(null);
      setPhase('quiz');
    } catch (error) {
      setPhase('start');
      showLocalizedAlert('Mashq tayyorlanmadi', error instanceof Error ? error.message : 'Xatolar asosida mashq yaratib bo‘lmadi.');
    }
  };

  const finish = async (completed: number[]) => {
    const correct = questions.reduce((total, question, questionIndex) =>
      total + (completed[questionIndex] === question.correctAnswer ? 1 : 0), 0);
    setPhase('result');
    setSaving(true);
    try {
      await saveLearningAttempt({
        subjectId: 'smart-practice',
        subjectName: 'Smart Practice',
        topicId: topicId || `smart-practice-${Date.now()}`,
        topicName: personalized ? 'AI moslashtirilgan mashq' : 'Xatolar bo‘yicha mashq',
        totalQuestions: questions.length,
        correctAnswers: correct,
        review: questions.map((question, questionIndex) => ({
          id: question.id,
          question: question.question,
          options: question.options,
          selectedAnswer: completed[questionIndex],
          correctAnswer: question.correctAnswer,
          isCorrect: completed[questionIndex] === question.correctAnswer,
          explanation: question.explanation,
          aiExplanation: '',
        })),
      });
    } catch (error) {
      showLocalizedAlert('Natija saqlanmadi', error instanceof Error ? error.message : 'Test tarixiga yozishda xatolik.');
    } finally {
      setSaving(false);
    }
  };

  const next = () => {
    if (selectedAnswer === null) return;
    const completed = [...answers, selectedAnswer];
    setAnswers(completed);
    if (index + 1 >= questions.length) {
      void finish(completed);
      return;
    }
    setIndex((value) => value + 1);
    setSelectedAnswer(null);
  };

  const reset = () => {
    setPhase('start');
    setQuestions([]);
    setAnswers([]);
    setSelectedAnswer(null);
    setIndex(0);
  };

  const current = questions[index];
  const correctCount = questions.reduce((total, question, questionIndex) =>
    total + (answers[questionIndex] === question.correctAnswer ? 1 : 0), 0);
  const percent = questions.length ? Math.round(correctCount / questions.length * 100) : 0;

  return (
    <View style={s.screen}>
      <View style={s.header}>
        <Pressable onPress={onBack} style={s.back}><Ionicons name="chevron-back" size={21} color={colors.text} /></Pressable>
        <View style={{ flex: 1 }}>
          <LocalizedText style={s.eyebrow}>QUIZ ARENA · SMART LEARNING</LocalizedText>
          <LocalizedText style={s.title}>Smart Practice</LocalizedText>
        </View>
        <View style={s.headerIcon}><Ionicons name="brain" size={21} color="#FFFFFF" /></View>
      </View>

      <ScrollView contentContainerStyle={s.content} showsVerticalScrollIndicator={false}>
        {phase === 'start' ? (
          <>
            <View style={s.hero}>
              <View style={s.heroIcon}><Ionicons name="refresh-circle" size={34} color="#FFFFFF" /></View>
              <LocalizedText style={s.heroTitle}>Xatolaringizdan kuchliroq bo‘ling</LocalizedText>
              <LocalizedText style={s.heroText}>QUIZ ARENA avvalgi testlaringizdagi noto‘g‘ri javoblarni topadi va aynan qiynalayotgan mavzularingiz bo‘yicha mashq tayyorlaydi.</LocalizedText>
              <View style={s.featureRow}><Ionicons name="checkmark-circle" size={16} color="#7DE3BD" /><LocalizedText style={s.featureText}>Saqlangan xatolar asosida</LocalizedText></View>
              <View style={s.featureRow}><Ionicons name="sparkles" size={16} color="#D7C8FF" /><LocalizedText style={s.featureText}>PREMIUM PRO va LEGENDA+ uchun yangi AI savollar</LocalizedText></View>
            </View>
            <View style={s.infoCard}>
              <Ionicons name="information-circle-outline" size={20} color={colors.primary} />
              <LocalizedText style={s.infoText}>Mashq yaratish uchun oldin kamida bitta testni yakunlagan bo‘lishingiz kerak. Har bir mashqdan keyin natija tarixingizga saqlanadi.</LocalizedText>
            </View>
            <Pressable onPress={() => void startPractice()} style={s.primary}>
              <Ionicons name="play" size={18} color="#FFFFFF" />
              <LocalizedText style={s.primaryText}>Shaxsiy mashqni boshlash</LocalizedText>
              <Ionicons name="arrow-forward" size={18} color="#FFFFFF" />
            </Pressable>
          </>
        ) : null}

        {phase === 'loading' ? (
          <View style={s.loadingCard}>
            <View style={s.loadingIcon}><Ionicons name="brain" size={30} color="#FFFFFF" /></View>
            <ActivityIndicator size="large" color={colors.primary} />
            <LocalizedText style={s.loadingTitle}>Bilimlaringiz tahlil qilinmoqda</LocalizedText>
            <LocalizedText style={s.muted}>Avvalgi xatolar tanlanmoqda va siz uchun mashq tayyorlanmoqda.</LocalizedText>
          </View>
        ) : null}

        {phase === 'quiz' && current ? (
          <>
            <View style={s.progressHeader}>
              <LocalizedText style={s.eyebrow}>{personalized ? 'AI MOSLASHTIRILGAN MASHQ' : 'XATOLAR ASOSIDAGI MASHQ'}</LocalizedText>
              <LocalizedText style={s.progressText}>{index + 1} / {questions.length}</LocalizedText>
            </View>
            <View style={s.track}><View style={[s.fill, { width: `${(index + 1) / questions.length * 100}%` }]} /></View>
            <View style={s.questionCard}>
              <LocalizedText style={s.questionNumber}>SAVOL {index + 1}</LocalizedText>
              <LocalizedText style={s.question}>{current.question}</LocalizedText>
              <View style={{ gap: 9 }}>
                {current.options.map((option, optionIndex) => {
                  const selected = selectedAnswer === optionIndex;
                  const correct = selectedAnswer !== null && optionIndex === current.correctAnswer;
                  const wrong = selected && selectedAnswer !== current.correctAnswer;
                  return (
                    <Pressable key={`${current.id}-${optionIndex}`} onPress={() => selectedAnswer === null && setSelectedAnswer(optionIndex)} style={[s.option, selected && s.optionSelected, correct && s.optionCorrect, wrong && s.optionWrong]}>
                      <View style={[s.letter, selected && s.letterSelected]}><LocalizedText style={[s.letterText, selected && s.letterSelectedText]}>{String.fromCharCode(65 + optionIndex)}</LocalizedText></View>
                      <LocalizedText style={s.optionText}>{option}</LocalizedText>
                      {correct ? <Ionicons name="checkmark-circle" size={20} color="#159B68" /> : wrong ? <Ionicons name="close-circle" size={20} color="#DC4C64" /> : null}
                    </Pressable>
                  );
                })}
              </View>
              {selectedAnswer !== null ? (
                <View style={s.explanation}>
                  <LocalizedText style={s.explanationTitle}>{selectedAnswer === current.correctAnswer ? 'To‘g‘ri javob!' : 'To‘g‘ri javobni o‘rganing'}</LocalizedText>
                  <LocalizedText style={s.explanationText}>{current.explanation}</LocalizedText>
                </View>
              ) : null}
            </View>
            <Pressable onPress={next} disabled={selectedAnswer === null} style={[s.primary, selectedAnswer === null && s.disabled]}>
              <LocalizedText style={s.primaryText}>{index + 1 === questions.length ? 'Natijani ko‘rish' : 'Keyingi savol'}</LocalizedText>
              <Ionicons name="arrow-forward" size={18} color="#FFFFFF" />
            </Pressable>
          </>
        ) : null}

        {phase === 'result' ? (
          <View style={s.resultCard}>
            <View style={s.resultIcon}><Ionicons name={percent >= 70 ? 'trophy' : 'school'} size={34} color="#FFFFFF" /></View>
            <LocalizedText style={s.eyebrow}>MASHQ YAKUNLANDI</LocalizedText>
            <LocalizedText style={s.resultTitle}>{percent >= 70 ? 'Ajoyib rivojlanish!' : 'Yana bir bor mashq qiling!'}</LocalizedText>
            <LocalizedText style={s.percent}>{percent}%</LocalizedText>
            <LocalizedText style={s.muted}>{correctCount} ta to‘g‘ri · {questions.length - correctCount} ta xato</LocalizedText>
            <View style={s.track}><View style={[s.fill, { width: `${percent}%` }]} /></View>
            {saving ? <View style={s.saving}><ActivityIndicator size="small" color={colors.primary} /><LocalizedText style={s.muted}>Natija tarixga saqlanmoqda...</LocalizedText></View> : <LocalizedText style={s.saved}>Natija test tarixiga saqlandi</LocalizedText>}
            <Pressable onPress={reset} style={s.primary}><Ionicons name="refresh" size={18} color="#FFFFFF" /><LocalizedText style={s.primaryText}>Yana mashq qilish</LocalizedText></Pressable>
            <Pressable onPress={onBack} style={s.secondary}><LocalizedText style={s.secondaryText}>Darslarga qaytish</LocalizedText></Pressable>
          </View>
        ) : null}
      </ScrollView>
    </View>
  );
}

function makeStyles(colors: ReturnType<typeof useTheme>['tokens']['colors']) {
  return StyleSheet.create({
    screen: { flex: 1, backgroundColor: colors.background },
    header: { minHeight: 72, paddingHorizontal: 17, flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: colors.surface, borderBottomWidth: 1, borderBottomColor: colors.border },
    back: { width: 40, height: 40, borderRadius: 14, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.surfaceElevated },
    headerIcon: { width: 40, height: 40, borderRadius: 14, alignItems: 'center', justifyContent: 'center', backgroundColor: '#6653D8' },
    eyebrow: { color: colors.primary, fontSize: 9, fontWeight: '900', letterSpacing: 1.3 },
    title: { color: colors.text, fontSize: 17, fontWeight: '900', marginTop: 3 },
    content: { padding: 17, paddingBottom: 132, gap: 15 },
    hero: { padding: 20, borderRadius: 24, backgroundColor: '#21133F', gap: 11 },
    heroIcon: { width: 60, height: 60, borderRadius: 20, alignItems: 'center', justifyContent: 'center', backgroundColor: '#7059D6' },
    heroTitle: { color: '#FFFFFF', fontSize: 22, lineHeight: 29, fontWeight: '900' },
    heroText: { color: '#D9D0F3', fontSize: 12, lineHeight: 19 },
    featureRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
    featureText: { color: '#E4DDF5', fontSize: 10, fontWeight: '700' },
    infoCard: { flexDirection: 'row', alignItems: 'flex-start', gap: 10, padding: 14, borderRadius: 16, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border },
    infoText: { flex: 1, color: colors.textMuted, fontSize: 11, lineHeight: 17 },
    primary: { minHeight: 52, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10, borderRadius: 17, backgroundColor: '#6653D8', paddingHorizontal: 16 },
    primaryText: { color: '#FFFFFF', fontSize: 13, fontWeight: '900' },
    disabled: { opacity: 0.45 },
    loadingCard: { minHeight: 320, alignItems: 'center', justifyContent: 'center', gap: 16, borderRadius: 22, padding: 24, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border },
    loadingIcon: { width: 64, height: 64, borderRadius: 22, backgroundColor: '#6653D8', alignItems: 'center', justifyContent: 'center' },
    loadingTitle: { color: colors.text, fontSize: 17, fontWeight: '900' },
    muted: { color: colors.textMuted, fontSize: 11, lineHeight: 17 },
    progressHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
    progressText: { color: colors.primary, fontSize: 12, fontWeight: '900' },
    track: { height: 6, borderRadius: 6, backgroundColor: colors.border, overflow: 'hidden' },
    fill: { height: '100%', backgroundColor: colors.primary },
    questionCard: { borderRadius: 22, padding: 17, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, gap: 14 },
    questionNumber: { color: colors.primary, fontSize: 10, fontWeight: '900', letterSpacing: 1.2 },
    question: { color: colors.text, fontSize: 18, lineHeight: 27, fontWeight: '800' },
    option: { minHeight: 54, flexDirection: 'row', alignItems: 'center', gap: 10, padding: 11, borderRadius: 14, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surfaceElevated },
    optionSelected: { borderColor: colors.primary, backgroundColor: colors.primary + '13' },
    optionCorrect: { borderColor: '#159B68', backgroundColor: 'rgba(21,155,104,0.10)' },
    optionWrong: { borderColor: '#DC4C64', backgroundColor: 'rgba(220,76,100,0.10)' },
    letter: { width: 29, height: 29, borderRadius: 10, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.border },
    letterSelected: { backgroundColor: colors.primary },
    letterText: { color: colors.textMuted, fontSize: 11, fontWeight: '900' },
    letterSelectedText: { color: '#FFFFFF' },
    optionText: { flex: 1, color: colors.text, fontSize: 12, lineHeight: 18, fontWeight: '600' },
    explanation: { borderRadius: 14, padding: 12, backgroundColor: colors.primary + '12', gap: 5 },
    explanationTitle: { color: colors.primary, fontSize: 12, fontWeight: '900' },
    explanationText: { color: colors.text, fontSize: 11, lineHeight: 17 },
    resultCard: { alignItems: 'center', borderRadius: 24, padding: 22, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, gap: 11 },
    resultIcon: { width: 70, height: 70, borderRadius: 24, backgroundColor: '#6653D8', alignItems: 'center', justifyContent: 'center' },
    resultTitle: { color: colors.text, fontSize: 21, fontWeight: '900', textAlign: 'center' },
    percent: { color: colors.primary, fontSize: 42, fontWeight: '900' },
    saving: { flexDirection: 'row', alignItems: 'center', gap: 8, marginVertical: 7 },
    saved: { color: '#159B68', fontSize: 11, fontWeight: '800', marginVertical: 7 },
    secondary: { minHeight: 42, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 15 },
    secondaryText: { color: colors.primary, fontSize: 12, fontWeight: '800' },
  });
}
