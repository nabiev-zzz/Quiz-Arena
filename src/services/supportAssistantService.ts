import { API_BASE_URL, getToken } from './authService';

export interface SupportChatMessage { id: string; role: 'user' | 'assistant'; content: string; createdAt: string; }

export async function sendSupportMessage(message: string, history: SupportChatMessage[], language: 'uz' | 'ru' | 'en' = 'uz', signal?: AbortSignal): Promise<string> {
  const token = await getToken();
  if (!token) throw new Error('Tizimga qayta kirishingiz kerak');
  const response = await fetch(`${API_BASE_URL}/api/ai/support/chat`, {
    method: 'POST', signal,
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    body: JSON.stringify({ message: message.trim(), language, history: history.slice(-12).map(({ role, content }) => ({ role, content })) }),
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(typeof data.message === 'string' ? data.message : 'AI yordamchi bilan aloqa uzildi.');
  if (typeof data.answer !== 'string' || !data.answer.trim()) throw new Error('AI yordamchi bo‘sh javob qaytardi.');
  return data.answer.trim();
}
