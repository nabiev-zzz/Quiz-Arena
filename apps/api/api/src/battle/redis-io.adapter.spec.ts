import { INestApplicationContext } from '@nestjs/common';
import { RedisIoAdapter } from './redis-io.adapter';

describe('RedisIoAdapter', () => {
  const originalEnv = {
    redisUrl: process.env.REDIS_URL,
    valkeyUrl: process.env.VALKEY_URL,
    valkeyHost: process.env.VALKEY_HOST,
  };

  afterEach(() => {
    if (originalEnv.redisUrl === undefined) delete process.env.REDIS_URL;
    else process.env.REDIS_URL = originalEnv.redisUrl;
    if (originalEnv.valkeyUrl === undefined) delete process.env.VALKEY_URL;
    else process.env.VALKEY_URL = originalEnv.valkeyUrl;
    if (originalEnv.valkeyHost === undefined) delete process.env.VALKEY_HOST;
    else process.env.VALKEY_HOST = originalEnv.valkeyHost;
  });

  it('keeps the local adapter when no shared Redis endpoint is configured', async () => {
    delete process.env.REDIS_URL;
    delete process.env.VALKEY_URL;
    delete process.env.VALKEY_HOST;

    const adapter = new RedisIoAdapter({} as INestApplicationContext);

    await expect(adapter.connectToRedis()).resolves.toBe(false);
    await adapter.closeRedisConnections();
  });
});
