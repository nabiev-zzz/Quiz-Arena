import React, { useEffect, useMemo, useState } from 'react';
import * as DocumentPicker from 'expo-document-picker';
import { Ionicons } from '@expo/vector-icons';
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  View,
} from 'react-native';

import { LocalizedText, showLocalizedAlert } from '../i18n/LocalizedText';
import { useTheme } from '../theme/ThemeContext';
import type { Difficulty } from '../types';
import { createDocumentQuiz, getLearningHistoryItem, saveLearningAttempt } from '../services/learningService';
import { exportLearningAttempt, TEST_EXPORT_FORMATS, type TestExportFormat } from '../services/testExportService';
import type { DocumentQuizQuestion } from '../services/learningService';
import { getPremiumStatus } from '../services/subscriptionService';

interface Props {
  onBack: () => void;
  language: 'uz' | 'ru' | 'en';
}

type SelectedFile = {
  uri: string;
  name: string;
  mimeType?: string | null;
  file?: Blob;
};

type Phase = 'setup' | 'loading' | 'quiz' | 'result';

const DIFFICULTIES: Array<{ value: Difficulty; label: string }> = [
  { value: 'easy', label: 'Oson' },
  { value: 'medium', label: 'O‘rta' },
  { value: 'hard', label: 'Qiyin' },
  { value: 'expert', label: 'Ekspert' },
];

const ACCEPTED_TYPES = [
  'application/pdf',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'text/plain',
  'text/markdown',
  'text/csv',
];

