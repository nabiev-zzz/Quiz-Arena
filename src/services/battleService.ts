
import { io, Socket } from 'socket.io-client';
import { API_BASE_URL } from '../config/api';
import { getToken } from './authService';

export type BattleMode = 'casual' | 'ranked' | 'private';

export interface BattlePlayer {
  id: string;
  username: string;
}

export interface BattleQuestion {
  matchId: string;
  questionId: string;
  questionIndex: number;
  totalQuestions: number;
  question: string;
  options: string[];
  duration: number;
  endsAt: string;
  alreadyAnswered?: boolean;
}

export interface BattleScores {
  [playerId: string]: number;
}

export interface BattleQuestionResult {
  matchId: string;
  questionIndex: number;
  correctAnswer: number;
  answers: Record<string, number | null>;
  points: Record<string, number>;
  scores: BattleScores;
  explanation: string;
}

export interface BattleFinished {
  matchId: string;
  roomCode: string;
  scores: BattleScores;
  winnerId: string | null;
  draw: boolean;
  totalQuestions: number;
  message: string;
  rankChanges?: Record<string, {
    userId: string;
    previousPoints: number;
    rankPoints: number;
    delta: number;
    rankTier: string;
  }>;
}

export interface BattleMatched {
  matchId: string;
  roomCode: string;
  mode: BattleMode;
  status: string;
  players: BattlePlayer[];
  message: string;
}

export interface BattleStarted {
  matchId: string;
  roomCode: string;
  mode: BattleMode;
  totalQuestions: number;
  questionDuration: number;
  players: BattlePlayer[];
  message: string;
}

export interface BattleHistoryItem {
  id: string;
  roomCode: string;
  mode: string;
  status: string;
  playerOneId: string;
  playerTwoId: string | null;
  winnerId: string | null;
  scores: BattleScores;
  startedAt: string | null;
  finishedAt: string | null;
  createdAt: string;
}

export interface BattleStats {
  totalMatches: number;
  wins: number;
  losses: number;
  draws: number;
  winRate: number;
  [key: string]: unknown;
}

export interface BattleLeaderboardEntry {
  userId: string;
  username: string;
  displayName?: string;
  avatarUrl?: string | null;
  rank?: number;
  rankPoints: number;
  rankTier: string;
  wins: number;
  losses: number;
  draws: number;
  points: number;
  matches?: number;
  winRate?: number;
  [key: string]: unknown;
}

export type BattleSocket = Socket;

async function authenticatedRequest<T>(
  endpoint: string,
): Promise<T> {
  const token = await getToken();

  if (!token) {
    throw new Error('Tizimga qayta kiring. Token topilmadi.');
  }

  const response = await fetch(`${API_BASE_URL}${endpoint}`, {
    method: 'GET',
    headers: {
      Accept: 'application/json',
      Authorization: `Bearer ${token}`,
    },
  });

  const data = await response.json().catch(() => null);

  if (!response.ok) {
    throw new Error(
      data?.message || `Server xatosi: ${response.status}`,
    );
  }

  return data as T;
}

export async function createBattleSocket(): Promise<BattleSocket> {
  const token = await getToken();

  if (!token) {
    throw new Error('Battle uchun tizimga kirishingiz kerak.');
  }

  return io(`${API_BASE_URL}/battle`, {
    transports: ['polling', 'websocket'],
    auth: {
      token,
    },
    reconnection: true,
    reconnectionAttempts: 10,
    reconnectionDelay: 1000,
    reconnectionDelayMax: 5000,
    timeout: 15000,
    autoConnect: true,
  });
}

export async function getBattleHistory(
  limit = 20,
): Promise<BattleHistoryItem[]> {
  return authenticatedRequest<BattleHistoryItem[]>(
    `/api/battle/history?limit=${limit}`,
  );
}

export async function getBattleStats(): Promise<BattleStats> {
  return authenticatedRequest<BattleStats>('/api/battle/stats');
}

export async function getBattleLeaderboard(
  limit = 50,
): Promise<BattleLeaderboardEntry[]> {
  const response = await authenticatedRequest<
    | BattleLeaderboardEntry[]
    | { total: number; leaderboard: BattleLeaderboardEntry[] }
  >(`/api/battle/leaderboard?limit=${limit}`);

  return Array.isArray(response)
    ? response
    : response.leaderboard ?? [];
}
