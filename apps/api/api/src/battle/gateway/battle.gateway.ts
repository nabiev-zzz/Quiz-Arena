
import {
  ConnectedSocket,
  MessageBody,
  OnGatewayConnection,
  OnGatewayDisconnect,
  SubscribeMessage,
  WebSocketGateway,
  WebSocketServer,
} from '@nestjs/websockets';
import { OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { BadRequestException, Logger } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Namespace, Socket } from 'socket.io';
import { randomUUID } from 'node:crypto';
import { FeatureUsageService } from '../../subscriptions/feature-usage.service';
import { getAllowedCorsOrigins } from '../../cors.config';

import { User } from '../../users/entities/user.entity';
import {
  BattleQuestionResult,
  BattleService,
} from '../battle.service';
import { BattleQuestion } from '../entities/battle-question.entity';
import { BattleStateSnapshot, BattleStateStore } from '../battle-state.store';

interface QueueJoinPayload {
  mode?: 'casual' | 'ranked';
  categoryId?: string;
}

interface AnswerPayload {
  matchId?: string;
  questionIndex?: number;
  answerIndex?: number;
}

interface ReconnectPayload {
  matchId?: string;
}

interface NextReadyPayload {
  matchId?: string;
  questionIndex?: number;
}

interface PrivateBattleRoom {
  roomCode: string;
  hostUserId: string;
  hostSocketId: string;
  expiresAt: number;
  timer: ReturnType<typeof setTimeout>;
}

interface ActiveBattle {
  matchId: string;
  room: string;
  roomCode: string;
  mode: string;
  playerIds: string[];
  usernames: Record<string, string>;
  socketIds: Record<string, string>;
  questions: BattleQuestion[];
  scores: Record<string, number>;
  questionIndex: number;
  answers: Record<string, number | null>;
  results: BattleQuestionResult[];
  deadline: number;
  timer: ReturnType<typeof setTimeout> | null;
  timerQuestionIndex?: number;
  nextTimer: ReturnType<typeof setTimeout> | null;
  disconnectTimers: Map<string, ReturnType<typeof setTimeout>>;
  resolving: boolean;
  questionResolved: boolean;
  finishing?: boolean;
  finishAttempts?: number;
  readyPlayers: Set<string>;
  disconnectedAt: Record<string, number>;
}