export default function DocumentQuizScreen({ onBack, language }: Props) {
  const { tokens } = useTheme();
  const colors = tokens.colors;
  const s = useMemo(() => makeStyles(colors), [colors]);

  const [file, setFile] = useState<SelectedFile | null>(null);
  const [phase, setPhase] = useState<Phase>('setup');
  const [count, setCount] = useState(10);
  const [maxQuestions, setMaxQuestions] = useState(10);
  const [maxFileSizeMb, setMaxFileSizeMb] = useState(5);
  const [difficulty, setDifficulty] = useState<Difficulty>('medium');
  const [questions, setQuestions] = useState<DocumentQuizQuestion[]>([]);
  const [questionIndex, setQuestionIndex] = useState(0);
  const [answers, setAnswers] = useState<number[]>([]);
  const [selectedAnswer, setSelectedAnswer] = useState<number | null>(null);
  const [savingHistory, setSavingHistory] = useState(false);
  const [savedAttemptId, setSavedAttemptId] = useState<string | null>(null);
  const [showExportOptions, setShowExportOptions] = useState(false);
  const [exportingFormat, setExportingFormat] = useState<TestExportFormat | null>(null);
  const [exportError, setExportError] = useState('');

  useEffect(() => {
    let active = true;
    getPremiumStatus()
      .then((status) => {
        if (!active) return;
        const limit = status.entitlements.documentQuiz.maxQuestionsPerDocument;
        setMaxQuestions(limit);
        setMaxFileSizeMb(status.entitlements.documentQuiz.maxFileSizeMb);
        setCount(Math.min(10, limit));
      })
      .catch(() => undefined);
    return () => { active = false; };
  }, []);

  const pickDocument = async () => {
    try {
      const result = await DocumentPicker.getDocumentAsync({
        type: ACCEPTED_TYPES,
        copyToCacheDirectory: true,
        multiple: false,
      });
      if (result.canceled || !result.assets?.length) return;
      const asset = result.assets[0];
      const extension = asset.name.toLowerCase().split('.').pop();
      if (!['pdf', 'docx', 'txt', 'md', 'csv'].includes(extension || '')) {
        showLocalizedAlert('Format qo‘llab-quvvatlanmaydi', 'PDF, DOCX, TXT, MD yoki CSV fayl tanlang.');
        return;
      }
      setFile({
        uri: asset.uri,
        name: asset.name,
        mimeType: asset.mimeType,
        file: asset.file,
      });
    } catch (error) {
      showLocalizedAlert('Hujjat tanlanmadi', error instanceof Error ? error.message : 'Faylni ochib bo‘lmadi.');
    }
  };

  const generate = async () => {
    if (!file) {
      showLocalizedAlert('Hujjat tanlanmagan', 'Avval PDF, DOCX yoki matnli faylni tanlang.');
      return;
    }
    setPhase('loading');
    try {
      const result = await createDocumentQuiz(file, { count, difficulty, language });
      setQuestions(result.questions);
      setQuestionIndex(0);
      setAnswers([]);
      setSelectedAnswer(null);
      setPhase('quiz');
    } catch (error) {
      setPhase('setup');
      showLocalizedAlert('Test yaratilmadi', error instanceof Error ? error.message : 'AI hujjatni tahlil qila olmadi.');
    }
  };

  const finishQuiz = async (completedAnswers: number[]) => {
    const correctAnswers = questions.reduce(
      (total, question, index) => total + (completedAnswers[index] === question.correctAnswer ? 1 : 0),
      0,
    );
    setPhase('result');
    setSavingHistory(true);
    try {
      const saved = await saveLearningAttempt({
        subjectId: 'document',
        subjectName: 'Hujjatdan test',
        topicId: questions[0]?.topicId || `document-${Date.now()}`,
        topicName: file?.name || 'Yuklangan hujjat',
        totalQuestions: questions.length,
        correctAnswers,
        review: questions.map((question, index) => ({
          id: question.id,
          question: question.question,
          options: question.options,
          selectedAnswer: completedAnswers[index],
          correctAnswer: question.correctAnswer,
          isCorrect: completedAnswers[index] === question.correctAnswer,
          explanation: question.explanation,
          aiExplanation: '',
        })),
      });
      setSavedAttemptId(saved.id);
    } catch (error) {
      showLocalizedAlert('Tarixga saqlanmadi', error instanceof Error ? error.message : 'Natijani saqlashda xatolik yuz berdi.');
    } finally {
      setSavingHistory(false);
    }
  };

  const handleExport = async (format: TestExportFormat) => {
    if (!savedAttemptId || exportingFormat) return;
    setExportingFormat(format);
    setExportError('');
    try {
      const attempt = await getLearningHistoryItem(savedAttemptId);
      await exportLearningAttempt(attempt, format);
    } catch (failure) {
      setExportError(failure instanceof Error ? failure.message : 'Eksport qilishda xatolik yuz berdi.');
    } finally {
      setExportingFormat(null);
    }
  };

  const nextQuestion = () => {
    if (selectedAnswer === null) return;
    const completed = [...answers, selectedAnswer];
    setAnswers(completed);
    if (questionIndex + 1 >= questions.length) {
      void finishQuiz(completed);
      return;
    }
    setQuestionIndex((value) => value + 1);
    setSelectedAnswer(null);
  };

  const reset = () => {
    setFile(null);
    setQuestions([]);
    setAnswers([]);
    setSelectedAnswer(null);
    setQuestionIndex(0);
    setPhase('setup');
  };

  const currentQuestion = questions[questionIndex];
  const correctCount = questions.reduce(
    (total, question, index) => total + (answers[index] === question.correctAnswer ? 1 : 0),
    0,
  );
  const percentage = questions.length ? Math.round((correctCount / questions.length) * 100) : 0;

  return (
    <View style={s.screen}>
      <View style={s.header}>
        <Pressable onPress={onBack} style={s.backButton} accessibilityRole="button">
          <Ionicons name="chevron-back" size={21} color={colors.text} />
        </Pressable>
        <View style={s.headerCopy}>
          <LocalizedText style={s.eyebrow}>QUIZ ARENA · AI</LocalizedText>
          <LocalizedText style={s.headerTitle}>Hujjatdan test</LocalizedText>
        </View>
        <View style={s.headerIcon}><Ionicons name="document-text" size={21} color="#FFFFFF" /></View>
      </View>

      <ScrollView contentContainerStyle={s.content} showsVerticalScrollIndicator={false}>
        {phase === 'setup' ? (
          <>
            <View style={s.hero}>
              <View style={s.heroGlow} />
              <LocalizedText style={s.heroTitle}>Hujjatingizni bilim sinoviga aylantiring</LocalizedText>
              <LocalizedText style={s.heroText}>PDF, Word yoki matnli hujjatni yuklang. AI mazmunni o‘qib, siz uchun yangi test yaratadi.</LocalizedText>
              <View style={s.formatRow}>
                {['PDF', 'DOCX', 'TXT', 'MD', 'CSV'].map((item) => <View key={item} style={s.formatChip}><LocalizedText style={s.formatText}>{item}</LocalizedText></View>)}
              </View>
            </View>

            <Pressable onPress={() => void pickDocument()} style={s.uploadCard}>
              <View style={s.uploadIcon}><Ionicons name="cloud-upload-outline" size={27} color={colors.primary} /></View>
              <View style={s.uploadCopy}>
                <LocalizedText style={s.uploadTitle}>{file ? 'Hujjat tanlandi' : 'Hujjat tanlash'}</LocalizedText>
                <LocalizedText style={s.muted}>{file ? file.name : `PDF, DOCX, TXT, MD yoki CSV · ${maxFileSizeMb} MB gacha`}</LocalizedText>
              </View>
              <Ionicons name="chevron-forward" size={19} color={colors.textMuted} />
            </Pressable>

            <View style={s.panel}>
              <LocalizedText style={s.panelTitle}>Test sozlamalari</LocalizedText>
              <View style={s.settingHeader}>
                <LocalizedText style={s.settingLabel}>Savollar soni</LocalizedText>
                <LocalizedText style={s.countValue}>{count} / {maxQuestions}</LocalizedText>
              </View>
              <View style={s.stepper}>
                <Pressable onPress={() => setCount((value) => Math.max(1, value - 5))} style={s.stepButton}><Ionicons name="remove" size={20} color={colors.text} /></Pressable>
                <View style={s.stepTrack}><View style={[s.stepFill, { width: `${Math.max(1, (count / maxQuestions) * 100)}%` }]} /></View>
                <Pressable onPress={() => setCount((value) => Math.min(maxQuestions, value + 5))} style={s.stepButton}><Ionicons name="add" size={20} color={colors.text} /></Pressable>
              </View>
              <LocalizedText style={s.settingLabel}>Murakkablik darajasi</LocalizedText>
              <View style={s.difficultyRow}>
                {DIFFICULTIES.map((item) => (
                  <Pressable key={item.value} onPress={() => setDifficulty(item.value)} style={[s.difficultyButton, difficulty === item.value && s.difficultyActive]}>
                    <LocalizedText style={[s.difficultyText, difficulty === item.value && s.difficultyTextActive]}>{item.label}</LocalizedText>
                  </Pressable>
                ))}
              </View>
            </View>

            <Pressable onPress={() => void generate()} disabled={!file} style={[s.primaryButton, !file && s.disabledButton]}>
              <Ionicons name="sparkles" size={18} color="#FFFFFF" />
              <LocalizedText style={s.primaryButtonText}>AI bilan test yaratish</LocalizedText>
              <Ionicons name="arrow-forward" size={18} color="#FFFFFF" />
            </Pressable>
            <LocalizedText style={s.footerNote}>Yaratilgan savollarni yechganingizdan so‘ng natija test tarixingizga saqlanadi.</LocalizedText>
          </>
        ) : null}

        {phase === 'loading' ? (
          <View style={s.loadingCard}>
            <View style={s.loadingIcon}><Ionicons name="sparkles" size={30} color="#FFFFFF" /></View>
            <ActivityIndicator size="large" color={colors.primary} />
            <LocalizedText style={s.loadingTitle}>Test tayyorlanmoqda</LocalizedText>
            <LocalizedText style={s.muted}>Hujjat tahlil qilinmoqda. Tayyor bo‘lgach test avtomatik ochiladi.</LocalizedText>
          </View>
        ) : null}

        {phase === 'quiz' && currentQuestion ? (
          <>
            <View style={s.quizProgressHeader}>
              <LocalizedText style={s.eyebrow}>HUJJATDAN YARATILGAN TEST</LocalizedText>
              <LocalizedText style={s.progressText}>{questionIndex + 1} / {questions.length}</LocalizedText>
            </View>
            <View style={s.progressTrack}><View style={[s.progressFill, { width: `${((questionIndex + 1) / questions.length) * 100}%` }]} /></View>
            <View style={s.questionCard}>
              <LocalizedText style={s.questionNumber}>SAVOL {questionIndex + 1}</LocalizedText>
              <LocalizedText style={s.questionText}>{currentQuestion.question}</LocalizedText>
              <View style={s.options}>
                {currentQuestion.options.map((option, index) => {
                  const selected = selectedAnswer === index;
                  const isCorrect = selectedAnswer !== null && index === currentQuestion.correctAnswer;
                  const isWrong = selected && selectedAnswer !== currentQuestion.correctAnswer;
                  return (
                    <Pressable key={`${currentQuestion.id}-${index}`} onPress={() => selectedAnswer === null && setSelectedAnswer(index)} style={[s.option, selected && s.optionSelected, isCorrect && s.optionCorrect, isWrong && s.optionWrong]}>
                      <View style={[s.optionLetter, selected && s.optionLetterSelected]}><LocalizedText style={[s.optionLetterText, selected && s.optionLetterTextSelected]}>{String.fromCharCode(65 + index)}</LocalizedText></View>
                      <LocalizedText style={s.optionText}>{option}</LocalizedText>
                      {isCorrect ? <Ionicons name="checkmark-circle" size={20} color="#159B68" /> : isWrong ? <Ionicons name="close-circle" size={20} color="#DC4C64" /> : null}
                    </Pressable>
                  );
                })}
              </View>
              {selectedAnswer !== null ? (
                <View style={s.explanationBox}>
                  <LocalizedText style={s.explanationTitle}>{selectedAnswer === currentQuestion.correctAnswer ? 'To‘g‘ri javob!' : 'Javobni o‘rganamiz'}</LocalizedText>
                  <LocalizedText style={s.explanationText}>{currentQuestion.explanation}</LocalizedText>
                </View>
              ) : null}
            </View>
            <Pressable onPress={nextQuestion} disabled={selectedAnswer === null} style={[s.primaryButton, selectedAnswer === null && s.disabledButton]}>
              <LocalizedText style={s.primaryButtonText}>{questionIndex + 1 === questions.length ? 'Natijani ko‘rish' : 'Keyingi savol'}</LocalizedText>
              <Ionicons name="arrow-forward" size={18} color="#FFFFFF" />
            </Pressable>
          </>
        ) : null}

        {phase === 'result' ? (
          <View style={s.resultCard}>
            <View style={s.resultIcon}><Ionicons name={percentage >= 70 ? 'trophy' : 'school'} size={34} color="#FFFFFF" /></View>
            <LocalizedText style={s.resultEyebrow}>TEST YAKUNLANDI</LocalizedText>
            <LocalizedText style={s.resultTitle}>{percentage >= 70 ? 'Ajoyib natija!' : 'Mashq qilishda davom eting!'}</LocalizedText>
            <LocalizedText style={s.resultPercent}>{percentage}%</LocalizedText>
            <LocalizedText style={s.muted}>{correctCount} ta to‘g‘ri javob · {questions.length - correctCount} ta xato</LocalizedText>
            <View style={s.resultTrack}><View style={[s.resultFill, { width: `${percentage}%` }]} /></View>
            {savingHistory ? (
              <View style={s.savingRow}><ActivityIndicator size="small" color={colors.primary} /><LocalizedText style={s.muted}>Natija tarixga saqlanmoqda...</LocalizedText></View>
            ) : (
              <View style={s.savedRow}><Ionicons name="checkmark-circle" size={17} color="#159B68" /><LocalizedText style={s.savedText}>Natija test tarixiga saqlandi</LocalizedText></View>
            )}
            <Pressable onPress={() => setShowExportOptions((value) => !value)} disabled={!savedAttemptId || savingHistory || !!exportingFormat} style={s.primaryButton}>
              <Ionicons name="download-outline" size={18} color="#FFFFFF" />
              <LocalizedText style={s.primaryButtonText}>{showExportOptions ? 'Eksport formatlarini yopish' : 'Testni eksport qilish'}</LocalizedText>
            </Pressable>
            {showExportOptions ? (
              <View style={s.panel}>
                <LocalizedText style={s.panelTitle}>Fayl formatini tanlang</LocalizedText>
                <View style={s.reviewActions}>
                  {TEST_EXPORT_FORMATS.map((format) => (
                    <Pressable key={format.value} onPress={() => void handleExport(format.value)} disabled={!!exportingFormat} style={s.reviewAction}>
                      <LocalizedText style={s.reviewActionText}>{exportingFormat === format.value ? 'Tayyorlanmoqda…' : format.label}</LocalizedText>
                    </Pressable>
                  ))}
                </View>
                {!!exportError && <LocalizedText style={s.reviewActionDanger}>{exportError}</LocalizedText>}
                <LocalizedText style={s.muted}>Saqlangan test savollari, variantlari va javoblari asl tartibda eksport qilinadi.</LocalizedText>
              </View>
            ) : null}
            <Pressable onPress={reset} style={s.primaryButton}>
              <Ionicons name="refresh" size={18} color="#FFFFFF" />
              <LocalizedText style={s.primaryButtonText}>Yana test yaratish</LocalizedText>
            </Pressable>
            <Pressable onPress={onBack} style={s.secondaryButton}><LocalizedText style={s.secondaryButtonText}>Darslarga qaytish</LocalizedText></Pressable>
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
    backButton: { width: 40, height: 40, borderRadius: 14, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.surfaceElevated },
    headerCopy: { flex: 1 },
    eyebrow: { color: colors.primary, fontSize: 9, fontWeight: '900', letterSpacing: 1.4 },
    headerTitle: { color: colors.text, fontSize: 17, fontWeight: '900', marginTop: 3 },
    headerIcon: { width: 40, height: 40, borderRadius: 14, alignItems: 'center', justifyContent: 'center', backgroundColor: '#6B55D9' },
    content: { padding: 17, paddingBottom: 132, gap: 15 },
    hero: { overflow: 'hidden', borderRadius: 24, padding: 20, backgroundColor: '#21133F', gap: 10 },
    heroGlow: { position: 'absolute', width: 180, height: 180, borderRadius: 90, right: -90, top: -100, backgroundColor: 'rgba(171,137,255,0.20)' },
    heroTitle: { color: '#FFFFFF', fontSize: 22, lineHeight: 29, fontWeight: '900', maxWidth: 300 },
    heroText: { color: '#D9D0F3', fontSize: 12, lineHeight: 19 },
    formatRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 7, marginTop: 4 },
    formatChip: { borderRadius: 8, paddingHorizontal: 9, paddingVertical: 5, backgroundColor: 'rgba(255,255,255,0.12)' },
    formatText: { color: '#F4F0FF', fontSize: 9, fontWeight: '900' },
    uploadCard: { flexDirection: 'row', alignItems: 'center', gap: 12, borderRadius: 20, padding: 15, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border },
    uploadIcon: { width: 46, height: 46, borderRadius: 15, backgroundColor: colors.primary + '20', alignItems: 'center', justifyContent: 'center' },
    uploadCopy: { flex: 1, gap: 4 },
    uploadTitle: { color: colors.text, fontSize: 14, fontWeight: '800' },
    muted: { color: colors.textMuted, fontSize: 11, lineHeight: 17 },
    panel: { borderRadius: 20, padding: 16, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, gap: 13 },
    panelTitle: { color: colors.text, fontSize: 15, fontWeight: '900' },
    settingHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
    settingLabel: { color: colors.text, fontSize: 12, fontWeight: '700' },
    countValue: { color: colors.primary, fontSize: 13, fontWeight: '900' },
    stepper: { flexDirection: 'row', alignItems: 'center', gap: 12 },
    stepButton: { width: 35, height: 35, borderRadius: 12, backgroundColor: colors.surfaceElevated, alignItems: 'center', justifyContent: 'center' },
    stepTrack: { flex: 1, height: 7, borderRadius: 6, backgroundColor: colors.border, overflow: 'hidden' },
    stepFill: { height: '100%', borderRadius: 6, backgroundColor: colors.primary },
    difficultyRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 7 },
    difficultyButton: { flex: 1, minWidth: '22%', borderRadius: 11, paddingVertical: 10, alignItems: 'center', backgroundColor: colors.surfaceElevated, borderWidth: 1, borderColor: colors.border },
    difficultyActive: { backgroundColor: colors.primary + '20', borderColor: colors.primary },
    difficultyText: { color: colors.textMuted, fontSize: 10, fontWeight: '700' },
    difficultyTextActive: { color: colors.primary, fontWeight: '900' },
    primaryButton: { minHeight: 52, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10, borderRadius: 17, backgroundColor: '#6653D8', paddingHorizontal: 16 },
    primaryButtonText: { color: '#FFFFFF', fontSize: 13, fontWeight: '900' },
    disabledButton: { opacity: 0.45 },
    footerNote: { color: colors.textMuted, fontSize: 10, lineHeight: 16, textAlign: 'center', paddingHorizontal: 15 },
    loadingCard: { minHeight: 320, alignItems: 'center', justifyContent: 'center', gap: 16, borderRadius: 22, padding: 24, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border },
    loadingIcon: { width: 64, height: 64, borderRadius: 22, backgroundColor: '#6653D8', alignItems: 'center', justifyContent: 'center' },
    loadingTitle: { color: colors.text, fontSize: 17, fontWeight: '900' },
    quizProgressHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
    progressText: { color: colors.primary, fontSize: 12, fontWeight: '900' },
    progressTrack: { height: 6, borderRadius: 6, backgroundColor: colors.border, overflow: 'hidden' },
    progressFill: { height: '100%', backgroundColor: colors.primary },
    questionCard: { borderRadius: 25, padding: 20, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, gap: 14 },
    questionNumber: { color: colors.primary, fontSize: 10, fontWeight: '900', letterSpacing: 1.2 },
    questionText: { color: colors.text, fontSize: 18, lineHeight: 27, fontWeight: '800' },
    options: { gap: 9 },
    option: { minHeight: 60, flexDirection: 'row', alignItems: 'center', gap: 10, padding: 11, borderRadius: 17, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surfaceElevated },
    optionSelected: { borderColor: colors.primary, backgroundColor: colors.primary + '13' },
    optionCorrect: { borderColor: '#159B68', backgroundColor: 'rgba(21,155,104,0.10)' },
    optionWrong: { borderColor: '#DC4C64', backgroundColor: 'rgba(220,76,100,0.10)' },
    optionLetter: { width: 29, height: 29, borderRadius: 10, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.border },
    optionLetterSelected: { backgroundColor: colors.primary },
    optionLetterText: { color: colors.textMuted, fontSize: 11, fontWeight: '900' },
    optionLetterTextSelected: { color: '#FFFFFF' },
    optionText: { flex: 1, color: colors.text, fontSize: 12, lineHeight: 18, fontWeight: '600' },
    explanationBox: { borderRadius: 14, padding: 12, backgroundColor: colors.primary + '12', gap: 5 },
    explanationTitle: { color: colors.primary, fontSize: 12, fontWeight: '900' },
    explanationText: { color: colors.text, fontSize: 11, lineHeight: 17 },
    resultCard: { alignItems: 'center', borderRadius: 24, padding: 22, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, gap: 11 },
    resultIcon: { width: 70, height: 70, borderRadius: 24, backgroundColor: '#6653D8', alignItems: 'center', justifyContent: 'center' },
    resultEyebrow: { color: colors.primary, fontSize: 10, fontWeight: '900', letterSpacing: 1.3 },
    resultTitle: { color: colors.text, fontSize: 21, fontWeight: '900' },
    resultPercent: { color: colors.primary, fontSize: 42, fontWeight: '900' },
    resultTrack: { width: '100%', height: 8, borderRadius: 8, backgroundColor: colors.border, overflow: 'hidden', marginTop: 5 },
    resultFill: { height: '100%', backgroundColor: '#159B68' },
    savingRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginVertical: 7 },
    savedRow: { flexDirection: 'row', alignItems: 'center', gap: 7, marginVertical: 7 },
    savedText: { color: '#159B68', fontSize: 11, fontWeight: '800' },
    secondaryButton: { minHeight: 42, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 15 },
    secondaryButtonText: { color: colors.primary, fontSize: 12, fontWeight: '800' },
  });
}
