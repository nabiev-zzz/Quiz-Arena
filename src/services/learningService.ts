import { Platform } from 'react-native';
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

async function waitForLearningJob<T>(jobId: string): Promise<T> {
  for (let attempt = 0; attempt < 120; attempt += 1) {
    await new Promise((resolve) => setTimeout(resolve, 3000));
    const status = await learningRequest<{
      status: 'queued' | 'active' | 'completed' | 'failed';
      result?: T;
      error?: string;
    }>(`/api/learning/jobs/${encodeURIComponent(jobId)}`);
    if (status.status === 'completed' && status.result) return status.result;
    if (status.status === 'failed') throw new Error(status.error || 'AI test yaratishda xatolik yuz berdi.');
  }
  throw new Error('AI navbatida kutish vaqti tugadi. Keyinroq test tarixidan tekshirib ko‘ring.');
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
  const result = await learningRequest<{
    questions?: Question[];
    source?: 'database';
    cachedQuestionCount?: number;
    status?: 'queued' | 'active' | 'completed';
    jobId?: string;
    result?: { questions: Question[] };
  }>('/api/learning/questions', { method: 'POST', body: JSON.stringify(input) });
  if (result.status === 'queued' || result.status === 'active') {
    const completed = await waitForLearningJob<{ questions: Question[] }>(String(result.jobId));
    return completed.questions;
  }
  if (result.status === 'completed' && result.result) return result.result.questions;
  return result.questions || [];
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
  language?: string;
  topicId: string;
  sourceFileName: string;
  questionCount: number;
  questions: DocumentQuizQuestion[];
}

export type DocumentQuizPhase = 'uploading' | 'reading' | 'generating' | 'done';

function validateDocumentQuizResult(value: unknown, expectedCount: number, expectedLanguage: 'auto' | 'uz' | 'ru' | 'en'): DocumentQuizResult {
  if (!value || typeof value !== 'object') throw new Error('Serverdan test natijasi kelmadi.');
  const result = value as Partial<DocumentQuizResult>;
  if (typeof result.title !== 'string' || !result.title.trim() || !Array.isArray(result.questions) || !result.questions.length) {
    throw new Error('AI test natijasi to‘liq emas. Qayta urinib ko‘ring.');
  }
  const questions = result.questions.map((question, index) => {
    if (!question || typeof question.question !== 'string' || !question.question.trim() ||
      !Array.isArray(question.options) || question.options.length !== 4 ||
      question.options.some((option) => typeof option !== 'string' || !option.trim()) ||
      new Set(question.options.map((option) => option.trim().toLocaleLowerCase())).size !== 4 ||
      !Number.isInteger(question.correctAnswer) || question.correctAnswer < 0 || question.correctAnswer > 3 ||
      typeof question.explanation !== 'string' || !question.explanation.trim()) {
      throw new Error(`${index + 1}-savol noto‘g‘ri formatda. Xavfsizlik uchun test ochilmadi.`);
    }
    return question;
  });
  if (questions.length !== expectedCount || (result.questionCount && result.questionCount !== questions.length)) throw new Error('Testdagi savollar soni tanlangan miqdorga mos kelmadi.');
  if (expectedLanguage !== 'auto' && result.language && result.language !== expectedLanguage) throw new Error('Test tanlangan tilda yaratilmagan. Qayta urinib ko‘ring.');
  return { ...result, questions, questionCount: questions.length } as DocumentQuizResult;
}

