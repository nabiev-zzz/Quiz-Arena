
import { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';

import {
  generateQuestions,
  type Question,
} from '../data/questions';
import type { Subject, Topic } from '../types';
import { API_BASE_URL } from '../config/api';
import { useTheme } from '../theme/ThemeContext';

interface QuizScreenProps {
  subject: Subject;
  topic: Topic;
  onBack: () => void;
}

export default function QuizScreen({
  subject,
  topic,
  onBack,
}: QuizScreenProps) {
  const { tokens } = useTheme();
  const colors = tokens.colors;
  const styles = makeStyles(colors);

  const [questions, setQuestions] = useState<Question[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [selectedAnswer, setSelectedAnswer] = useState<number | null>(null);
  const [score, setScore] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const loadQuestions = useCallback(async () => {
    setLoading(true);
    setError('');

    try {
      const totalCount = topic.questionCount;
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
          difficulty: topic.difficulty,
          language: 'uz',
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
    topic.questionCount,
    topic.difficulty,
  ]);

  useEffect(() => {
    void loadQuestions();
  }, [loadQuestions]);

  const currentQuestion = questions[currentIndex];
  const finished = questions.length > 0 && currentIndex >= questions.length;

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
        <ActivityIndicator size="large" color="#A99BFF" />
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
        <Text style={styles.muted}>To‘g‘ri javoblar soni</Text>

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

  if (!currentQuestion) return null;

  return (
    <ScrollView
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
    </ScrollView>
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
    paddingBottom: 44,
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
    backgroundColor: '#A99BFF',
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
    color: colors.text,
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
