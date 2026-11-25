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


  it('accepts only one answer when two API instances race', async () => {
    const state = createState(randomUUID());
    await serverA.save(state);

    const results = await Promise.all([
      serverA.recordAnswer(state.matchId, 'player-a', 'socket-a', 0, 1),
      serverB.recordAnswer(state.matchId, 'player-a', 'socket-a', 0, 2),
    ]);

    expect(results.filter((result) => result.accepted)).toHaveLength(1);
    const saved = await serverB.get(state.matchId);
    expect(saved?.answers['player-a']).toBeDefined();
    await serverA.remove(state.matchId);
  });

  it('allows only one API instance to claim match completion', async () => {
    const state = createState(randomUUID());
    await serverA.save(state);

    const claims = await Promise.all([
      serverA.claimFinish(state.matchId),
      serverB.claimFinish(state.matchId),
    ]);

    expect(claims.filter(Boolean)).toHaveLength(1);
    await serverA.remove(state.matchId);
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

    const firstEnd = order.indexOf('a:end') < order.indexOf('b:end') ? order.indexOf('a:end') : order.indexOf('b:end');
    const secondStart = order.indexOf('a:start') > order.indexOf('b:start') ? order.indexOf('a:start') : order.indexOf('b:start');
    expect(firstEnd).toBeLessThan(secondStart);
  });
});
