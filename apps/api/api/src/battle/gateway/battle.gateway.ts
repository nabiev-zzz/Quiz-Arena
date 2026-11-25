
import {
  ConnectedSocket,
  MessageBody,
  OnGatewayConnection,
  OnGatewayDisconnect,
  SubscribeMessage,
  WebSocketGateway,
  WebSocketServer,
} from '@nestjs/websockets';
import { OnModuleInit } from '@nestjs/common';
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
  implements OnGatewayConnection, OnGatewayDisconnect, OnModuleInit
{
  private readonly logger = new Logger(BattleGateway.name);
  private readonly activeBattles = new Map<string, ActiveBattle>();
  private readonly queuedSockets = new Map<string, string>();
  private readonly privateRooms = new Map<string, PrivateBattleRoom>();
  private readonly privateJoinAttempts = new Map<string, { count: number; windowStartedAt: number }>();
  private readonly questionDuration = 20_000;
  private readonly reconnectGracePeriod = 30_000;

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
    for (const saved of savedBattles) {
      const battle: ActiveBattle = {
        ...saved,
        socketIds: {},
        timer: null,
        nextTimer: null,
        disconnectTimers: new Map<string, ReturnType<typeof setTimeout>>(),
        readyPlayers: new Set(saved.readyPlayers || []),
        disconnectedAt: { ...(saved.disconnectedAt || {}) },
        resolving: false,
      };

      this.activeBattles.set(battle.matchId, battle);

      // A process restart invalidates old socket IDs. Give both players the
      // normal reconnect grace period and resume the saved question deadline.
      const now = Date.now();
      for (const playerId of battle.playerIds) {
        battle.disconnectedAt[playerId] = now;
        const timer = setTimeout(() => {
          void this.handleReconnectTimeout(battle.matchId, playerId);
        }, this.reconnectGracePeriod);
        battle.disconnectTimers.set(playerId, timer);
      }

      if (!battle.questionResolved) {
        const delay = Math.max(0, battle.deadline - now);
        battle.timer = setTimeout(() => {
          void this.resolveQuestion(battle);
        }, delay);
      }

      await this.persistBattle(battle);
      this.logger.warn(`Battle Redisdan tiklandi: ${battle.roomCode}`);
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
    const local = this.activeBattles.get(matchId);
    if (local) return local;
    const saved = await this.battleStateStore.get(matchId);
    if (!saved) return undefined;
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
    }
  }

  private async startBattle(
    matchId: string,
    roomCode: string,
    mode: string,
    playerOneId: string,
    playerTwoId: string,
    playerOneSocket: Socket,
    playerTwoSocket: Socket,
    categoryId: string,
  ): Promise<boolean> {
    try {
      const questions = await this.battleService.prepareQuestions(
        matchId,
        categoryId === 'general' ? null : categoryId,
        'uz',
        'medium',
      );

      if (questions.length !== 10) {
        throw new Error('Battle uchun 10 ta savol tayyorlanmadi.');
      }

      await this.battleService.markMatchStarted(matchId);

      const room = `battle:${roomCode}`;

      const battle: ActiveBattle = {
        matchId,
        room,
        roomCode,
        mode,
        playerIds: [playerOneId, playerTwoId],
        usernames: {
          [playerOneId]: String(playerOneSocket.data.username || ''),
          [playerTwoId]: String(playerTwoSocket.data.username || ''),
        },
        socketIds: {
          [playerOneId]: playerOneSocket.id,
          [playerTwoId]: playerTwoSocket.id,
        },
        questions,
        scores: {
          [playerOneId]: 0,
          [playerTwoId]: 0,
        },
        questionIndex: 0,
        answers: {},
        results: [],
        deadline: 0,
        timer: null,
        nextTimer: null,
        disconnectTimers: new Map(),
        resolving: false,
        questionResolved: false,
        readyPlayers: new Set<string>(),
        disconnectedAt: {},
      };

      await this.persistBattle(battle);
      this.activeBattles.set(matchId, battle);

      this.server.to(room).emit('battle:started', {
        matchId,
        roomCode,
        mode,
        totalQuestions: questions.length,
        questionDuration: this.questionDuration / 1000,
        players: battle.playerIds.map((id) => ({
          id,
          username: battle.usernames[id],
        })),
        message: 'Battle boshlandi!',
      });

      await this.sendQuestion(battle);
      return true;
    } catch (error) {
      this.logger.error(
        `Battle boshlashda xato (${roomCode}):`,
        error instanceof Error ? error.stack : String(error),
      );

      await this.battleService.cancelMatch(matchId).catch(() => undefined);

      this.server.to(`battle:${roomCode}`).emit('battle:error', {
        message: 'Battle boshlanmadi. Qayta urinib ko‘ring.',
      });

      this.server.to(`battle:${roomCode}`).emit('battle:cancelled', {
        matchId,
        reason: 'Savollarni tayyorlashda xatolik.',
      });
      return false;
    }
  }

  private async sendQuestion(battle: ActiveBattle): Promise<void> {
    if (battle.questionIndex >= battle.questions.length) {
      void this.completeBattle(battle);
      return;
    }

    const question = battle.questions[battle.questionIndex];

    battle.answers = {};
    battle.resolving = false;
    battle.questionResolved = false;
    battle.readyPlayers.clear();
    battle.deadline = Date.now() + this.questionDuration;

    if (battle.timer) {
      clearTimeout(battle.timer);
    }

    const publicQuestion = {
      matchId: battle.matchId,
      questionId: question.id,
      questionIndex: battle.questionIndex,
      totalQuestions: battle.questions.length,
      question: question.question,
      options: question.options,
      duration: this.questionDuration / 1000,
      endsAt: battle.deadline,
    };

    await this.persistBattle(battle);

    this.server.to(battle.room).emit(
      'battle:question',
      publicQuestion,
    );

    battle.timer = setTimeout(() => {
      void this.resolveQuestion(battle);
    }, this.questionDuration);
  }

  @SubscribeMessage('battle:answer')
  async submitAnswer(
    @ConnectedSocket() client: Socket,
    @MessageBody() payload: AnswerPayload,
  ): Promise<void> {
    const userId = client.data.userId as string | undefined;

    if (!userId || !payload?.matchId) {
      client.emit('battle:error', {
        message: 'Javob yuborish ma’lumoti noto‘g‘ri.',
      });
      return;
    }

    const battle = await this.getActiveBattle(payload.matchId);

    if (!battle || !battle.playerIds.includes(userId)) {
      client.emit('battle:error', {
        message: 'Faol Battle topilmadi.',
      });
      return;
    }

    if (battle.socketIds[userId] !== client.id) {
      client.emit('battle:error', {
        message: 'Bu Battle uchun faol ulanish emas.',
      });
      return;
    }

    if (
      !Number.isInteger(payload.answerIndex) ||
      payload.answerIndex! < 0 ||
      payload.answerIndex! > 3
    ) {
      client.emit('battle:error', {
        message: 'Javob varianti noto‘g‘ri.',
      });
      return;
    }

    const recorded = await this.battleStateStore.recordAnswer(
      payload.matchId,
      userId,
      client.id,
      payload.questionIndex!,
      payload.answerIndex!,
    );

    if (!recorded.accepted) {
      const messages: Record<string, string> = {
        missing: 'Faol Battle topilmadi.',
        socket: 'Bu Battle uchun faol ulanish emas.',
        resolving: 'Savol natijasi hisoblanmoqda.',
        expired: 'Bu savolning vaqti tugagan yoki savol eskirgan.',
        duplicate: 'Bu savolga javob berib bo‘lgansiz.',
      };
      client.emit('battle:error', {
        message: messages[recorded.reason || ''] || 'Javob qabul qilinmadi.',
      });
      if (recorded.reason === 'expired') await this.resolveQuestion(battle);
      return;
    }

    battle.answers[userId] = payload.answerIndex!;
    client.emit('battle:answer:accepted', {
      matchId: battle.matchId,
      questionIndex: payload.questionIndex,
      accepted: true,
    });

    if (recorded.allAnswered) await this.resolveQuestion(battle);
  }

  private async resolveQuestion(battle: ActiveBattle): Promise<void> {
    if (
      battle.resolving ||
      !this.activeBattles.has(battle.matchId)
    ) {
      return;
    }

    const claimed = await this.battleStateStore.claimQuestionResolution(
      battle.matchId,
      battle.questionIndex,
    );
    if (!claimed) return;
    this.applySnapshot(battle, claimed);
    battle.resolving = true;

    if (battle.timer) {
      clearTimeout(battle.timer);
      battle.timer = null;
    }

    const question = battle.questions[battle.questionIndex];

    if (!question) {
      battle.resolving = false;
      await this.completeBattle(battle);
      return;
    }

    const answers: Record<string, number | null> = {};
    const points: Record<string, number> = {};

    for (const playerId of battle.playerIds) {
      const answer = Object.prototype.hasOwnProperty.call(
        battle.answers,
        playerId,
      )
        ? battle.answers[playerId]
        : null;

      answers[playerId] = answer;

      const earnedPoints =
        answer !== null && answer === question.correctAnswer ? 100 : 0;

      points[playerId] = earnedPoints;
      battle.scores[playerId] += earnedPoints;
    }

    const result: BattleQuestionResult = {
      questionId: question.id,
      questionIndex: battle.questionIndex,
      correctAnswer: question.correctAnswer,
      answers,
      points,
      explanation: question.explanation,
    };

    battle.results.push(result);

    try {
      await this.battleService.saveProgress(
        battle.matchId,
        battle.results,
        battle.scores,
      );
    } catch (error) {
      battle.results.pop();

      for (const playerId of battle.playerIds) {
        battle.scores[playerId] -= points[playerId] ?? 0;
      }

      battle.resolving = false;

      this.logger.error(
        'Battle natijasini saqlashda xato:',
        error instanceof Error ? error.stack : String(error),
      );

      this.server.to(battle.room).emit('battle:error', {
        message:
          'Natijani saqlashda xatolik yuz berdi. Iltimos, qayta urinib ko‘ring.',
      });

      battle.timer = setTimeout(() => {
        void this.resolveQuestion(battle);
      }, 3000);

      return;
    }

    this.server.to(battle.room).emit('battle:question:result', {
      matchId: battle.matchId,
      questionIndex: battle.questionIndex,
      correctAnswer: question.correctAnswer,
      answers,
      points,
      scores: battle.scores,
      explanation: question.explanation,
    });

    battle.questionResolved = true;
    await this.persistBattle(battle);
    this.emitNextReadyStatus(battle);
    await this.advanceIfReady(battle);
  }

  @SubscribeMessage('battle:next:ready')
  async markNextQuestionReady(
    @ConnectedSocket() client: Socket,
    @MessageBody() payload: NextReadyPayload,
  ): Promise<void> {
    const userId = client.data.userId as string | undefined;
    const matchId = payload?.matchId;

    if (!userId || !matchId || !Number.isInteger(payload.questionIndex)) {
      client.emit('battle:error', {
        message: 'Keyingi savolga tayyorlanish ma’lumoti noto‘g‘ri.',
      });
      return;
    }

    const battle = await this.getActiveBattle(matchId);

    if (!battle || !battle.playerIds.includes(userId)) {
      client.emit('battle:error', { message: 'Faol Battle topilmadi.' });
      return;
    }

    if (battle.socketIds[userId] !== client.id) {
      client.emit('battle:error', {
        message: 'Bu Battle uchun faol ulanish emas.',
      });
      return;
    }

    if (payload.questionIndex !== battle.questionIndex) {
      client.emit('battle:error', {
        message: 'Bu savol uchun tayyorlanish muddati tugagan.',
      });
      return;
    }

    const hasAnswered = Object.prototype.hasOwnProperty.call(
      battle.answers,
      userId,
    );
    const timeExpired = Date.now() >= battle.deadline;

    if (!hasAnswered && !timeExpired && !battle.questionResolved) {
      client.emit('battle:error', {
        message: 'Avval javob bering yoki savol vaqtining tugashini kuting.',
      });
      return;
    }

    const updated = await this.battleStateStore.markPlayerReady(
      matchId,
      userId,
      payload.questionIndex!,
    );
    if (!updated) {
      client.emit('battle:error', { message: 'Keyingi savolga tayyorlanish ma’lumoti eskirgan.' });
      return;
    }
    this.applySnapshot(battle, updated);
    this.emitNextReadyStatus(battle);

    if (timeExpired && !battle.questionResolved && !battle.resolving) {
      await this.resolveQuestion(battle);
      return;
    }

    await this.advanceIfReady(battle);
  }

  private emitNextReadyStatus(battle: ActiveBattle): void {
    this.server.to(battle.room).emit('battle:next:status', {
      matchId: battle.matchId,
      questionIndex: battle.questionIndex,
      readyPlayerIds: Array.from(battle.readyPlayers),
      readyCount: battle.readyPlayers.size,
      totalPlayers: battle.playerIds.length,
    });
  }

  private async advanceIfReady(battle: ActiveBattle): Promise<void> {
    if (!this.activeBattles.has(battle.matchId)) return;

    const advanced = await this.battleStateStore.claimAdvance(battle.matchId);
    if (!advanced) return;
    this.applySnapshot(battle, advanced);

    if (battle.nextTimer) {
      clearTimeout(battle.nextTimer);
      battle.nextTimer = null;
    }

    await this.sendQuestion(battle);
  }

  private async completeBattle(battle: ActiveBattle): Promise<void> {
    if (!this.activeBattles.has(battle.matchId)) {
      return;
    }

    if (battle.finishing) {
      return;
    }

    battle.finishing = true;

    if (battle.timer) {
      clearTimeout(battle.timer);
      battle.timer = null;
    }

    if (battle.nextTimer) {
      clearTimeout(battle.nextTimer);
      battle.nextTimer = null;
    }

    try {
      const match = await this.battleService.finishMatch(
        battle.matchId,
        battle.scores,
        battle.results,
      );

      this.server.to(battle.room).emit('battle:finished', {
        matchId: battle.matchId,
        roomCode: battle.roomCode,
        scores: battle.scores,
        rankChanges: match.rankChanges,
        winnerId: match.winnerId,
        draw: match.winnerId === null,
        totalQuestions: battle.questions.length,
        message:
          match.winnerId === null
            ? 'Battle durang bilan yakunlandi!'
            : 'Battle yakunlandi!',
      });

      this.logger.log(`Battle yakunlandi: ${battle.roomCode}`);

      this.clearBattleTimers(battle);
      this.activeBattles.delete(battle.matchId);
      await this.battleStateStore.remove(battle.matchId);
    } catch (error) {
      battle.finishing = false;

      this.logger.error(
        'Battle yakunlashda xato:',
        error instanceof Error ? error.stack : String(error),
      );

      const attempts = (battle.finishAttempts ?? 0) + 1;
      battle.finishAttempts = attempts;

      if (attempts <= 3) {
        const delay = attempts * 2000;

        this.logger.warn(
          `Battle yakunlash qayta uriniladi: ${battle.roomCode}. Urinish ${attempts}/3`,
        );

        setTimeout(() => {
          void this.completeBattle(battle);
        }, delay);
      } else {
        this.server.to(battle.room).emit('battle:error', {
          message:
            'Battle natijasini saqlashda xatolik. Iltimos, keyinroq qayta urinib ko‘ring.',
        });
      }
    }
  }

  @SubscribeMessage('battle:reconnect')
  async reconnectBattle(
    @ConnectedSocket() client: Socket,
    @MessageBody() payload: ReconnectPayload,
  ): Promise<void> {
    const userId = client.data.userId as string | undefined;
    const matchId = payload?.matchId;

    if (!userId || !matchId) {
      client.emit('battle:error', {
        message: 'Qayta ulanish ma’lumoti noto‘g‘ri.',
      });
      return;
    }

    const battle = this.activeBattles.get(matchId);

    if (!battle || !battle.playerIds.includes(userId)) {
      client.emit('battle:reconnect:failed', {
        message: 'Davom etayotgan Battle topilmadi.',
      });
      return;
    }

    const disconnectTimer = battle.disconnectTimers.get(userId);

    if (disconnectTimer) {
      clearTimeout(disconnectTimer);
      battle.disconnectTimers.delete(userId);
    }

    battle.socketIds[userId] = client.id;
    delete battle.disconnectedAt[userId];
    await this.persistBattle(battle);

    await client.join(battle.room);

    client.emit('battle:reconnected', {
      connected: true,
      matchId,
      roomCode: battle.roomCode,
      scores: battle.scores,
      questionIndex: battle.questionIndex,
      totalQuestions: battle.questions.length,
    });

    if (battle.questionIndex < battle.questions.length) {
      const question = battle.questions[battle.questionIndex];

      client.emit('battle:question', {
        matchId: battle.matchId,
        questionId: question.id,
        questionIndex: battle.questionIndex,
        totalQuestions: battle.questions.length,
        question: question.question,
        options: question.options,
        duration: Math.max(
          0,
          Math.ceil((battle.deadline - Date.now()) / 1000),
        ),
        endsAt: battle.deadline,
        alreadyAnswered: Object.prototype.hasOwnProperty.call(
          battle.answers,
          userId,
        ),
        alreadyReady: battle.readyPlayers.has(userId),
        readyPlayerIds: Array.from(battle.readyPlayers),
      });

      if (battle.questionResolved && battle.results.length > 0) {
        const result = battle.results[battle.results.length - 1];

        client.emit('battle:question:result', {
          matchId: battle.matchId,
          questionIndex: result.questionIndex,
          correctAnswer: result.correctAnswer,
          answers: result.answers,
          points: result.points,
          scores: battle.scores,
          explanation: result.explanation,
        });
      }

      this.emitNextReadyStatus(battle);
    }
  }

  private async handleReconnectTimeout(
    matchId: string,
    userId: string,
  ): Promise<void> {
    const battle = this.activeBattles.get(matchId);

    if (!battle || battle.socketIds[userId]) {
      return;
    }

    const timer = battle.disconnectTimers.get(userId);

    if (timer) {
      battle.disconnectTimers.delete(userId);
    }

    this.logger.warn(
      `${userId} qayta ulanmagan. Battle bekor qilinadi: ${battle.roomCode}`,
    );

    try {
      await this.battleService.cancelMatch(matchId);
    } catch (error) {
      this.logger.error(
        'Uzilgan Battle bekor qilinmadi:',
        error instanceof Error ? error.message : String(error),
      );
    }

    this.server.to(battle.room).emit('battle:cancelled', {
      matchId,
      reason: 'O‘yinchi 30 soniya ichida qayta ulanmagan.',
    });

    this.clearBattleTimers(battle);
    this.activeBattles.delete(matchId);
    await this.battleStateStore.remove(matchId);
  }

  @SubscribeMessage('battle:queue:cancel')
  async cancelQueue(
    @ConnectedSocket() client: Socket,
    @MessageBody() payload?: QueueJoinPayload,
  ): Promise<void> {
    const userId = client.data.userId as string | undefined;

    if (!userId) {
      return;
    }

    const trackedQueue = this.queuedSockets.get(client.id);

    const mode = payload?.mode === 'ranked' ? 'ranked' : 'casual';
    const rawCategory = payload?.categoryId || 'general';

    const categoryId = /^[a-zA-Z0-9_-]{1,60}$/.test(rawCategory)
      ? rawCategory
      : 'general';

    const queueKey =
      trackedQueue || `battle:queue:${mode}:${categoryId}`;

    await this.battleService.leaveQueue(
      queueKey,
      userId,
      client.id,
    );

    this.queuedSockets.delete(client.id);

    client.emit('battle:queue:cancelled', {
      cancelled: true,
    });
  }

  @SubscribeMessage('battle:match:cancel')
  async cancelActiveBattle(
    @ConnectedSocket() client: Socket,
    @MessageBody() payload: ReconnectPayload,
  ): Promise<void> {
    const userId = client.data.userId as string | undefined;
    const matchId = payload?.matchId;

    if (!userId || !matchId) {
      return;
    }

    const battle = this.activeBattles.get(matchId);

    if (!battle || !battle.playerIds.includes(userId)) {
      client.emit('battle:error', {
        message: 'Battle topilmadi.',
      });
      return;
    }

    if (battle.socketIds[userId] !== client.id) {
      client.emit('battle:error', {
        message: 'Bu Battle uchun faol ulanish emas.',
      });
      return;
    }

    try {
      await this.battleService.cancelMatch(matchId);

      this.server.to(battle.room).emit('battle:cancelled', {
        matchId,
        reason: 'O‘yin bekor qilindi.',
      });
    } finally {
      this.clearBattleTimers(battle);
      this.activeBattles.delete(matchId);
      await this.battleStateStore.remove(matchId);
    }
  }

  private clearBattleTimers(battle: ActiveBattle): void {
    if (battle.timer) {
      clearTimeout(battle.timer);
      battle.timer = null;
    }

    if (battle.nextTimer) {
      clearTimeout(battle.nextTimer);
      battle.nextTimer = null;
    }

    for (const timer of battle.disconnectTimers.values()) {
      clearTimeout(timer);
    }

    battle.disconnectTimers.clear();
  }
}
