
import { API_BASE_URL, getToken } from './authService';

export interface AiTutorMessage {
  id: string;
  userId: string;
  role: 'user' | 'assistant';
  content: string;
  createdAt: string;
}

interface AiTutorChatResponse {
  userMessage: AiTutorMessage;
  assistantMessage: AiTutorMessage;
  usage?: { limit: number | null; remaining: number | null; used: number | null };
}

interface AiTutorHistoryResponse {
  messages: AiTutorMessage[];
}

async function tutorRequest<T>(
  endpoint: string,
  options: RequestInit = {},
): Promise<T> {
  const token = await getToken();

  if (!token) {
    throw new Error('Tizimga qayta kirishingiz kerak');
  }

  const response = await fetch(`${API_BASE_URL}${endpoint}`, {
    ...options,
    headers: {
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
        : 'AI Ustoz bilan aloqa qilishda xatolik',
    );
  }

  return data as T;
}

async function waitForTutorJob(jobId: string): Promise<AiTutorChatResponse> {
  for (let attempt = 0; attempt < 120; attempt += 1) {
    await new Promise((resolve) => setTimeout(resolve, 3000));
    const status = await tutorRequest<{
      status: 'queued' | 'active' | 'completed' | 'failed';
      result?: AiTutorChatResponse;
      error?: string;
    }>(`/api/ai/jobs/${encodeURIComponent(jobId)}`);
    if (status.status === 'completed' && status.result) return status.result;
    if (status.status === 'failed') throw new Error(status.error || 'AI Ustoz javob bera olmadi.');
  }
  throw new Error('AI Ustoz navbatida kutish vaqti tugadi. Qayta urinib ko‘ring.');
}

export async function sendTutorMessage(
  message: string,
  signal?: AbortSignal,
): Promise<AiTutorChatResponse> {
  const queued = await tutorRequest<AiTutorChatResponse & { status?: 'queued' | 'active' | 'completed'; jobId?: string; result?: AiTutorChatResponse }>('/api/ai/tutor/chat', {
    method: 'POST',
    signal,
    body: JSON.stringify({
      message: message.trim(),
      language: 'uz',
    }),
  });
  if (queued.status === 'queued' || queued.status === 'active') {
    return waitForTutorJob(String(queued.jobId));
  }
  if (queued.status === 'completed' && queued.result) return queued.result;
  return queued;
}

export async function getTutorHistory(
  signal?: AbortSignal,
): Promise<AiTutorMessage[]> {
  const result = await tutorRequest<AiTutorHistoryResponse>(
    '/api/ai/tutor/history',
    {
      method: 'GET',
      signal,
    },
  );

  return result.messages;
}
