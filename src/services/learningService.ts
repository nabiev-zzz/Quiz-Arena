import { API_BASE_URL, getToken } from './authService';
import type { Difficulty } from '../types';
import type { Question } from '../data/questions';

export interface LearningAttemptInput {
  subjectId: string;
  subjectName: string;
  topicId: string;
  topicName: string;
  totalQuestions: number;
  correctAnswers: number;
  review?: LearningReviewQuestion[];
}

export interface LearningReviewQuestion {
  id: string;
  question: string;
  options: string[];
  selectedAnswer: number;
  correctAnswer: number;
  isCorrect: boolean;
  explanation: string;
  aiExplanation?: string;
}

export interface LearningHistorySummary {
  id: string;
  subjectId: string;
  subjectName: string;
  topicId: string;
  topicName: string;
  totalQuestions: number;
  correctAnswers: number;
  accuracy: number;
  completedAt: string;
}

export interface LearningHistoryItem {
  id: string;
  subjectId: string;
  subjectName: string;
  topicId: string;
  topicName: string;
  totalQuestions: number;
  correctAnswers: number;
  accuracy: number;
  completedAt: string;
  review: LearningReviewQuestion[];
}

export interface LearningStats {
  totalAttempts: number;
  totalQuestions: number;
  correctAnswers: number;
  accuracy: number;
  weeklyActivity: Array<{
    day: string;
    attempts: number;
    correctAnswers: number;
  }>;
  subjectBreakdown: Array<{
    subjectId: string;
    subjectName: string;
    attempts: number;
    totalQuestions: number;
    correctAnswers: number;
    accuracy: number;
  }>;
  recentAttempts: Array<{
    id: string;
    subjectName: string;
    topicName: string;
    totalQuestions: number;
    correctAnswers: number;
    accuracy: number;
    completedAt: string;
  }>;
}

async function learningRequest<T>(
  endpoint: string,
  options: RequestInit = {},
): Promise<T> {
  const token = await getToken();
  if (!token) throw new Error('Tizimga qayta kirishingiz kerak.');

  const response = await fetch(`${API_BASE_URL}${endpoint}`, {
    ...options,
    headers: {
      Accept: 'application/json',
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
      ...options.headers,
    },
  });

  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(
      typeof data.message === 'string'
        ? data.message
        : 'Ta’lim statistikasini yuklab bo‘lmadi.',
    );
  }
  return data as T;
}

export function saveLearningAttempt(input: LearningAttemptInput): Promise<LearningHistoryItem> {
  return learningRequest('/api/learning/attempts', {
    method: 'POST',
    body: JSON.stringify(input),
  });
}

export function getLearningHistory() {
  return learningRequest<LearningHistorySummary[]>('/api/learning/attempts');
}

export function getLearningHistoryItem(attemptId: string) {
  return learningRequest<LearningHistoryItem>(`/api/learning/attempts/${encodeURIComponent(attemptId)}`);
}

export function updateLearningAttemptReview(attemptId: string, review: LearningReviewQuestion[]) {
  return learningRequest<LearningHistoryItem>(`/api/learning/attempts/${encodeURIComponent(attemptId)}/review`, {
    method: 'PATCH',
    body: JSON.stringify({ review }),
  });
}

export function getLearningStats() {
  return learningRequest<LearningStats>('/api/learning/stats');
}


export async function getTopicQuestions(input: {
  subjectId: string;
  topicId: string;
  count: number;
  difficulty: Difficulty;
  language: 'uz' | 'ru' | 'en';
}): Promise<Question[]> {
  const result = await learningRequest<{ questions: Question[]; source: 'database'; cachedQuestionCount: number }>(
    '/api/learning/questions',
    { method: 'POST', body: JSON.stringify(input) },
  );
  return result.questions;
}

export interface DocumentQuizQuestion {
  id: string;
  subjectId: string;
  topicId: string;
  question: string;
  options: string[];
  correctAnswer: number;
  explanation: string;
  difficulty: Difficulty;
}

export interface DocumentQuizResult {
  title: string;
  topicId: string;
  sourceFileName: string;
  questionCount: number;
  questions: DocumentQuizQuestion[];
}

export async function createDocumentQuiz(
  file: { uri: string; name: string; mimeType?: string | null; file?: Blob },
  options: { count: number; difficulty: Difficulty; language: 'uz' | 'ru' | 'en' },
): Promise<DocumentQuizResult> {
  const token = await getToken();
  if (!token) throw new Error('Tizimga qayta kirishingiz kerak.');

  const form = new FormData();
  if (file.file) {
    form.append('file', file.file, file.name);
  } else {
    form.append('file', {
      uri: file.uri,
      name: file.name,
      type: file.mimeType || 'application/octet-stream',
    } as unknown as Blob);
  }
  form.append('count', String(options.count));
  form.append('difficulty', options.difficulty);
  form.append('language', options.language);

  const response = await fetch(`${API_BASE_URL}/api/learning/document-quiz`, {
    method: 'POST',
    headers: { Accept: 'application/json', Authorization: `Bearer ${token}` },
    body: form,
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(typeof data.message === 'string' ? data.message : 'Hujjatdan test yaratib bo‘lmadi.');
  }
  return data as DocumentQuizResult;
}