export async function createDocumentQuiz(
  file: { uri: string; name: string; mimeType?: string | null; file?: Blob },
  options: { count: number; difficulty: Difficulty; language: 'auto' | 'uz' | 'ru' | 'en' },
  controls: { signal?: AbortSignal; onPhase?: (phase: DocumentQuizPhase) => void } = {},
): Promise<DocumentQuizResult> {
  const token = await getToken();
  if (!token) throw new Error('Tizimga qayta kirishingiz kerak.');
  const form = new FormData();
  if (Platform.OS === 'web' && file.file) form.append('file', file.file, file.name);
  else form.append('file', { uri: file.uri, name: file.name, type: file.mimeType || 'application/octet-stream' } as unknown as Blob);
  form.append('count', String(options.count));
  form.append('difficulty', options.difficulty);
  form.append('language', options.language);

  controls.onPhase?.('uploading');
  let response: Response | null = null;
  for (let attempt = 0; attempt < 3; attempt += 1) {
    try {
      response = await fetch(`${API_BASE_URL}/api/learning/document-quiz`, {
        method: 'POST',
        headers: { Accept: 'application/json', Authorization: `Bearer ${token}` },
        body: form,
        signal: controls.signal,
      });
      if (response.status !== 429 && response.status < 500) break;
    } catch (error) {
      if (controls.signal?.aborted) throw new Error('Bekor qilindi.');
      if (attempt === 2) throw new Error('Internet bilan aloqa uzildi. Aloqani tekshirib, qayta urinib ko‘ring.');
    }
    if (attempt < 2) await new Promise((resolve) => setTimeout(resolve, 1000 * 2 ** attempt));
  }
  if (!response) throw new Error('Server bilan bog‘lanib bo‘lmadi. Keyinroq qayta urinib ko‘ring.');
  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    const message = typeof data.message === 'string' ? data.message : 'Hujjatdan test yaratib bo‘lmadi.';
    throw new Error(message);
  }
  if (data.status !== 'queued' && data.status !== 'active' && data.status !== 'completed') {
    controls.onPhase?.('done');
    return validateDocumentQuizResult(data, options.count, options.language);
  }
  if (data.status === 'completed' && data.result) {
    controls.onPhase?.('done');
    return validateDocumentQuizResult(data.result, options.count, options.language);
  }
  const jobId = typeof data.jobId === 'string' ? data.jobId : '';
  if (!jobId) throw new Error('Test navbati identifikatori kelmadi. Qayta urinib ko‘ring.');
  controls.signal?.addEventListener('abort', () => {
    void fetch(`${API_BASE_URL}/api/learning/jobs/${encodeURIComponent(jobId)}`, {
      method: 'DELETE', headers: { Accept: 'application/json', Authorization: `Bearer ${token}` },
    }).catch(() => undefined);
  }, { once: true });

  const deadline = Date.now() + 10 * 60 * 1000;
  let delay = 1800;
  while (Date.now() < deadline) {
    if (controls.signal?.aborted) throw new Error('Bekor qilindi.');
    await new Promise<void>((resolve, reject) => {
      const onAbort = () => { clearTimeout(timer); reject(new Error('Bekor qilindi.')); };
      const timer = setTimeout(() => { controls.signal?.removeEventListener('abort', onAbort); resolve(); }, delay);
      controls.signal?.addEventListener('abort', onAbort, { once: true });
    });
    try {
      const statusResponse = await fetch(`${API_BASE_URL}/api/learning/jobs/${encodeURIComponent(jobId)}`, {
        headers: { Accept: 'application/json', Authorization: `Bearer ${token}` },
        signal: controls.signal,
      });
      if (statusResponse.status === 429 || statusResponse.status >= 500) {
        delay = Math.min(delay * 2, 12_000);
        continue;
      }
      const status = await statusResponse.json().catch(() => ({}));
      if (!statusResponse.ok) throw new Error(typeof status.message === 'string' ? status.message : 'Test holatini tekshirib bo‘lmadi.');
      const step = status.progress?.step;
      if (step === 'reading' || (status.status === 'active' && !step)) controls.onPhase?.('reading');
      else if (step === 'generating') controls.onPhase?.('generating');
      if (status.status === 'completed' && status.result) {
        controls.onPhase?.('done');
        return validateDocumentQuizResult(status.result, options.count, options.language);
      }
      if (status.status === 'failed') throw new Error(typeof status.error === 'string' ? status.error : 'AI test yaratishda xatolik yuz berdi.');
      delay = 1800;
    } catch (error) {
      if (controls.signal?.aborted) throw new Error('Bekor qilindi.');
      if (error instanceof Error && !/network|fetch|timeout/i.test(error.message)) throw error;
      delay = Math.min(delay * 2, 12_000);
    }
  }
  throw new Error('Test yaratish uzoq davom etdi. Fayl saqlangan, qayta urinib ko‘rishingiz mumkin.');
}

export interface SmartPracticeResult {
  title: string;
  topicId: string;
  personalized: boolean;
  questionCount: number;
  questions: DocumentQuizQuestion[];
}

export const createSmartPractice = async (count: number, language: 'uz' | 'ru' | 'en') => {
  const result = await learningRequest<SmartPracticeResult & { status?: 'queued' | 'active' | 'completed'; jobId?: string; result?: SmartPracticeResult }>(
    '/api/learning/smart-practice',
    { method: 'POST', body: JSON.stringify({ count, language }) },
  );
  if (result.status === 'queued' || result.status === 'active') {
    return waitForLearningJob<SmartPracticeResult>(String(result.jobId));
  }
  if (result.status === 'completed' && result.result) return result.result as SmartPracticeResult;
  return result;
};
