import {
  Injectable,
  Logger,
  OnModuleDestroy,
  OnModuleInit,
  ServiceUnavailableException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Redis from 'ioredis';
import { randomUUID } from 'node:crypto';
import { BattleQuestion } from './entities/battle-question.entity';
import { BattleQuestionResult } from './battle.service';

/**
 * Durable, JSON-serializable state for one live Battle.
 * Runtime timer handles and Socket instances must never be stored here.
 */
export interface BattleStateSnapshot {
  version: 1;
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
  resolving: boolean;
  questionResolved: boolean;
  finishing: boolean;
  finishAttempts: number;
  readyPlayers: string[];
  disconnectedAt: Record<string, number>;
  updatedAt: number;
}

const RELEASE_LOCK_SCRIPT = `
  if redis.call('GET', KEYS[1]) == ARGV[1] then
    return redis.call('DEL', KEYS[1])
  end
  return 0
`;

@Injectable()
export class BattleStateStore implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(BattleStateStore.name);
  private readonly redis: Redis;
  private readonly prefix: string;
  private enabled = false;
  private readonly stateTtlSeconds = 6 * 60 * 60;

  constructor(private readonly config: ConfigService) {
    const url =
      this.config.get<string>('REDIS_URL') ||
      this.config.get<string>('VALKEY_URL');
    const host = this.config.get<string>('VALKEY_HOST');

    this.enabled = Boolean(url || host);
    this.prefix = this.config.get<string>('BATTLE_REDIS_PREFIX') || `quiz-arena:${process.env.NODE_ENV || 'development'}`;

    const options = {
      lazyConnect: true,
      maxRetriesPerRequest: 2,
      retryStrategy: (times: number) => Math.min(times * 500, 5000),
      enableReadyCheck: true,
    };

    this.redis = url
      ? new Redis(url, options)
      : new Redis({
          host: host || '127.0.0.1',
          port: Number(this.config.get<string>('VALKEY_PORT') || 6379),
          password: this.config.get<string>('VALKEY_PASSWORD') || undefined,
          ...options,
        });

    this.redis.on('error', (error) => {
      this.logger.error(`BattleStateStore Redis xatosi: ${error.message}`);
    });
  }

  async onModuleInit(): Promise<void> {
    if (!this.enabled) {
      this.logger.warn(
        'BattleStateStore Redis manzili sozlanmagan; Battle shared-state saqlash o‘chirilgan.',
      );
      if (this.config.get<string>('BATTLE_SHARED_STATE_REQUIRED') === 'true') {
        throw new ServiceUnavailableException(
          'BATTLE_SHARED_STATE_REQUIRED=true, lekin Redis manzili sozlanmagan.',
        );
      }
      return;
    }

    if (
      this.config.get<string>('BATTLE_SHARED_STATE_REQUIRED') === 'true' &&
      !this.config.get<string>('BATTLE_REDIS_PREFIX')
    ) {
      throw new ServiceUnavailableException(
        'BATTLE_SHARED_STATE_REQUIRED=true bo‘lsa, muhitga xos BATTLE_REDIS_PREFIX majburiy.',
      );
    }

    try {
      if (this.redis.status === 'wait') await this.redis.connect();
      await this.redis.ping();
      this.logger.log('BattleStateStore Redis ulanishi tayyor');
    } catch (error) {
      this.enabled = false;
      if (this.config.get<string>('BATTLE_SHARED_STATE_REQUIRED') === 'true') {
        throw new ServiceUnavailableException(
          'Battle shared-state Redis mavjud emas; API xavfsiz ishga tushmadi.',
        );
      }
      this.logger.error(
        'BattleStateStore Redis ulanmagan.',
        error instanceof Error ? error.stack : String(error),
      );
    }
  }

  async onModuleDestroy(): Promise<void> {
    if (this.redis.status === 'ready') await this.redis.quit();
    else this.redis.disconnect();
  }

  isReady(): boolean {
    return this.enabled && this.redis.status === 'ready';
  }

  private stateKey(matchId: string): string {
    return `${this.prefix}:battle:state:${matchId}`;
  }

  private activeIndexKey(): string {
    return `${this.prefix}:battle:active`;
  }

  private lockKey(matchId: string): string {
    return `${this.prefix}:battle:lock:${matchId}`;
  }

  private assertReady(): void {
    if (!this.isReady()) {
      throw new ServiceUnavailableException(
        'Battle holati uchun Redis mavjud emas. Battle vaqtincha ishlamaydi.',
      );
    }
  }

  async save(state: BattleStateSnapshot): Promise<void> {
    this.assertReady();
    const key = this.stateKey(state.matchId);
    const pipeline = this.redis.pipeline();
    pipeline.set(key, JSON.stringify({ ...state, updatedAt: Date.now() }), 'EX', this.stateTtlSeconds);
    pipeline.sadd(this.activeIndexKey(), state.matchId);
    pipeline.expire(this.activeIndexKey(), this.stateTtlSeconds);
    const result = await pipeline.exec();
    if (!result || result.some(([error]) => error)) {
      throw new Error('Battle holatini Redisga saqlash muvaffaqiyatsiz.');
    }
  }

  async get(matchId: string): Promise<BattleStateSnapshot | null> {
    this.assertReady();
    const raw = await this.redis.get(this.stateKey(matchId));
    if (!raw) {
      await this.redis.srem(this.activeIndexKey(), matchId);
      return null;
    }
    const parsed = JSON.parse(raw) as BattleStateSnapshot;
    if (parsed.version !== 1 || parsed.matchId !== matchId) {
      throw new Error(`Battle Redis holati versiyasi yoki ID mos emas: ${matchId}`);
    }
    return parsed;
  }

  async listActive(): Promise<BattleStateSnapshot[]> {
    this.assertReady();
    const ids = await this.redis.smembers(this.activeIndexKey());
    if (ids.length === 0) return [];
    const values = await this.redis.mget(...ids.map((id) => this.stateKey(id)));
    const active: BattleStateSnapshot[] = [];
    const stale: string[] = [];
    values.forEach((raw, index) => {
      if (!raw) {
        stale.push(ids[index]);
        return;
      }
      const state = JSON.parse(raw) as BattleStateSnapshot;
      if (state.version === 1 && state.matchId === ids[index]) active.push(state);
      else throw new Error(`Battle Redis holati noto‘g‘ri: ${ids[index]}`);
    });
    if (stale.length) await this.redis.srem(this.activeIndexKey(), ...stale);
    return active;
  }


  async recordAnswer(
    matchId: string,
    userId: string,
    socketId: string,
    questionIndex: number,
    answerIndex: number,
  ): Promise<{ accepted: boolean; allAnswered: boolean; reason?: string }> {
    return this.withMatchLock(matchId, async () => {
      const state = await this.get(matchId);
      if (!state || !state.playerIds.includes(userId)) {
        return { accepted: false, allAnswered: false, reason: 'missing' };
      }
      if (state.socketIds[userId] !== socketId) {
        return { accepted: false, allAnswered: false, reason: 'socket' };
      }
      if (state.resolving || state.questionResolved) {
        return { accepted: false, allAnswered: false, reason: 'resolving' };
      }
      if (state.questionIndex !== questionIndex || Date.now() > state.deadline) {
        return { accepted: false, allAnswered: false, reason: 'expired' };
      }
      if (Object.prototype.hasOwnProperty.call(state.answers, userId)) {
        return { accepted: false, allAnswered: false, reason: 'duplicate' };
      }

      state.answers[userId] = answerIndex;
      await this.save(state);
      return {
        accepted: true,
        allAnswered: state.playerIds.every((id) =>
          Object.prototype.hasOwnProperty.call(state.answers, id),
        ),
      };
    });
  }

  async claimQuestionResolution(
    matchId: string,
    expectedQuestionIndex: number,
  ): Promise<BattleStateSnapshot | null> {
    return this.withMatchLock(matchId, async () => {
      const state = await this.get(matchId);
      if (
        !state ||
        state.questionIndex !== expectedQuestionIndex ||
        state.resolving ||
        state.questionResolved
      ) {
        return null;
      }
      state.resolving = true;
      await this.save(state);
      return state;
    });
  }

  async markPlayerReady(
    matchId: string,
    userId: string,
    socketId: string,
    questionIndex: number,
  ): Promise<BattleStateSnapshot | null> {
    return this.withMatchLock(matchId, async () => {
      const state = await this.get(matchId);
      if (
        !state ||
        !state.playerIds.includes(userId) ||
        state.socketIds[userId] !== socketId ||
        state.questionIndex !== questionIndex ||
        (!state.questionResolved && Date.now() < state.deadline)
      ) {
        return null;
      }
      if (!state.readyPlayers.includes(userId)) {
        state.readyPlayers.push(userId);
      }
      await this.save(state);
      return state;
    });
  }

  async claimAdvance(matchId: string): Promise<BattleStateSnapshot | null> {
    return this.withMatchLock(matchId, async () => {
      const state = await this.get(matchId);
      if (
        !state ||
        !state.questionResolved ||
        state.readyPlayers.length !== state.playerIds.length
      ) {
        return null;
      }
      state.questionIndex += 1;
      state.answers = {};
      state.readyPlayers = [];
      state.questionResolved = false;
      state.resolving = false;
      state.deadline = 0;
      await this.save(state);
      return state;
    });
  }


  async claimFinish(matchId: string): Promise<BattleStateSnapshot | null> {
    return this.withMatchLock(matchId, async () => {
      const state = await this.get(matchId);
      if (!state || state.finishing) return null;
      state.finishing = true;
      await this.save(state);
      return state;
    });
  }

  async remove(matchId: string): Promise<void> {
    this.assertReady();
    const pipeline = this.redis.pipeline();
    pipeline.del(this.stateKey(matchId));
    pipeline.srem(this.activeIndexKey(), matchId);
    await pipeline.exec();
  }

  /**
   * Cross-replica critical section. Lock ownership is token-checked on release,
   * so an expired lock cannot be deleted by a former owner.
   */
  async withMatchLock<T>(
    matchId: string,
    operation: () => Promise<T>,
    lockTtlMs = 10_000,
  ): Promise<T> {
    this.assertReady();
    const key = this.lockKey(matchId);
    const token = randomUUID();
    const maxWaitMs = 5_000;
    const startedAt = Date.now();
    let acquired = false;

    while (!acquired && Date.now() - startedAt < maxWaitMs) {
      const result = await this.redis.set(key, token, 'PX', lockTtlMs, 'NX');
      acquired = result === 'OK';
      if (!acquired) await new Promise((resolve) => setTimeout(resolve, 40));
    }

    if (!acquired) {
      throw new ServiceUnavailableException(
        'Battle hozir boshqa serverda qayta ishlanmoqda. Qayta urinib ko‘ring.',
      );
    }

    try {
      return await operation();
    } finally {
      await this.redis.eval(RELEASE_LOCK_SCRIPT, 1, key, token).catch((error) => {
        this.logger.error(
          'Battle lock bo‘shatilmadi:',
          error instanceof Error ? error.message : String(error),
        );
      });
    }
  }
}
