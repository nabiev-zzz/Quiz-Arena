import { BattleService, BattleQuestionResult } from './battle.service';
import { BattleMatch } from './entities/battle-match.entity';
import { User } from '../users/entities/user.entity';

describe('BattleService — Rank tizimi', () => {
  let service: BattleService;
  let match: any;
  let users: Map<string, any>;
  let manager: any;

  const playerOneId = 'user-1';
  const playerTwoId = 'user-2';

  function createResults(
    playerOneCorrect: number,
    playerTwoCorrect: number,
    total = 10,
  ): BattleQuestionResult[] {
    return Array.from({ length: total }, (_, index) => ({
      questionId: `question-${index}`,
      questionIndex: index,
      correctAnswer: 1,
      answers: {
        [playerOneId]: index < playerOneCorrect ? 1 : 0,
        [playerTwoId]: index < playerTwoCorrect ? 1 : 0,
      },
      points: {
        [playerOneId]: index < playerOneCorrect ? 100 : 0,
        [playerTwoId]: index < playerTwoCorrect ? 100 : 0,
      },
      explanation: 'Test explanation',
    }));
  }

  function setup(
    mode: 'ranked' | 'casual' = 'ranked',
    playerOneRank = 100,
    playerTwoRank = 100,
  ) {
    match = {
      id: 'match-1',
      playerOneId,
      playerTwoId,
      mode,
      status: 'active',
      questionResults: [],
      rankChanges: {},
      scores: {},
      winnerId: null,
      finishedAt: null,
    };

    users = new Map([
      [
        playerOneId,
        {
          id: playerOneId,
          rankPoints: playerOneRank,
        },
      ],
      [
        playerTwoId,
        {
          id: playerTwoId,
          rankPoints: playerTwoRank,
        },
      ],
    ]);

    const matchRepo: any = {
      findOne: jest.fn(async () => match),
      save: jest.fn(async (entity: any) => entity),
    };

    const userRepo: any = {
      findOne: jest.fn(async (options: any) => {
        return users.get(options?.where?.id) ?? null;
      }),
      save: jest.fn(async (entity: any) => {
        users.set(entity.id, entity);
        return entity;
      }),
    };

    manager = {
      getRepository: jest.fn((entity: any) => {
        if (entity === BattleMatch) return matchRepo;
        if (entity === User) return userRepo;
        throw new Error('Unknown repository');
      }),
    };

    const matchRepository: any = {
      manager: {
        transaction: jest.fn(async (callback: any) => {
          return callback(manager);
        }),
      },
    };

    const configService: any = {
      get: jest.fn(() => undefined),
    };

    const aiService: any = {};

    const questionRepository: any = {};
    const userRepository: any = {};

    service = new BattleService(
      configService,
      aiService,
      matchRepository,
      questionRepository,
      userRepository,
    );
  }

  afterEach(async () => {
    if (service) {
      await service.onModuleDestroy();
    }
  });

  it('Ranked g‘alabada RP to‘g‘ri hisoblanadi', async () => {
    setup('ranked', 100, 100);

    const results = createResults(8, 2);

    const response = await service.finishMatch(
      match.id,
      {
        [playerOneId]: 800,
        [playerTwoId]: 200,
      },
      results,
    );

    const change = response.rankChanges[playerOneId];

    // Base 18 + performance 6 + relative 3 = 27
    expect(change.delta).toBe(27);
    expect(change.previousPoints).toBe(100);
    expect(change.rankPoints).toBe(127);
    expect(change.rankTier).toBe('Bronze');

    expect(users.get(playerOneId).rankPoints).toBe(127);
  });

  it('Durangda RP beriladi', async () => {
    setup('ranked', 100, 100);

    const results = createResults(5, 5);

    const response = await service.finishMatch(
      match.id,
      {
        [playerOneId]: 500,
        [playerTwoId]: 500,
      },
      results,
    );

    const change = response.rankChanges[playerOneId];

    // Base 8 + performance 0 + relative 0 = 8
    expect(change.delta).toBe(8);
    expect(change.rankPoints).toBe(108);
  });

  it('Mag‘lubiyatda RP kamayadi, ammo 0 dan pastga tushmaydi', async () => {
    setup('ranked', 5, 100);

    const results = createResults(2, 8);

    const response = await service.finishMatch(
      match.id,
      {
        [playerOneId]: 200,
        [playerTwoId]: 800,
      },
      results,
    );

    const change = response.rankChanges[playerOneId];

    // Hisoblangan -19, lekin maksimal yo‘qotish -15.
    expect(change.delta).toBe(-5);
    expect(change.rankPoints).toBe(0);
    expect(users.get(playerOneId).rankPoints).toBe(0);
  });

  it('Ranked jang 10 ta savolsiz yakunlanmasligi kerak', async () => {
    setup('ranked');

    const results = createResults(8, 2, 9);

    await expect(
      service.finishMatch(
        match.id,
        {
          [playerOneId]: 800,
          [playerTwoId]: 200,
        },
        results,
      ),
    ).rejects.toThrow();

    expect(users.get(playerOneId).rankPoints).toBe(100);
    expect(match.status).toBe('active');
  });

  it('Casual rejimida RP berilmasligi kerak', async () => {
    setup('casual', 100, 100);

    const results = createResults(8, 2);

    const response = await service.finishMatch(
      match.id,
      {
        [playerOneId]: 800,
        [playerTwoId]: 200,
      },
      results,
    );

    expect(response.rankChanges).toEqual({});
    expect(users.get(playerOneId).rankPoints).toBe(100);
    expect(users.get(playerTwoId).rankPoints).toBe(100);
  });

  it('Bir jangni takroran yakunlash RPni ikkinchi marta bermaydi', async () => {
    setup('ranked', 100, 100);

    const results = createResults(8, 2);

    const firstResponse = await service.finishMatch(
      match.id,
      {
        [playerOneId]: 800,
        [playerTwoId]: 200,
      },
      results,
    );

    expect(firstResponse.rankChanges[playerOneId].rankPoints).toBe(127);
    expect(users.get(playerOneId).rankPoints).toBe(127);

    const secondResponse = await service.finishMatch(
      match.id,
      {
        [playerOneId]: 800,
        [playerTwoId]: 200,
      },
      results,
    );

    expect(secondResponse.rankChanges).toEqual(firstResponse.rankChanges);
    expect(secondResponse.rankChanges[playerOneId].rankPoints).toBe(127);
    expect(secondResponse.rankChanges[playerTwoId].rankPoints).toBe(73);
    expect(users.get(playerOneId).rankPoints).toBe(127);
    expect(users.get(playerTwoId).rankPoints).toBe(73);
  });
});