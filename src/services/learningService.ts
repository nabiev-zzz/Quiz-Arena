import { Platform } from 'react-native';
import { File as ExpoFile, UploadType } from 'expo-file-system';
import { API_BASE_URL, apiFetch, getToken } from './authService';
import type { Difficulty } from '../types';
import type { Question } from '../data/questions';
import { resolveDocumentMimeType } from '../utils/documentUpload.mjs';

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

export type DocumentQuizProgress = {
  stage: 'uploading' | 'queued' | 'analyzing' | 'completed';
  percent: number | null;
  message: string;
};

async function waitForLearningJob<T>(jobId: string, onProgress?: (progress: DocumentQuizProgress) => void): Promise<T> {
  for (let attempt = 0; attempt < 120; attempt += 1) {
    await new Promise((resolve) => setTimeout(resolve, 3000));
    const status = await learningRequest<{
      status: 'queued' | 'active' | 'completed' | 'failed';
      result?: T;
      error?: string;
    }>(`/api/learning/jobs/${encodeURIComponent(jobId)}`);
    if (status.status === 'completed' && status.result) {
      onProgress?.({ stage: 'completed', percent: 100, message: 'Test tayyor — ochilmoqda' });
      return status.result;
    }
    if (status.status === 'failed') throw new Error(status.error || 'AI test yaratishda xatolik yuz berdi.');
    onProgress?.(status.status === 'queued'
      ? { stage: 'queued', percent: null, message: 'Vazifa navbatda — AI bo‘shashini kutmoqda' }
      : { stage: 'analyzing', percent: null, message: 'AI hujjatni o‘qib, savollarni tayyorlamoqda' });
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
  file: { uri: string; name: string; mimeType?: string | null; file?: Blob | null; size?: number | null },
  options: { count: number; difficulty: Difficulty; language: 'uz' | 'ru' | 'en' },
  onProgress?: (progress: DocumentQuizProgress) => void,
): Promise<DocumentQuizResult> {
  const token = await getToken();
  if (!token) throw new Error('Tizimga qayta kirishingiz kerak.');
  if (!file.uri?.trim() || !file.name?.trim()) throw new Error('Tanlangan hujjat manzili topilmadi. Faylni qayta tanlang.');

  const mimeType = resolveDocumentMimeType(file.name, file.mimeType);
  const uploadUrl = `${API_BASE_URL}/api/learning/document-quiz`;
  const uploadHeaders = { Accept: 'application/json', Authorization: `Bearer ${token}` };
  let responseStatus = 0;
  let responseText = '';

  if (Platform.OS === 'web') {
    const form = new FormData();
    let browserFile = file.file;
    if (!(browserFile instanceof Blob)) {
      const fileResponse = await fetch(file.uri);
      if (!fileResponse.ok) throw new Error('Tanlangan hujjatni brauzer xotirasidan o‘qib bo‘lmadi. Faylni qayta tanlang.');
      browserFile = await fileResponse.blob();
    }
    const uploadBlob = browserFile.type === mimeType ? browserFile : new Blob([browserFile], { type: mimeType });
    form.append('file', uploadBlob, file.name);
    form.append('count', String(options.count));
    form.append('difficulty', options.difficulty);
    form.append('language', options.language);
    onProgress?.({ stage: 'uploading', percent: 0, message: 'Hujjat serverga yuklanmoqda' });
    const response = await new Promise<{ status: number; body: string }>((resolve, reject) => {
      const xhr = new XMLHttpRequest();
      xhr.open('POST', uploadUrl);
      xhr.setRequestHeader('Accept', uploadHeaders.Accept);
      xhr.setRequestHeader('Authorization', uploadHeaders.Authorization);
      xhr.timeout = 180000;
      xhr.upload.onprogress = (event) => {
        if (event.lengthComputable && event.total > 0) {
          const percent = Math.min(100, Math.round((event.loaded / event.total) * 100));
          onProgress?.({ stage: 'uploading', percent, message: `Hujjat yuklanmoqda · ${percent}%` });
        }
      };
      xhr.upload.onload = () => onProgress?.({ stage: 'queued', percent: 100, message: 'Yuklash tugadi · Server hujjatni qabul qilmoqda' });
      xhr.onload = () => resolve({ status: xhr.status, body: xhr.responseText || '' });
      xhr.onerror = () => reject(new Error('Internet aloqasi uzildi. Yuklashni qayta urinib ko‘ring.'));
      xhr.ontimeout = () => reject(new Error('Hujjatni yuklash vaqti tugadi. Internetni tekshirib, qayta urinib ko‘ring.'));
      xhr.onabort = () => reject(new Error('Hujjat yuklash bekor qilindi.'));
      xhr.send(form);
    });
    responseStatus = response.status;
    responseText = response.body;
  } else {
    // Use Expo's native file uploader for file:// and content:// URIs. This
    // streams the original file without converting bytes to Blob/ArrayBuffer,
    // avoiding Hermes' unsupported Blob(ArrayBuffer) path on Android.
    const nativeFile = new ExpoFile(file.uri);
    if (!nativeFile.exists) throw new Error('Tanlangan hujjat qurilmada topilmadi. Faylni qayta tanlang.');
    const nativeSize = nativeFile.size;
    if (!Number.isFinite(nativeSize) || nativeSize <= 0) throw new Error('Hujjat hajmini o‘qib bo‘lmadi. Faylni qayta tanlang.');
    if (file.size && file.size > 0 && nativeSize !== file.size) throw new Error('Tanlangan hujjat to‘liq o‘qilmadi. Faylni qayta tanlang.');
    onProgress?.({ stage: 'uploading', percent: 0, message: 'Hujjat serverga yuklanmoqda' });
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 180000);
    try {
      const response = await nativeFile.upload(uploadUrl, {
        httpMethod: 'POST',
        uploadType: UploadType.MULTIPART,
        fieldName: 'file',
        mimeType,
        headers: uploadHeaders,
        parameters: {
          count: String(options.count),
          difficulty: options.difficulty,
          language: options.language,
        },
        signal: controller.signal,
        onProgress: ({ bytesSent, totalBytes }) => {
          if (totalBytes > 0) {
            const percent = Math.min(100, Math.round((bytesSent / totalBytes) * 100));
            onProgress?.({ stage: 'uploading', percent, message: `Hujjat yuklanmoqda · ${percent}%` });
          }
        },
      });
      responseStatus = response.status;
      responseText = response.body || '';
      onProgress?.({ stage: 'queued', percent: 100, message: 'Yuklash tugadi · Server hujjatni qabul qilmoqda' });
    } catch (error) {
      if (controller.signal.aborted) throw new Error('Hujjatni yuklash vaqti tugadi. Internetni tekshirib, qayta urinib ko‘ring.');
      throw new Error(error instanceof Error ? error.message : 'Hujjatni yuklab bo‘lmadi. Faylni qayta tanlang.');
    } finally {
      clearTimeout(timeout);
    }
  }

  let data: any = {};
  try { data = JSON.parse(responseText || '{}'); } catch { /* handled below */ }
  if (responseStatus < 200 || responseStatus >= 300) {
    const serverMessage = typeof data.message === 'string' ? data.message : Array.isArray(data.message) ? data.message.join(' · ') : '';
    throw new Error(serverMessage || (responseStatus ? `Hujjat serverga yuborilmadi (HTTP ${responseStatus}).` : 'Serverdan javob olinmadi.'));
  }
  if (!data || typeof data !== 'object') throw new Error('Serverdan noto‘g‘ri javob keldi. Qayta urinib ko‘ring.');
  if (data.status === 'failed' || data.status === 'error') throw new Error(data.error || data.message || 'AI test yaratishda xatolik yuz berdi.');
  if (data.status === 'queued' || data.status === 'active') {
    onProgress?.(data.status === 'queued'
      ? { stage: 'queued', percent: 100, message: 'Hujjat yuklandi · Navbatda kutilmoqda' }
      : { stage: 'analyzing', percent: 100, message: 'AI hujjatni tahlil qilmoqda' });
    return waitForLearningJob<DocumentQuizResult>(String(data.jobId), onProgress);
  }
  if (data.status === 'completed' && data.result) {
    onProgress?.({ stage: 'completed', percent: 100, message: 'Test tayyor — ochilmoqda' });
    return data.result as DocumentQuizResult;
  }
  if (!Array.isArray(data.questions) || data.questions.length === 0) throw new Error('AI hujjatdan savollar qaytarmadi. Boshqa hujjat tanlab ko‘ring.');
  onProgress?.({ stage: 'completed', percent: 100, message: 'Test tayyor — ochilmoqda' });
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
