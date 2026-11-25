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

  it('serializes disconnect and reconnect transitions across API instances', async () => {
    const state = createState(randomUUID());
    await serverA.save(state);
    const disconnectedAt = Date.now();

    const disconnected = await serverA.markPlayerDisconnected(
      state.matchId,
      'player-a',
      'socket-a',
      disconnectedAt,
    );
    expect(disconnected?.socketIds['player-a']).toBeUndefined();
    expect(disconnected?.disconnectedAt['player-a']).toBe(disconnectedAt);

    const reconnected = await serverB.reconnectPlayer(
      state.matchId,
      'player-a',
      'socket-a-new',
    );
    expect(reconnected?.socketIds['player-a']).toBe('socket-a-new');
    expect(reconnected?.disconnectedAt['player-a']).toBeUndefined();

    await expect(
      serverA.claimDisconnectTimeout(state.matchId, 'player-a', disconnectedAt),
    ).resolves.toBeNull();
    await serverA.remove(state.matchId);
  });

  it('allows only one replica to claim an expired disconnect timeout', async () => {
    const state = createState(randomUUID());
    const disconnectedAt = Date.now() - 31_000;
    delete state.socketIds['player-a'];
    state.disconnectedAt['player-a'] = disconnectedAt;
    await serverA.save(state);

    const claims = await Promise.all([
      serverA.claimDisconnectTimeout(state.matchId, 'player-a', disconnectedAt),
      serverB.claimDisconnectTimeout(state.matchId, 'player-a', disconnectedAt),
    ]);

    expect(claims.filter(Boolean)).toHaveLength(1);
    const saved = await serverB.get(state.matchId);
    expect(saved?.finishing).toBe(true);
    await serverA.remove(state.matchId);
  });

  it('shares private invites and atomically claims them across API instances', async () => {
    const roomCode = randomUUID().replace(/-/g, '').slice(0, 12).toUpperCase();
    const invite = {
      roomCode,
      hostUserId: randomUUID(),
      hostSocketId: 'socket-on-api-a',
      expiresAt: Date.now() + 60_000,
    };

    await expect(serverA.createPrivateInvite(invite)).resolves.toBe(true);
    await expect(serverB.getPrivateInvite(roomCode)).resolves.toMatchObject(invite);
    await expect(serverB.getPrivateInviteForHost(invite.hostUserId)).resolves.toMatchObject(invite);
    await expect(serverB.createPrivateInvite({
      ...invite,
      roomCode: randomUUID().replace(/-/g, '').slice(0, 12).toUpperCase(),
    })).resolves.toBe(false);

    const claimed = await serverB.claimPrivateInvite(roomCode, 'guest-user');
    expect(claimed).toMatchObject(invite);
    await expect(serverA.getPrivateInvite(roomCode)).resolves.toBeNull();
    await expect(serverA.getPrivateInviteForHost(invite.hostUserId)).resolves.toBeNull();
  });

  it('shares private invite code rate limits across API instances', async () => {
    const userId = randomUUID();
    for (let attempt = 0; attempt < 8; attempt += 1) {
      const store = attempt % 2 === 0 ? serverA : serverB;
      await expect(store.consumePrivateJoinAttempt(userId, 8, 60)).resolves.toBe(true);
    }
    await expect(serverB.consumePrivateJoinAttempt(userId, 8, 60)).resolves.toBe(false);
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
