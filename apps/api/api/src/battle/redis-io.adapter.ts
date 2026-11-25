import { INestApplicationContext, Logger } from '@nestjs/common';
import { IoAdapter } from '@nestjs/platform-socket.io';
import { createAdapter } from '@socket.io/redis-adapter';
import Redis from 'ioredis';
import type { Server, ServerOptions } from 'socket.io';

/**
 * Shares Socket.IO room broadcasts and socket-management operations between
 * API replicas. This adapter does NOT persist BattleGateway's in-memory state.
 */
export class RedisIoAdapter extends IoAdapter {
  private readonly adapterLogger = new Logger(RedisIoAdapter.name);
  private pubClient: Redis | null = null;
  private subClient: Redis | null = null;

  constructor(app: INestApplicationContext) {
    super(app);
  }

  async connectToRedis(): Promise<boolean> {
    const redisUrl =
      process.env.REDIS_URL?.trim() || process.env.VALKEY_URL?.trim();
    const host = process.env.VALKEY_HOST?.trim();

    if (!redisUrl && !host) {
      this.adapterLogger.warn(
        'REDIS_URL/VALKEY_URL/VALKEY_HOST sozlanmagan; Socket.IO lokal adapterda ishlaydi. Multi-replica rejimi yoqilmagan.',
      );
      return false;
    }

    const options = {
      lazyConnect: true,
      maxRetriesPerRequest: 2,
      retryStrategy: (times: number) => Math.min(times * 500, 5000),
      enableReadyCheck: true,
    };

    const publisher = redisUrl
      ? new Redis(redisUrl, options)
      : new Redis({
          host,
          port: Number(process.env.VALKEY_PORT || 6379),
          password: process.env.VALKEY_PASSWORD || undefined,
          ...options,
        });
    const subscriber = publisher.duplicate();

    const logClientError = (role: string) => (error: Error) => {
      this.adapterLogger.error(`Socket.IO Redis ${role} xatosi: ${error.message}`);
    };
    publisher.on('error', logClientError('publisher'));
    subscriber.on('error', logClientError('subscriber'));

    try {
      await Promise.all([publisher.connect(), subscriber.connect()]);
      await Promise.all([publisher.ping(), subscriber.ping()]);

      this.pubClient = publisher;
      this.subClient = subscriber;
      this.adapterLogger.log('Socket.IO Redis adapter ulanishi tayyor');
      return true;
    } catch (error) {
      publisher.disconnect();
      subscriber.disconnect();
      this.adapterLogger.error(
        'Socket.IO Redis adapter ulanmadi; noto‘g‘ri single-node fallback bilan API ishga tushirilmaydi.',
        error instanceof Error ? error.stack : String(error),
      );
      throw new Error(
        'Socket.IO Redis adapter configured but Redis is unavailable.',
      );
    }
  }

  createIOServer(port: number, options?: ServerOptions): Server {
    const server = super.createIOServer(port, options) as Server;

    if (this.pubClient && this.subClient) {
      server.adapter(
        createAdapter(this.pubClient, this.subClient, {
          key: 'quiz-arena:socket.io',
        }),
      );
    }

    return server;
  }

  async closeRedisConnections(): Promise<void> {
    const clients = [this.pubClient, this.subClient].filter(
      (client): client is Redis => client !== null,
    );
    this.pubClient = null;
    this.subClient = null;

    await Promise.all(
      clients.map(async (client) => {
        if (client.status === 'ready') {
          await client.quit();
        } else {
          client.disconnect();
        }
      }),
    );
  }
}
