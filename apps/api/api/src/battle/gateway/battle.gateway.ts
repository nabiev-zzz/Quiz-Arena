
import {
  ConnectedSocket,
  MessageBody,
  OnGatewayConnection,
  OnGatewayDisconnect,
  SubscribeMessage,
  WebSocketGateway,
  WebSocketServer,
} from '@nestjs/websockets';
import { BadRequestException, Logger } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Namespace, Socket } from 'socket.io';

import { User } from '../../users/entities/user.entity';
import {
  BattleQuestionResult,
  BattleService,
} from '../battle.service';
import { BattleQuestion } from '../entities/battle-question.entity';

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
}

@WebSocketGateway({
  namespace: '/battle',
  cors: {
    origin: true,
    credentials: true,
  },
})
export class BattleGateway
  implements OnGatewayConnection, OnGatewayDisconnect
{
  private readonly logger = new Logger(BattleGateway.name);
  private readonly activeBattles = new Map<string, ActiveBattle>();
  private readonly queuedSockets = new Map<string, string>();
  private readonly questionDuration = 20_000;
  private readonly reconnectGracePeriod = 30_000;

  @WebSocketServer()
  server: Namespace;

  constructor(
    private readonly jwtService: JwtService,
    private readonly battleService: BattleService,
    @InjectRepository(User)
    private readonly userRepository: Repository<User>,
  ) {}

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
  ): Promise<void> {
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
      };

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

      this.sendQuestion(battle);
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
    }
  }

  private sendQuestion(battle: ActiveBattle): void {
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

    const battle = this.activeBattles.get(payload.matchId);

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

    if (battle.resolving) {
      client.emit('battle:error', {
        message: 'Savol natijasi hisoblanmoqda.',
      });
      return;
    }

    if (payload.questionIndex !== battle.questionIndex) {
      client.emit('battle:error', {
        message: 'Bu savolning vaqti tugagan yoki savol eskirgan.',
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

    if (Date.now() > battle.deadline) {
      client.emit('battle:error', {
        message: 'Javob berish vaqti tugadi.',
      });

      await this.resolveQuestion(battle);
      return;
    }

    if (Object.prototype.hasOwnProperty.call(battle.answers, userId)) {
      client.emit('battle:error', {
        message: 'Bu savolga javob berib bo‘lgansiz.',
      });
      return;
    }

    battle.answers[userId] = payload.answerIndex!;

    client.emit('battle:answer:accepted', {
      matchId: battle.matchId,
      questionIndex: battle.questionIndex,
      accepted: true,
    });

    const allAnswered = battle.playerIds.every((id) =>
      Object.prototype.hasOwnProperty.call(battle.answers, id),
    );

    if (allAnswered) {
      await this.resolveQuestion(battle);
    }
  }

  private async resolveQuestion(battle: ActiveBattle): Promise<void> {
    if (
      battle.resolving ||
      !this.activeBattles.has(battle.matchId)
    ) {
      return;
    }

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
      question: question.question,
      options: [...question.options],
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
    this.emitNextReadyStatus(battle);
    this.advanceIfReady(battle);
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

    const battle = this.activeBattles.get(matchId);

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

    battle.readyPlayers.add(userId);
    this.emitNextReadyStatus(battle);

    if (timeExpired && !battle.questionResolved && !battle.resolving) {
      await this.resolveQuestion(battle);
      return;
    }

    this.advanceIfReady(battle);
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

  private advanceIfReady(battle: ActiveBattle): void {
    if (
      !this.activeBattles.has(battle.matchId) ||
      !battle.questionResolved ||
      battle.readyPlayers.size !== battle.playerIds.length
    ) {
      return;
    }

    if (battle.nextTimer) {
      clearTimeout(battle.nextTimer);
      battle.nextTimer = null;
    }

    battle.questionIndex += 1;
    battle.readyPlayers.clear();
    battle.questionResolved = false;
    this.sendQuestion(battle);
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
