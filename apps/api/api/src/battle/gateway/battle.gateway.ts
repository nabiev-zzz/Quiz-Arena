
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
import {
  BattleStateSnapshot,
  BattleStateStore,
  PrivateBattleInviteSnapshot,
} from '../battle-state.store';

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

interface BattleSocketPeer {
  id: string;
  data: Record<string, unknown>;
  join(room: string): Promise<void> | void;
  emit(event: string, ...args: unknown[]): unknown;
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
      void Promise.all([
        this.reconcileActiveBattles(),
        this.reconcilePrivateInvites(),
      ]).catch((error) =>
        this.logger.error('Battle Redis reconciliation xatosi:', error),
      );
    }, 2_000);
  }

  async onModuleDestroy(): Promise<void> {
    if (this.reconciliationTimer) clearInterval(this.reconciliationTimer);
    this.reconciliationTimer = null;
    for (const battle of this.activeBattles.values()) this.clearBattleTimers(battle);
  }

  private async reconcilePrivateInvites(): Promise<void> {
    if (!this.battleStateStore.isReady()) return;
    const invites = await this.battleStateStore.listPrivateInvites();
    for (const invite of invites) {
      if (invite.expiresAt <= Date.now()) {
        await this.expirePrivateRoom(invite.roomCode);
      }
    }
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

      // Rebuild disconnect grace timers from shared state on every replica.
      for (const [userId, disconnectedAt] of Object.entries(saved.disconnectedAt)) {
        if (!saved.socketIds[userId]) {
          this.scheduleDisconnectTimeout(battle, userId, disconnectedAt);
        }
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
    if (!this.battleStateStore.isReady()) {
      return this.activeBattles.get(matchId);
    }
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

  private async getPrivateInvite(
    roomCode: string,
  ): Promise<PrivateBattleInviteSnapshot | PrivateBattleRoom | null> {
    if (this.battleStateStore.isReady()) {
      return this.battleStateStore.getPrivateInvite(roomCode);
    }
    return this.privateRooms.get(roomCode) || null;
  }

  private async getPrivateInviteForHost(
    userId: string,
  ): Promise<PrivateBattleInviteSnapshot | PrivateBattleRoom | null> {
    if (this.battleStateStore.isReady()) {
      return this.battleStateStore.getPrivateInviteForHost(userId);
    }
    return [...this.privateRooms.values()].find((room) => room.hostUserId === userId) || null;
  }

  private async listPrivateInvites(): Promise<Array<PrivateBattleInviteSnapshot | PrivateBattleRoom>> {
    if (this.battleStateStore.isReady()) {
      return this.battleStateStore.listPrivateInvites();
    }
    return [...this.privateRooms.values()];
  }

  private async hasActiveBattleForUser(userId: string): Promise<boolean> {
    if (this.battleStateStore.isReady()) {
      const active = await this.battleStateStore.listActive();
      return active.some((battle) => battle.playerIds.includes(userId));
    }
    return [...this.activeBattles.values()].some((battle) => battle.playerIds.includes(userId));
  }

  private async removePrivateInvite(
    roomCode: string,
    hostUserId?: string,
  ): Promise<PrivateBattleInviteSnapshot | PrivateBattleRoom | null> {
    if (this.battleStateStore.isReady()) {
      return this.battleStateStore.removePrivateInvite(roomCode, hostUserId);
    }
    const room = this.privateRooms.get(roomCode);
    if (!room || (hostUserId && room.hostUserId !== hostUserId)) return null;
    this.privateRooms.delete(roomCode);
    return room;
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

    const queueKey = await this.battleService.getQueueForSocket(client.id);

    if (queueKey) {
      await this.battleService
        .leaveQueue(queueKey, userId, client.id)
        .catch(() => undefined);

      
    }

    const battles = this.battleStateStore.isReady()
      ? await Promise.all(
          (await this.battleStateStore.listActive()).map(({ matchId }) =>
            this.getActiveBattle(matchId),
          ),
        )
      : [...this.activeBattles.values()];

    for (const battle of battles) {
      if (!battle || !battle.playerIds.includes(userId)) {
        continue;
      }

      if (battle.socketIds[userId] !== client.id) {
        continue;
      }

      const disconnectedAt = Date.now();
      if (this.battleStateStore.isReady()) {
        const updated = await this.battleStateStore.markPlayerDisconnected(
          battle.matchId,
          userId,
          client.id,
          disconnectedAt,
        );
        if (!updated) continue;
        this.applySnapshot(battle, updated);
      } else {
        delete battle.socketIds[userId];
        battle.disconnectedAt[userId] = disconnectedAt;
      }

      this.logger.warn(
        `${userId} Battle xonasidan uzildi: ${battle.roomCode}`,
      );

      const oldTimer = battle.disconnectTimers.get(userId);
      if (oldTimer) clearTimeout(oldTimer);
      this.scheduleDisconnectTimeout(battle, userId, disconnectedAt);
    }
  }

  @SubscribeMessage('battle:private:create')
  async createPrivateRoom(@ConnectedSocket() client: Socket): Promise<void> {
    const userId = client.data.userId as string | undefined;
    if (!userId) {
      client.emit('battle:error', { message: 'Avval tizimga kiring.' });
      return;
    }
    if (await this.battleService.getQueueForSocket(client.id)) {
      client.emit('battle:error', { message: 'Avval raqib qidirish navbatidan chiqing.' });
      return;
    }
    if (await this.hasActiveBattleForUser(userId)) {
      client.emit('battle:error', { message: 'Avval joriy Battle ni yakunlang.' });
      return;
    }
    if (await this.getPrivateInviteForHost(userId)) {
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
      const invite: PrivateBattleInviteSnapshot = {
        roomCode,
        hostUserId: userId,
        hostSocketId: client.id,
        expiresAt,
      };
      if (this.battleStateStore.isReady()) {
        const created = await this.battleStateStore.createPrivateInvite(invite);
        if (!created) {
          throw new BadRequestException('Sizda allaqachon faol taklif xonasi bor.');
        }
      } else {
        if (this.privateRooms.has(roomCode)) {
          throw new BadRequestException('Xona kodi band. Qayta urinib ko‘ring.');
        }
      }

      const timer = setTimeout(() => {
        void this.expirePrivateRoom(roomCode);
      }, Math.max(0, expiresAt - Date.now()));
      this.privateRooms.set(roomCode, { ...invite, timer });

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
        try {
          await this.featureUsageService.refund(userId, 'privateBattle');
        } catch {
          // Preserve the original room error.
        }
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

    if (this.battleStateStore.isReady()) {
      const allowed = await this.battleStateStore.consumePrivateJoinAttempt(userId, 8, 60);
      if (!allowed) {
        client.emit('battle:error', {
          message: 'Xona kodini tekshirish limiti tugadi. Bir daqiqadan so‘ng qayta urinib ko‘ring.',
        });
        return;
      }
    } else {
      const now = Date.now();
      const previousAttempts = this.privateJoinAttempts.get(userId);
      const attempts = !previousAttempts || now - previousAttempts.windowStartedAt >= 60_000
        ? { count: 0, windowStartedAt: now }
        : previousAttempts;
      if (attempts.count >= 8) {
        client.emit('battle:error', {
          message: 'Xona kodini tekshirish limiti tugadi. Bir daqiqadan so‘ng qayta urinib ko‘ring.',
        });
        return;
      }
      attempts.count += 1;
      this.privateJoinAttempts.set(userId, attempts);
    }

    if (!/^[A-F0-9]{12}$/.test(roomCode)) {
      client.emit('battle:error', { message: '12 belgili xona kodi noto‘g‘ri.' });
      return;
    }
    if (await this.battleService.getQueueForSocket(client.id)) {
      client.emit('battle:error', { message: 'Avval raqib qidirish navbatidan chiqing.' });
      return;
    }
    const ownInvite = await this.getPrivateInviteForHost(userId);
    if (ownInvite && ownInvite.roomCode !== roomCode) {
      client.emit('battle:error', { message: 'Avval o‘zingiz yaratgan taklif xonasini bekor qiling.' });
      return;
    }
    if (await this.hasActiveBattleForUser(userId)) {
      client.emit('battle:error', { message: 'Avval joriy Battle ni yakunlang.' });
      return;
    }

    const privateRoom = await this.getPrivateInvite(roomCode);
    if (!privateRoom || privateRoom.expiresAt <= Date.now()) {
      if (privateRoom) await this.expirePrivateRoom(roomCode);
      client.emit('battle:error', { message: 'Xona topilmadi yoki uning muddati tugagan.' });
      return;
    }
    if (privateRoom.hostUserId === userId) {
      client.emit('battle:error', { message: 'O‘z xonangizga raqib sifatida qo‘shila olmaysiz.' });
      return;
    }

    const hostSocket = (await this.server.fetchSockets()).find(
      (socket) =>
        socket.id === privateRoom.hostSocketId &&
        socket.data.userId === privateRoom.hostUserId,
    );
    if (!hostSocket) {
      await this.expirePrivateRoom(roomCode);
      client.emit('battle:error', { message: 'Xona egasi serverga ulanmagan.' });
      return;
    }

    const claimedRoom = this.battleStateStore.isReady()
      ? await this.battleStateStore.claimPrivateInvite(roomCode, userId)
      : await this.removePrivateInvite(roomCode, privateRoom.hostUserId);
    if (!claimedRoom) {
      client.emit('battle:error', { message: 'Xona allaqachon band yoki muddati tugagan.' });
      return;
    }

    const localRoom = this.privateRooms.get(roomCode);
    if (localRoom) clearTimeout(localRoom.timer);
    this.privateRooms.delete(roomCode);

    try {
      const match = await this.battleService.createMatch(
        claimedRoom.hostUserId,
        userId,
        'private',
      );
      const room = `battle:${match.roomCode}`;
      await Promise.all([hostSocket.join(room), client.join(room)]);

      const matchInfo = {
        matchId: match.id,
        roomCode: match.roomCode,
        mode: 'private',
        status: 'matched',
        players: [
          { id: claimedRoom.hostUserId, username: hostSocket.data.username },
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
        claimedRoom.hostUserId,
        userId,
        hostSocket,
        client,
        'general',
      );
      if (!started) {
        try {
          await this.featureUsageService.refund(claimedRoom.hostUserId, 'privateBattle');
        } catch {
          // Preserve the original match error.
        }
      }
    } catch (error) {
      try {
        await this.featureUsageService.refund(claimedRoom.hostUserId, 'privateBattle');
      } catch {
        // Preserve the original match error.
      }
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
    const room = await this.getPrivateInvite(roomCode);
    if (
      !userId ||
      !room ||
      room.hostUserId !== userId ||
      room.hostSocketId !== client.id
    ) {
      client.emit('battle:error', { message: 'Xonani bekor qilish huquqi topilmadi.' });
      return;
    }

    const localRoom = this.privateRooms.get(roomCode);
    if (localRoom) clearTimeout(localRoom.timer);
    const removed = await this.removePrivateInvite(roomCode, userId);
    if (!removed) {
      client.emit('battle:error', { message: 'Xona allaqachon bekor qilingan.' });
      return;
    }
    this.privateRooms.delete(roomCode);
    try {
      await this.featureUsageService.refund(userId, 'privateBattle');
    } catch {
      // Preserve room cleanup even if quota refund fails.
    }
    client.emit('battle:private:cancelled', { roomCode });
  }

  private async expirePrivateRoom(roomCode: string): Promise<void> {
    const localRoom = this.privateRooms.get(roomCode);
    if (localRoom) clearTimeout(localRoom.timer);
    const room = await this.removePrivateInvite(roomCode);
    this.privateRooms.delete(roomCode);
    if (!room) return;

    const hostSocket = (await this.server.fetchSockets()).find(
      (socket) =>
        socket.id === room.hostSocketId &&
        socket.data.userId === room.hostUserId,
    );
    hostSocket?.emit('battle:private:expired', { roomCode });
    try {
      await this.featureUsageService.refund(room.hostUserId, 'privateBattle');
    } catch {
      // Preserve room cleanup even if quota refund fails.
    }
  }

  private async cleanupPrivateRoomsForSocket(socketId: string): Promise<void> {
    const ownedRooms = (await this.listPrivateInvites()).filter(
      (room) => room.hostSocketId === socketId,
    );
    for (const room of ownedRooms) {
      const localRoom = this.privateRooms.get(room.roomCode);
      if (localRoom) clearTimeout(localRoom.timer);
      const removed = await this.removePrivateInvite(room.roomCode, room.hostUserId);
      if (!removed) continue;
      this.privateRooms.delete(room.roomCode);
      try {
        await this.featureUsageService.refund(room.hostUserId, 'privateBattle');
      } catch {
        // Preserve room cleanup even if quota refund fails.
      }
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

    if (await this.getPrivateInviteForHost(userId)) {
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
      const previousQueue = await this.battleService.getQueueForSocket(client.id);

      if (previousQueue) {
        await this.battleService.leaveQueue(
          previousQueue,
          userId,
          client.id,
        );
        
      }

      const opponent = await this.battleService.joinQueue(
        queueKey,
        userId,
        client.id,
      );

      if (!opponent) {
        

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

      // The Redis Socket.IO adapter makes fetchSockets() span every API replica.
      // Namespace.sockets.get() only sees sockets attached to this process.
      const opponentSocket = (await this.server.fetchSockets()).find(
        (socket) =>
          socket.id === opponentSocketId &&
          socket.data.userId === opponentId,
      );

      if (!opponentSocket) {
        const nextOpponent = await this.battleService.joinQueue(
          queueKey,
          userId,
          client.id,
        );

        if (!nextOpponent) {
          

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
    playerOneSocket: BattleSocketPeer,
    playerTwoSocket: BattleSocketPeer,
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

    battle.timerQuestionIndex = battle.questionIndex;
    battle.timer = setTimeout(() => {
      battle.timer = null;
      battle.timerQuestionIndex = undefined;
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
    battle.timerQuestionIndex = undefined;

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
      await this.persistBattle(battle).catch(() => undefined);

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

    if (payload.questionIndex !== battle.questionIndex) {
      client.emit('battle:error', {
        message: 'Bu savol uchun tayyorlanish muddati tugagan.',
      });
      return;
    }

    const updated = await this.battleStateStore.markPlayerReady(
      matchId,
      userId,
      client.id,
      payload.questionIndex!,
    );
    if (!updated) {
      client.emit('battle:error', { message: 'Keyingi savolga tayyorlanish ma’lumoti eskirgan.' });
      return;
    }
    this.applySnapshot(battle, updated);
    this.emitNextReadyStatus(battle);
    const timeExpired = Date.now() >= updated.deadline;

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
    battle.timerQuestionIndex = undefined;

    if (battle.nextTimer) {
      clearTimeout(battle.nextTimer);
      battle.nextTimer = null;
    }

    const claimed = await this.battleStateStore.claimFinish(battle.matchId);
    if (!claimed) return;
    this.applySnapshot(battle, claimed);
    battle.finishing = true;

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
      await this.persistBattle(battle).catch(() => undefined);

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

    const battle = await this.getActiveBattle(matchId);

    if (!battle || !battle.playerIds.includes(userId)) {
      client.emit('battle:reconnect:failed', {
        message: 'Davom etayotgan Battle topilmadi.',
      });
      return;
    }

    if (this.battleStateStore.isReady()) {
      const updated = await this.battleStateStore.reconnectPlayer(
        matchId,
        userId,
        client.id,
      );
      if (!updated) {
        client.emit('battle:reconnect:failed', {
          message: 'Battle holati yangilanmoqda. Qayta urinib ko‘ring.',
        });
        return;
      }
      this.applySnapshot(battle, updated);
    } else {
      battle.socketIds[userId] = client.id;
      delete battle.disconnectedAt[userId];
      await this.persistBattle(battle);
    }

    const disconnectTimer = battle.disconnectTimers.get(userId);
    if (disconnectTimer) {
      clearTimeout(disconnectTimer);
      battle.disconnectTimers.delete(userId);
    }

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

  private scheduleDisconnectTimeout(
    battle: ActiveBattle,
    userId: string,
    disconnectedAt: number,
  ): void {
    if (battle.disconnectTimers.has(userId)) return;

    const delay = Math.max(
      0,
      disconnectedAt + this.reconnectGracePeriod - Date.now(),
    );
    const timer = setTimeout(() => {
      battle.disconnectTimers.delete(userId);
      void this.handleReconnectTimeout(battle.matchId, userId, disconnectedAt);
    }, delay);
    battle.disconnectTimers.set(userId, timer);
  }

  private async handleReconnectTimeout(
    matchId: string,
    userId: string,
    expectedDisconnectedAt: number,
  ): Promise<void> {
    const battle = await this.getActiveBattle(matchId);
    if (
      !battle ||
      battle.socketIds[userId] ||
      battle.disconnectedAt[userId] !== expectedDisconnectedAt
    ) {
      return;
    }

    if (this.battleStateStore.isReady()) {
      const claimed = await this.battleStateStore.claimDisconnectTimeout(
        matchId,
        userId,
        expectedDisconnectedAt,
      );
      if (!claimed) return;
      this.applySnapshot(battle, claimed);
    }

    this.logger.warn(
      `${userId} qayta ulanmagan. Battle bekor qilinadi: ${battle.roomCode}`,
    );

    try {
      await this.battleService.cancelMatch(matchId);
    } catch (error) {
      battle.finishing = false;
      await this.persistBattle(battle).catch(() => undefined);
      this.logger.error(
        'Uzilgan Battle bekor qilinmadi:',
        error instanceof Error ? error.message : String(error),
      );
      return;
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

    const trackedQueue = await this.battleService.getQueueForSocket(client.id);

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

    const battle = await this.getActiveBattle(matchId);

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
    battle.timerQuestionIndex = undefined;

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
