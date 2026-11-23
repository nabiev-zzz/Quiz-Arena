
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

export async function sendTutorMessage(
  message: string,
  signal?: AbortSignal,
): Promise<AiTutorChatResponse> {
  return tutorRequest<AiTutorChatResponse>('/api/ai/tutor/chat', {
    method: 'POST',
    signal,
    body: JSON.stringify({
      message: message.trim(),
      language: 'uz',
    }),
  });
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
