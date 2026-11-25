import { ConfigService } from '@nestjs/config';
import { randomUUID } from 'node:crypto';
import { BattleStateStore, BattleStateSnapshot } from './battle-state.store';

describe('BattleStateStore (shared Redis)', () => {
  const prefix = `quiz-arena:test:${randomUUID()}`;
  const config = {
    get: (key: string) => {
      const values: Record<string, string> = {
        VALKEY_HOST: process.env.VALKEY_HOST || '127.0.0.1',
        VALKEY_PORT: process.env.VALKEY_PORT || '6379',
        BATTLE_REDIS_PREFIX: prefix,
        BATTLE_SHARED_STATE_REQUIRED: 'true',
      };
      return values[key];
    },
  } as ConfigService;

  let serverA: BattleStateStore;
  let serverB: BattleStateStore;

  const createState = (matchId: string): BattleStateSnapshot => ({
    version: 1,
    matchId,
    room: `battle:${matchId}`,
    roomCode: 'ABC123DEF456',
    mode: 'casual',
    playerIds: ['player-a', 'player-b'],
    usernames: { 'player-a': 'A', 'player-b': 'B' },
    socketIds: { 'player-a': 'socket-a', 'player-b': 'socket-b' },
    questions: [],
    scores: { 'player-a': 0, 'player-b': 0 },
    questionIndex: 0,
    answers: {},
    results: [],
    deadline: Date.now() + 20_000,
    resolving: false,
    questionResolved: false,
    finishing: false,
    finishAttempts: 0,
    readyPlayers: [],
    disconnectedAt: {},
    updatedAt: Date.now(),
  });

  beforeAll(async () => {
    serverA = new BattleStateStore(config);
    serverB = new BattleStateStore(config);
    await Promise.all([serverA.onModuleInit(), serverB.onModuleInit()]);
    if (!serverA.isReady() || !serverB.isReady()) {
      throw new Error('Redis service is required for BattleStateStore tests.');
    }
  });

  afterAll(async () => {
    await Promise.all([serverA.onModuleDestroy(), serverB.onModuleDestroy()]);
  });

  it('shares an active match between two independent API state stores', async () => {
    const state = createState(randomUUID());
    await serverA.save(state);

    const recovered = await serverB.get(state.matchId);
    expect(recovered).toMatchObject({
      matchId: state.matchId,
      playerIds: state.playerIds,
      scores: state.scores,
      questionIndex: 0,
    });

    await serverB.remove(state.matchId);
    await expect(serverA.get(state.matchId)).resolves.toBeNull();
  });

  it('restores active match snapshots after the writer instance is recreated', async () => {
    const state = createState(randomUUID());
    await serverA.save(state);

    const restartedApiStore = new BattleStateStore(config);
    await restartedApiStore.onModuleInit();
    try {
      const active = await restartedApiStore.listActive();
      expect(active.some((item) => item.matchId === state.matchId)).toBe(true);
    } finally {
      await restartedApiStore.remove(state.matchId);
      await restartedApiStore.onModuleDestroy();
    }
  });

  it('serializes critical sections across two API instances', async () => {
    const matchId = randomUUID();
    const order: string[] = [];

    await Promise.all([
      serverA.withMatchLock(matchId, async () => {
        order.push('a:start');
        await new Promise((resolve) => setTimeout(resolve, 100));
        order.push('a:end');
      }),
      serverB.withMatchLock(matchId, async () => {
        order.push('b:start');
        order.push('b:end');
      }),
    ]);

    expect(order).toEqual(['a:start', 'a:end', 'b:start', 'b:end']);
  });
});
