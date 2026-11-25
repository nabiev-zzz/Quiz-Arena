import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import Redis from 'ioredis';

/**
 * Redis cache for shared, non-personalized learning question pools.
 * Uses a dedicated keyspace and degrades to PostgreSQL when Redis is absent.
 * It is intentionally unrelated to BattleStateStore and Socket.IO.
 */
@Injectable()
export class LearningQuestionCache implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(LearningQuestionCache.name);
  private readonly redis: Redis;
  private readonly prefix: string;
  private ready = false;
  private readonly ttlSeconds = 15 * 60;

  constructor() {
    const url = process.env.REDIS_URL?.trim() || process.env.VALKEY_URL?.trim();
    const host = process.env.VALKEY_HOST?.trim();
    this.prefix = `quiz-arena:${process.env.NODE_ENV || 'development'}:ai-question-cache:`;
    this.redis = url
      ? new Redis(url, { lazyConnect: true, connectTimeout: 1500, maxRetriesPerRequest: 1, retryStrategy: () => null })
      : new Redis({
          host: host || '127.0.0.1',
          port: Number(process.env.VALKEY_PORT || 6379),
          password: process.env.VALKEY_PASSWORD || undefined,
          lazyConnect: true,
          connectTimeout: 1500,
          maxRetriesPerRequest: 1,
          retryStrategy: () => null,
        });
    this.redis.on('error', (error) => this.logger.warn(`Learning Redis cache: ${error.message}`));
  }

  async onModuleInit(): Promise<void> {
    if (!process.env.REDIS_URL?.trim() && !process.env.VALKEY_URL?.trim() && !process.env.VALKEY_HOST?.trim()) {
      this.logger.warn('AI question Redis cache sozlanmagan; PostgreSQL question bank ishlatiladi.');
      return;
    }
    try {
      await this.redis.connect();
      await this.redis.ping();
      this.ready = true;
      this.logger.log('AI question Redis cache tayyor');
    } catch (error) {
      this.ready = false;
      this.redis.disconnect();
      this.logger.warn(`AI question Redis cache o‘chirilgan, PostgreSQL fallback: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  async onModuleDestroy(): Promise<void> {
    if (this.redis.status === 'ready') await this.redis.quit();
    else this.redis.disconnect();
  }

  async get<T>(key: string): Promise<T | null> {
    if (!this.ready) return null;
    try {
      const value = await this.redis.get(this.prefix + key);
      return value ? JSON.parse(value) as T : null;
    } catch (error) {
      this.logger.warn(`AI question cache read failed: ${error instanceof Error ? error.message : String(error)}`);
      return null;
    }
  }

  async set(key: string, value: unknown): Promise<void> {
    if (!this.ready) return;
    try {
      await this.redis.set(this.prefix + key, JSON.stringify(value), 'EX', this.ttlSeconds);
    } catch (error) {
      this.logger.warn(`AI question cache write failed: ${error instanceof Error ? error.message : String(error)}`);
    }
  }
}
