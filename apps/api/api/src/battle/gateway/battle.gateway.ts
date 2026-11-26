
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
    origin: true,
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
        disconnectedAt: { ...(saved.disconnectedAt || {}) },
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
      disconnectedAt: { ...(saved.disconnectedAt || {}) },
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
        throw new Error('Token topilmadi');
      }

      const payload = await this.jwtService.verifyAsync<{
        sub: string;
      }>(token);

      if (!payload.sub) {
        throw new Error('Token foydalanuvchi ID sini bermadi');
      }

      const user = await this.userRepository.findOne({
        where: {
          id: payload.sub,
          status: 'active',
        },
        select: {
          id: true,
          displayName: true,
          username: true,
          status: true,
        },
      });

      if (!user) {
        throw new Error('Foydalanuvchi faol emas');
      }

      client.data.userId = user.id;
      client.data.username = user.username;

      client.emit('battle:connected', {
        connected: true,
        userId: user.id,
        username: user.username,
      });

      this.logger.log(`Battle socket ulandi: ${user.username}`);
    } catch (error) {
      this.logger.warn(
        `Battle autentifikatsiya xatosi: ${
          error instanceof Error ? error.message : 'Noma’lum xato'
        }`,
      );

      client.emit('battle:error', {
        message: 'Autentifikatsiya muvaffaqiyatsiz. Qayta kiring.',
      });

      client.disconnect(true);
    }
  }

  async handleDisconnect(client: Socket): Promise<void> {
    const userId = client.data.userId as string | undefined;

    if (!userId) {
      return;
    }

    await this.cleanupPrivateRoomsForSocket(client.id);

    const queueKey = this.queuedSockets.get(client.id);

    if (queueKey) {
      await this.battleService
        .leaveQueue(queueKey, userId, client.id)
        .catch(() => undefined);

      this.queuedSockets.delete(client.id);
    }

    for (const battle of this.activeBattles.values()) {
      if (!battle.playerIds.includes(userId)) {
        continue;
      }

      if (battle.socketIds[userId] !== client.id) {
        continue;
      }

      delete battle.socketIds[userId];

      this.logger.warn(
        `${userId} Battle xonasidan uzildi: ${battle.roomCode}`,
      );

      const oldTimer = battle.disconnectTimers.get(userId);

      if (oldTimer) {
        clearTimeout(oldTimer);
      }

      const timer = setTimeout(() => {
        void this.handleReconnectTimeout(battle.matchId, userId);
      }, this.reconnectGracePeriod);

      battle.disconnectTimers.set(userId, timer);
      battle.disconnectedAt[userId] = Date.now();
      await this.persistBattle(battle).catch((error) => this.logger.error('Battle uzilish holati saqlanmadi:', error));
    }
  }

  @SubscribeMessage('battle:private:create')
  async createPrivateRoom(@ConnectedSocket() client: Socket): Promise<void> {
    const userId = client.data.userId as string | undefined;
    if (!userId) {
      client.emit('battle:error', { message: 'Avval tizimga kiring.' });
      return;
    }
    if (this.queuedSockets.has(client.id)) {
      client.emit('battle:error', { message: 'Avval raqib qidirish navbatidan chiqing.' });
      return;
    }
    if ([...this.activeBattles.values()].some((battle) => battle.playerIds.includes(userId))) {
      client.emit('battle:error', { message: 'Avval joriy Battle ni yakunlang.' });
      return;
    }
    if ([...this.privateRooms.values()].some((room) => room.hostUserId === userId)) {
      client.emit('battle:error', { message: 'Sizda allaqachon faol taklif xonasi bor.' });
      return;
    }

    let quotaConsumed = false;
    try {
      const quota = await this.featureUsageService.consume(userId, 'privateBattle');
      if (!quota.allowed) {
        throw new BadRequestException('Do‘stlar Battle uchun kunlik tarif limiti tugagan.');
      }
      quotaConsumed = true;

      const roomCode = randomUUID().replace(/-/g, '').slice(0, 12).toUpperCase();
      const expiresAt = Date.now() + 10 * 60 * 1000;
      const timer = setTimeout(() => { void this.expirePrivateRoom(roomCode); }, 10 * 60 * 1000);
      this.privateRooms.set(roomCode, { roomCode, hostUserId: userId, hostSocketId: client.id, expiresAt, timer });

      client.emit('battle:private:created', {
        roomCode,
        status: 'waiting',
        maxPlayers: 2,
        expiresInSeconds: 600,
        quota,
        message: 'Xona yaratildi. Kodni do‘stingizga yuboring.',
      });
    } catch (error) {
      if (quotaConsumed) {
        try { await this.featureUsageService.refund(userId, 'privateBattle'); } catch { /* Preserve the original room error. */ }
      }
      client.emit('battle:error', {
        message: error instanceof Error ? error.message : 'Xususiy Battle xonasi yaratilmadi.',
      });
    }
  }

  @SubscribeMessage('battle:private:join')
  async joinPrivateRoom(
    @ConnectedSocket() client: Socket,
    @MessageBody() payload?: { roomCode?: string; code?: string },
  ): Promise<void> {
    const userId = client.data.userId as string | undefined;
    const roomCode = String(payload?.roomCode || payload?.code || '').trim().toUpperCase();
    if (!userId) {
      client.emit('battle:error', { message: 'Avval tizimga kiring.' });
      return;
    }

    const now = Date.now();
    const previousAttempts = this.privateJoinAttempts.get(userId);
    const attempts = !previousAttempts || now - previousAttempts.windowStartedAt >= 60_000
      ? { count: 0, windowStartedAt: now }
      : previousAttempts;
    if (attempts.count >= 8) {
      client.emit('battle:error', { message: 'Xona kodini tekshirish limiti tugadi. Bir daqiqadan so‘ng qayta urinib ko‘ring.' });
      return;
    }
    attempts.count += 1;
    this.privateJoinAttempts.set(userId, attempts);

    if (!/^[A-F0-9]{12}$/.test(roomCode)) {
      client.emit('battle:error', { message: '12 belgili xona kodi noto‘g‘ri.' });
      return;
    }
    if (this.queuedSockets.has(client.id)) {
      client.emit('battle:error', { message: 'Avval raqib qidirish navbatidan chiqing.' });
      return;
    }
    if ([...this.privateRooms.values()].some((room) => room.hostUserId === userId && room.roomCode !== roomCode)) {
      client.emit('battle:error', { message: 'Avval o‘zingiz yaratgan taklif xonasini bekor qiling.' });
      return;
    }
    if ([...this.activeBattles.values()].some((battle) => battle.playerIds.includes(userId))) {
      client.emit('battle:error', { message: 'Avval joriy Battle ni yakunlang.' });
      return;
    }

    const privateRoom = this.privateRooms.get(roomCode);
    if (!privateRoom || privateRoom.expiresAt <= Date.now()) {
      if (privateRoom) await this.expirePrivateRoom(roomCode);
      client.emit('battle:error', { message: 'Xona topilmadi yoki uning muddati tugagan.' });
      return;
    }
    if (privateRoom.hostUserId === userId) {
      client.emit('battle:error', { message: 'O‘z xonangizga raqib sifatida qo‘shila olmaysiz.' });
      return;
    }

    const hostSocket = this.server.sockets.get(privateRoom.hostSocketId);
    if (!hostSocket || hostSocket.data.userId !== privateRoom.hostUserId) {
      await this.expirePrivateRoom(roomCode);
      client.emit('battle:error', { message: 'Xona egasi serverga ulanmagan.' });
      return;
    }

    clearTimeout(privateRoom.timer);
    this.privateRooms.delete(roomCode);

    try {
      const match = await this.battleService.createMatch(privateRoom.hostUserId, userId, 'private');
      const room = `battle:${match.roomCode}`;
      await Promise.all([hostSocket.join(room), client.join(room)]);

      const matchInfo = {
        matchId: match.id,
        roomCode: match.roomCode,
        mode: 'private',
        status: 'matched',
        players: [
          { id: privateRoom.hostUserId, username: hostSocket.data.username },
          { id: userId, username: client.data.username },
        ],
        message: 'Do‘stingiz qo‘shildi. Battle boshlanmoqda.',
      };

      hostSocket.emit('battle:matched', matchInfo);
      client.emit('battle:matched', matchInfo);
      this.logger.log(`Xususiy Battle boshlandi: ${match.roomCode}`);

      const started = await this.startBattle(
        match.id,
        match.roomCode,
        'private',
        privateRoom.hostUserId,
        userId,
        hostSocket,
        client,
        'general',
      );
      if (!started) {
        try { await this.featureUsageService.refund(privateRoom.hostUserId, 'privateBattle'); } catch { /* Preserve the original match error. */ }
      }
    } catch (error) {
      try { await this.featureUsageService.refund(privateRoom.hostUserId, 'privateBattle'); } catch { /* Preserve the original match error. */ }
      const message = error instanceof Error ? error.message : 'Xususiy Battle boshlanmadi.';
      hostSocket.emit('battle:error', { message });
      client.emit('battle:error', { message });
    }
  }

  @SubscribeMessage('battle:private:cancel')
  async cancelPrivateRoom(
    @ConnectedSocket() client: Socket,
    @MessageBody() payload?: { roomCode?: string },
  ): Promise<void> {
    const userId = client.data.userId as string | undefined;
    const roomCode = String(payload?.roomCode || '').trim().toUpperCase();
    const room = this.privateRooms.get(roomCode);
    if (!userId || !room || room.hostUserId !== userId || room.hostSocketId !== client.id) {
      client.emit('battle:error', { message: 'Xonani bekor qilish huquqi topilmadi.' });
      return;
    }
    clearTimeout(room.timer);
    this.privateRooms.delete(roomCode);
    try { await this.featureUsageService.refund(userId, 'privateBattle'); } catch { /* Preserve the original room error. */ }
    client.emit('battle:private:cancelled', { roomCode });
  }

  private async expirePrivateRoom(roomCode: string): Promise<void> {
    const room = this.privateRooms.get(roomCode);
    if (!room) return;
    clearTimeout(room.timer);
    this.privateRooms.delete(roomCode);
    this.server.sockets.get(room.hostSocketId)?.emit('battle:private:expired', { roomCode });
    try { await this.featureUsageService.refund(room.hostUserId, 'privateBattle'); } catch { /* Preserve room cleanup even if quota refund fails. */ }
  }

  private async cleanupPrivateRoomsForSocket(socketId: string): Promise<void> {
    const ownedRooms = [...this.privateRooms.values()].filter((room) => room.hostSocketId === socketId);
    for (const room of ownedRooms) {
      clearTimeout(room.timer);
      this.privateRooms.delete(room.roomCode);
      try { await this.featureUsageService.refund(room.hostUserId, 'privateBattle'); } catch { /* Preserve room cleanup even if quota refund fails. */ }
    }
  }

  @SubscribeMessage('battle:queue:join')
  async joinQueue(
    @ConnectedSocket() client: Socket,
    @MessageBody() payload?: QueueJoinPayload,
  ): Promise<void> {
    const userId = client.data.userId as string | undefined;

    if (!userId) {
      client.emit('battle:error', {
        message: 'Avval tizimga kiring.',
      });
      return;
    }

    if ([...this.privateRooms.values()].some((room) => room.hostUserId === userId)) {
      client.emit('battle:error', { message: 'Avval xususiy taklif xonasini bekor qiling.' });
      return;
    }

    const mode = payload?.mode === 'ranked' ? 'ranked' : 'casual';
    const rawCategory = payload?.categoryId || 'general';

    const categoryId = /^[a-zA-Z0-9_-]{1,60}$/.test(rawCategory)
      ? rawCategory
      : 'general';

    const queueKey = `battle:queue:${mode}:${categoryId}`;

    try {
      const previousQueue = this.queuedSockets.get(client.id);

      if (previousQueue) {
        await this.battleService.leaveQueue(
          previousQueue,
          userId,
          client.id,
        );
        this.queuedSockets.delete(client.id);
      }

      const opponent = await this.battleService.joinQueue(
        queueKey,
        userId,
        client.id,
      );

      if (!opponent) {
        this.queuedSockets.set(client.id, queueKey);

        client.emit('battle:queue:waiting', {
          status: 'waiting',
          mode,
          categoryId,
          message: 'Raqib qidirilmoqda...',
        });

        return;
      }

      const separator = opponent.indexOf(':');

      if (separator <= 0) {
        throw new Error('Navbatdagi raqib ma’lumoti noto‘g‘ri.');
      }

      const opponentId = opponent.slice(0, separator);
      const opponentSocketId = opponent.slice(separator + 1);

      if (opponentId === userId) {
        throw new BadRequestException(
          'O‘zingiz bilan Battle o‘ynay olmaysiz.',
        );
      }

      const opponentSocket =
        this.server.sockets.get(opponentSocketId);

      if (
        !opponentSocket ||
        opponentSocket.data.userId !== opponentId
      ) {
        const nextOpponent = await this.battleService.joinQueue(
          queueKey,
          userId,
          client.id,
        );

        if (!nextOpponent) {
          this.queuedSockets.set(client.id, queueKey);

          client.emit('battle:queue:waiting', {
            status: 'waiting',
            mode,
            categoryId,
            message: 'Raqib qidirilmoqda...',
          });

          return;
        }

        client.emit('battle:error', {
          message: 'Raqib ulanishida muammo. Qayta urinib ko‘ring.',
        });

        return;
      }

      this.queuedSockets.delete(client.id);
      this.queuedSockets.delete(opponentSocketId);

      const match = await this.battleService.createMatch(
        opponentId,
        userId,
        mode,
      );

      const room = `battle:${match.roomCode}`;

      await Promise.all([
        client.join(room),
        opponentSocket.join(room),
      ]);

      const matchInfo = {
        matchId: match.id,
        roomCode: match.roomCode,
        mode: match.mode,
        status: 'matched',
        players: [
          {
            id: opponentId,
            username: opponentSocket.data.username,
          },
          {
            id: userId,
            username: client.data.username,
          },
        ],
        message: 'Raqib topildi! Battle boshlanmoqda.',
      };

      client.emit('battle:matched', matchInfo);
      opponentSocket.emit('battle:matched', matchInfo);

      this.logger.log(`Battle xonasi yaratildi: ${match.roomCode}`);

      await this.startBattle(
        match.id,
        match.roomCode,
        mode,
        opponentId,
        userId,
        opponentSocket,
        client,
        categoryId,
      );
    } catch (error) {
      this.logger.error(
        'Battle navbatida xatolik:',
        error instanceof Error ? error.stack : String(error),
      );

      client.emit('battle:error', {
        message:
          error instanceof Error
            ? error.message
            : 'Battle navbatida xatolik.',
      });
  