@WebSocketGateway({
  namespace: '/battle',
  cors: {
    origin: getAllowedCorsOrigins(),
    credentials: true,
  },
})
export class BattleGateway
  implements OnGatewayConnection, OnGatewayDisconnect, OnModuleInit, OnModuleDestroy
{
  private readonly logger = new Logger(BattleGateway.name);
  private readonly activeBattles = new Map<string, ActiveBattle>();
  private readonly queuedSockets = new Map<string, string>();
  private readonly privateRooms = new Map<string, PrivateBattleRoom>();
  private readonly privateJoinAttempts = new Map<string, { count: number; windowStartedAt: number }>();
  private readonly questionDuration = 20_000;
  private readonly reconnectGracePeriod = 30_000;
  private reconciliationTimer: ReturnType<typeof setInterval> | null = null;

  @WebSocketServer()
  server: Namespace;

  constructor(
    private readonly jwtService: JwtService,
    private readonly battleService: BattleService,
    @InjectRepository(User)
    private readonly userRepository: Repository<User>,
    private readonly featureUsageService: FeatureUsageService,
    private readonly battleStateStore: BattleStateStore,
  ) {}


  async onModuleInit(): Promise<void> {
    if (!this.battleStateStore.isReady()) return;

    const savedBattles = await this.battleStateStore.listActive();
    for (const snapshot of savedBattles) {
      let saved = snapshot;
      if (
        (saved.resolving || saved.finishing) &&
        Date.now() - saved.updatedAt >= 60_000
      ) {
        saved = (await this.battleStateStore.recoverStaleTransition(saved.matchId)) || saved;
      }

      const battle: ActiveBattle = {
        ...saved,
        socketIds: { ...saved.socketIds },
        timer: null,
        nextTimer: null,
        disconnectTimers: new Map<string, ReturnType<typeof setTimeout>>(),
        readyPlayers: new Set(saved.readyPlayers || []),
        disconnectedAt: { ...saved.disconnectedAt },
        resolving: saved.resolving,
        finishing: saved.finishing,
      };

      this.activeBattles.set(battle.matchId, battle);

      // Keep socket ownership from other live API replicas intact. A restarted
      // client replaces its socket through battle:reconnect; clearing every
      // socket ID here would disconnect players served by a different replica.
      const now = Date.now();
      const shouldAdvance =
        battle.questionResolved &&
        battle.readyPlayers.size === battle.playerIds.length;

      if (!battle.questionResolved && !battle.resolving) {
        const delay = Math.max(0, battle.deadline - now);
        battle.timerQuestionIndex = battle.questionIndex;
        battle.timer = setTimeout(() => {
          battle.timer = null;
          battle.timerQuestionIndex = undefined;
          void this.resolveQuestion(battle);
        }, delay);
      }

      if (shouldAdvance) await this.advanceIfReady(battle);
      this.logger.warn(`Battle Redisdan tiklandi: ${battle.roomCode}`);
    }

    // Every API node discovers matches created after it booted. Timers may be
    // scheduled on several nodes; Redis claims ensure only one node resolves.
    this.reconciliationTimer = setInterval(() => {
      void this.reconcileActiveBattles().catch((error) =>
        this.logger.error('Battle Redis reconciliation xatosi:', error),
      );
    }, 2_000);
  }

  async onModuleDestroy(): Promise<void> {
    if (this.reconciliationTimer) clearInterval(this.reconciliationTimer);
    this.reconciliationTimer = null;
    for (const battle of this.activeBattles.values()) this.clearBattleTimers(battle);
  }

  private async reconcileActiveBattles(): Promise<void> {
    if (!this.battleStateStore.isReady()) return;
    const snapshots = await this.battleStateStore.listActive();

    for (const snapshot of snapshots) {
      let saved = snapshot;
      if (
        (saved.resolving || saved.finishing) &&
        Date.now() - saved.updatedAt >= 60_000
      ) {
        saved = (await this.battleStateStore.recoverStaleTransition(saved.matchId)) || saved;
      }

      let battle = this.activeBattles.get(saved.matchId);
      if (!battle) {
        battle = this.fromSnapshot(saved);
        this.activeBattles.set(saved.matchId, battle);
      }

      if (
        (!battle.timer || battle.timerQuestionIndex !== saved.questionIndex) &&
        !saved.questionResolved &&
        !saved.resolving
      ) {
        if (battle.timer) clearTimeout(battle.timer);
        const delay = Math.max(0, saved.deadline - Date.now());
        battle.timerQuestionIndex = saved.questionIndex;
        battle.timer = setTimeout(() => {
          battle!.timer = null;
          battle!.timerQuestionIndex = undefined;
          void this.resolveQuestion(battle!);
        }, delay);
      } else if (
        saved.questionResolved &&
        saved.readyPlayers.length === saved.playerIds.length
      ) {
        void this.advanceIfReady(battle);
      }
    }
  }

  private toSnapshot(battle: ActiveBattle): BattleStateSnapshot {
    return {
      version: 1,
      matchId: battle.matchId,
      room: battle.room,
      roomCode: battle.roomCode,
      mode: battle.mode,
      playerIds: [...battle.playerIds],
      usernames: { ...battle.usernames },
      socketIds: { ...battle.socketIds },
      questions: battle.questions,
      scores: { ...battle.scores },
      questionIndex: battle.questionIndex,
      answers: { ...battle.answers },
      results: [...battle.results],
      deadline: battle.deadline,
      resolving: battle.resolving,
      questionResolved: battle.questionResolved,
      finishing: Boolean(battle.finishing),
      finishAttempts: battle.finishAttempts || 0,
      readyPlayers: [...battle.readyPlayers],
      disconnectedAt: { ...battle.disconnectedAt },
      updatedAt: Date.now(),
    };
  }

  private async persistBattle(battle: ActiveBattle): Promise<void> {
    await this.battleStateStore.save(this.toSnapshot(battle));
  }


  private fromSnapshot(saved: BattleStateSnapshot): ActiveBattle {
    return {
      ...saved,
      timer: null,
      nextTimer: null,
      disconnectTimers: new Map<string, ReturnType<typeof setTimeout>>(),
      readyPlayers: new Set(saved.readyPlayers || []),
      disconnectedAt: { ...saved.disconnectedAt },
    };
  }

  private applySnapshot(battle: ActiveBattle, saved: BattleStateSnapshot): void {
    battle.socketIds = { ...saved.socketIds };
    battle.questions = saved.questions;
    battle.scores = { ...saved.scores };
    battle.questionIndex = saved.questionIndex;
    battle.answers = { ...saved.answers };
    battle.results = [...saved.results];
    battle.deadline = saved.deadline;
    battle.resolving = saved.resolving;
    battle.questionResolved = saved.questionResolved;
    battle.finishing = saved.finishing;
    battle.finishAttempts = saved.finishAttempts;
    battle.readyPlayers = new Set(saved.readyPlayers);
    battle.disconnectedAt = { ...saved.disconnectedAt };
  }

  private async getActiveBattle(matchId: string): Promise<ActiveBattle | undefined> {
    const saved = await this.battleStateStore.get(matchId);
    if (!saved) return undefined;

    const local = this.activeBattles.get(matchId);
    if (local) {
      this.applySnapshot(local, saved);
      return local;
    }

    const battle = this.fromSnapshot(saved);
    this.activeBattles.set(matchId, battle);
    return battle;
  }

  async handleConnection(client: Socket): Promise<void> {
    try {
      const authToken = client.handshake.auth?.token;
      const header = client.handshake.headers.authorization;

      let token =
        typeof authToken === 'string'
          ? authToken
          : typeof header === 'string'
            ? header
            : '';

      token = token.replace(/^Bearer\s+/i, '').trim();

      if (!token) {
        throw new Error('Token