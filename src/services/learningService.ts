import { Platform } from 'react-native';
import { File as ExpoFile } from 'expo-file-system';
import { API_BASE_URL, apiFetch, getToken } from './authService';
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

  const response = await apiFetch(`${API_BASE_URL}${endpoint}`, {
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
  topicId: string;
  sourceFileName: string;
  questionCount: number;
  questions: DocumentQuizQuestion[];
}

export async function createDocumentQuiz(
  file: { uri: string; name: string; mimeType?: string | null; file?: Blob | null },
  options: { count: number; difficulty: Difficulty; language: 'uz' | 'ru' | 'en' },
): Promise<DocumentQuizResult> {
  const token = await getToken();
  if (!token) throw new Error('Tizimga qayta kirishingiz kerak.');
  if (!file.uri?.trim() || !file.name?.trim()) {
    throw new Error('Tanlangan hujjat manzili topilmadi. Faylni qayta tanlang.');
  }

  // React Native FormData accepts native file parts ({ uri, name, type }).
  // Expo DocumentPicker's optional asset.file is a Blob on some platforms;
  // appending that Blob causes "Unsupported FormDataPart implementation" on Android.
  const extension = file.name.toLowerCase().split('.').pop();
  const mimeByExtension: Record<string, string> = {
    pdf: 'application/pdf',
    docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    txt: 'text/plain',
    md: 'text/markdown',
    csv: 'text/csv',
    pptx: 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
    png: 'image/png',
    jpg: 'image/jpeg',
    jpeg: 'image/jpeg',
  };
  const mimeType = file.mimeType || mimeByExtension[extension || ''] || 'application/octet-stream';
  const form = new FormData();

  if (Platform.OS === 'web') {
    // Browser FormData requires a real Blob/File. React Native's { uri, name, type }
    // pseudo-file object is only understood by native networking and is stringified on web.
    let browserFile = file.file;
    if (!(browserFile instanceof Blob)) {
      const fileResponse = await fetch(file.uri);
      if (!fileResponse.ok) throw new Error('Tanlangan hujjatni brauzer xotirasidan o‘qib bo‘lmadi. Faylni qayta tanlang.');
      browserFile = await fileResponse.blob();
    }
    const uploadBlob = browserFile.type ? browserFile : new Blob([browserFile], { type: mimeType });
    form.append('file', uploadBlob, file.name);
  } else {
    // expo-file-system File is not a native FormData Blob part on every RN
    // runtime. Read its bytes and wrap them in a real JS Blob; Expo's patched
    // FormData/fetch supports Blob and avoids the unsupported-part converter.
    let fileBytes: Uint8Array;
    try {
      fileBytes = await new ExpoFile(file.uri).bytes();
    } catch {
      throw new Error('Telefon xotirasidagi hujjatni o‘qib bo‘lmadi. Faylni qayta tanlang.');
    }
    const uploadBlob = new Blob([fileBytes], { type: mimeType });
    form.append('file', uploadBlob, file.name);
  }
  form.append('count', String(options.count));
  form.append('difficulty', options.difficulty);
  form.append('language', options.language);

  const response = await apiFetch(`${API_BASE_URL}/api/learning/document-quiz`, {
    method: 'POST',
    // Do not set Content-Type manually: fetch must add the multipart boundary.
    headers: { Accept: 'application/json', Authorization: `Bearer ${token}` },
    body: form,
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    const message = typeof data.message === 'string'
      ? data.message
      : Array.isArray(data.message) ? data.message.join(', ')
      : 'Hujjatdan test yaratib bo‘lmadi.';
    throw new Error(message);
  }
  if ((data.status === 'queued' || data.status === 'active') && data.jobId) {
    return waitForLearningJob<DocumentQuizResult>(String(data.jobId));
  }
  if (data.status === 'completed' && data.result) return data.result as DocumentQuizResult;
  if (!Array.isArray(data.questions) || data.questions.length === 0) {
    throw new Error('AI hujjatdan savollar qaytarmadi. Boshqa hujjat tanlab ko‘ring.');
  }
  return data as DocumentQuizResult;
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
