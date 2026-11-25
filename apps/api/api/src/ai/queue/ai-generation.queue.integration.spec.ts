import { randomUUID } from 'node:crypto';
import { Queue, QueueEvents, Worker } from 'bullmq';
import {
  AI_GENERATION_PREFIX,
  createAiQueueRedisConnection,
} from './ai-generation-queue.service';

const hasRedis = Boolean(
  process.env.REDIS_URL?.trim() ||
  process.env.VALKEY_URL?.trim() ||
  process.env.VALKEY_HOST?.trim(),
);

(hasRedis ? describe : describe.skip)('BullMQ Redis integration', () => {
  const queueName = 'ai-generation-integration';
  const prefix = `${AI_GENERATION_PREFIX}:integration:${process.pid}`;
  let queue: Queue;
  let worker: Worker;
  let events: QueueEvents;
  let queueConnection: ReturnType<typeof createAiQueueRedisConnection>;
  let workerConnection: ReturnType<typeof createAiQueueRedisConnection>;
  let eventsConnection: ReturnType<typeof createAiQueueRedisConnection>;

  beforeAll(async () => {
    queueConnection = createAiQueueRedisConnection();
    workerConnection = createAiQueueRedisConnection();
    eventsConnection = createAiQueueRedisConnection();
    await Promise.all([
      queueConnection.connect(),
      workerConnection.connect(),
      eventsConnection.connect(),
    ]);

    queue = new Queue(queueName, { connection: queueConnection, prefix });
    events = new QueueEvents(queueName, { connection: eventsConnection, prefix });
    worker = new Worker(
      queueName,
      async (job) => ({ doubled: Number(job.data.value) * 2 }),
      { connection: workerConnection, prefix, concurrency: 1 },
    );
    await Promise.all([queue.waitUntilReady(), events.waitUntilReady(), worker.waitUntilReady()]);
  }, 15_000);

  afterAll(async () => {
    await Promise.all([
      worker?.close(),
      events?.close(),
      queue?.close(),
    ]);
    for (const connection of [queueConnection, workerConnection, eventsConnection]) {
      if (connection?.status === 'ready') await connection.quit();
      else connection?.disconnect();
    }
  });

  it('persists, consumes and completes an AI queue job through Redis', async () => {
    const job = await queue.add('integration-check', { value: 21 }, {
      jobId: randomUUID(),
      attempts: 1,
      removeOnComplete: true,
    });
    const result = await job.waitUntilFinished(events, 10_000);
    expect(result).toEqual({ doubled: 42 });
  }, 15_000);
});
