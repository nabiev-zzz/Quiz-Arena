
import {
  Injectable,
  Logger,
  OnModuleDestroy,
  OnModuleInit,
  ServiceUnavailableException,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import Redis from 'ioredis';
import { randomUUID } from 'crypto';
import { In, Repository } from 'typeorm';

import { BattleMatch } from './entities/battle-match.entity';
import { BattleQuestion } from './entities/battle-question.entity';
import { User } from '../users/entities/user.entity';
import { AiService } from '../ai/ai.service';

interface AiGeneratedBattleQuestion {
  question: string;
  options: string[];
  correctAnswer: number;
  explanation: string;
}

export interface BattleQuestionResult {
  questionId: string;
  questionIndex: number;
  correctAnswer: number;
  answers: Record<string, number | null>;
  points: Record<string, number>;
  explanation: string;
}

interface BattleRankingEntry {
  userId: string;
  displayName: string;
  username: string;
  avatarUrl: string | null;
  matches: number;
  wins: number;
  losses: number;
  draws: number;
  points: number;
  winRate: number;
}

@Injectable()
export class BattleService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(BattleService.name);
  private readonly redis: Redis;

  constructor(
    private readonly configService: ConfigService,
    private readonly aiService: AiService,

    @InjectRepository(BattleMatch)
    private readonly matchRepository: Repository<BattleMatch>,

    @InjectRepository(BattleQuestion)
    private readonly questionRepository: Repository<BattleQuestion>,

    @InjectRepository(User)
    private readonly userRepository: Repository<User>,
  ) {
    this.redis = new Redis({
      host: this.configService.get<string>('VALKEY_HOST') || '127.0.0.1',
      port: Number(this.configService.get<string>('VALKEY_PORT') || 6379),
      password:
        this.configService.get<string>('VALKEY_PASSWORD') || undefined,
      lazyConnect: true,
      maxRetriesPerRequest: 2,
      retryStrategy: (times) => Math.min(times * 1000, 5000),
      enableReadyCheck: true,
    });

    this.redis.on('error', (error) => {
      this.logger.error(`Valkey xatosi: ${error.message}`);
    });

    this.redis.on('ready', () => {
      this.logger.log('Valkey ulanishi tayyor');
    });
  }

  async onModuleInit(): Promise<void> {
    try {
      if (this.redis.status === 'wait') {
        await this.redis.connect();
      }

      await this.redis.ping();
      this.logger.log('Battle Valkey tekshiruvi muvaffaqiyatli');
    } catch (error) {
      this.logger.error(
        'Valkey ulanmagan. Battle navbati hozircha ishlamaydi.',
        error instanceof Error ? error.message : String(error),
      );
    }
  }

  async onModuleDestroy(): Promise<void> {
    if (this.redis.status === 'ready') {
      await this.redis.quit();
    } else {
      this.redis.disconnect();
    }
  }

  async getStatus() {
    let valkey = 'offline';

    try {
      valkey = (await this.redis.ping()) === 'PONG' ? 'online' : 'offline';
    } catch {
      valkey = 'offline';
    }

    return {
      module: 'battle',
      status: 'initialized',
      valkey,
      database: 'configured',
      testSystem: 'independent',
    };
  }

  async joinQueue(
    queueKey: string,
    userId: string,
    socketId: string,
  ): Promise<string | null> {
    if (this.redis.status !== 'ready') {
      throw new ServiceUnavailableException(
        'Battle serveri vaqtincha mavjud emas. Qayta urinib ko‘ring.',
      );
    }

    const script = `
      local entries = redis.call('ZRANGE', KEYS[1], 0, -1)

      for _, entry in ipairs(entries) do
        local separator = string.find(entry, ':', 1, true)

        if separator then
          local queuedUserId = string.sub(entry, 1, separator - 1)

          if queuedUserId == ARGV[1] then
            redis.call('ZREM', KEYS[1], entry)
          else
            redis.call('ZREM', KEYS[1], entry)
            return entry
          end
        end
      end

      local member = ARGV[1] .. ':' .. ARGV[2]
      redis.call('ZADD', KEYS[1], ARGV[3], member)
      redis.call('EXPIRE', KEYS[1], 300)

      return ''
    `;

    const result = await this.redis.eval(
      script,
      1,
      queueKey,
      userId,
      socketId,
      String(Date.now()),
    );

    if (typeof result !== 'string' || !result) {
      return null;
    }

    return result;
  }

  async leaveQueue(
    queueKey: string,
    userId: string,
    socketId: string,
  ): Promise<void> {
    if (this.redis.status !== 'ready') {
      return;
    }

    await this.redis.zrem(queueKey, `${userId}:${socketId}`);
  }

  async createMatch(
    playerOneId: string,
    playerTwoId: string,
    mode: string,
  ): Promise<BattleMatch> {
    if (playerOneId === playerTwoId) {
      throw new BadRequestException(
        'Bir foydalanuvchi o‘zi bilan Battle o‘ynay olmaydi.',
      );
    }

    const match = this.matchRepository.create({
      roomCode: randomUUID().replace(/-/g, '').slice(0, 12).toUpperCase(),
      mode,
      status: 'matched',
      playerOneId,
      playerTwoId,
      winnerId: null,
      questionResults: [],
      scores: {
        [playerOneId]: 0,
        [playerTwoId]: 0,
      },
      startedAt: null,
      finishedAt: null,
    });

    return this.matchRepository.save(match);
  }

  async getMatch(matchId: string): Promise<BattleMatch> {
    const match = await this.matchRepository.findOne({
      where: { id: matchId },
    });

    if (!match) {
      throw new NotFoundException('Battle xonasi topilmadi.');
    }

    return match;
  }

  // Jang haqiqatda boshlanganda status va vaqtni bazaga yozadi.
  async markMatchStarted(matchId: string): Promise<BattleMatch> {
    const match = await this.getMatch(matchId);

    if (match.status === 'finished' || match.status === 'cancelled') {
      throw new BadRequestException(
        'Yakunlangan yoki bekor qilingan Battle boshlanmaydi.',
      );
    }

    // Takroriy chaqiruvda dastlabki boshlanish vaqtini saqlab qolamiz.
    if (match.startedAt) {
      return match;
    }

    match.status = 'active';
    match.startedAt = new Date();

    const saved = await this.matchRepository.save(match);

    this.logger.log(
      `Battle ${match.roomCode} boshlandi: ${saved.startedAt?.toISOString()}`,
    );

    return saved;
  }

  async prepareQuestions(
    matchId: string,
    categoryId: string | null = null,
    language: 'uz' | 'ru' | 'en' = 'uz',
    difficulty: 'easy' | 'medium' | 'hard' | 'expert' = 'medium',
  ): Promise<BattleQuestion[]> {
    const match = await this.getMatch(matchId);

    if (match.status === 'finished' || match.status === 'cancelled') {
      throw new BadRequestException('Bu Battle allaqachon yakunlangan.');
    }

    const query = this.questionRepository
      .createQueryBuilder('question')
      .where('question.isActive = :active', { active: true })
      .andWhere('question.language = :language', { language })
      .andWhere('question.difficulty = :difficulty', { difficulty });

    if (categoryId) {
      query.andWhere('question.categoryId = :categoryId', { categoryId });
    } else {
      query.andWhere('question.categoryId IS NULL');
    }

    const existingQuestions = await query
      .orderBy('RANDOM()')
      .limit(10)
      .getMany();

    const missingCount = 10 - existingQuestions.length;
    let generatedQuestions: BattleQuestion[] = [];

    if (missingCount > 0) {
      this.logger.log(
        `Battle uchun ${missingCount} ta yangi savol AI orqali yaratilmoqda.`,
      );

      const aiQuestions: AiGeneratedBattleQuestion[] =
        await this.aiService.generateQuestions({
          subjectId: 'battle',
          topicId: categoryId || 'general',
          count: missingCount,
          difficulty,
          language,
        });

      const entities = aiQuestions.map((question) =>
        this.questionRepository.create({
          categoryId,
          language,
          question: question.question,
          options: question.options,
          correctAnswer: question.correctAnswer,
          explanation: question.explanation,
          difficulty,
          isActive: true,
        }),
      );

      generatedQuestions = await this.questionRepository.save(entities);
    }

    const allQuestions = [...existingQuestions, ...generatedQuestions];

    if (allQuestions.length !== 10) {
      throw new ServiceUnavailableException(
        'Battle uchun 10 ta savol tayyorlanmadi.',
      );
    }

    this.logger.log(
      `Battle ${match.roomCode}: ${allQuestions.length} ta savol tayyor.`,
    );

    return allQuestions;
  }

  async saveProgress(
    matchId: string,
    results: BattleQuestionResult[],
    scores: Record<string, number>,
  ): Promise<BattleMatch> {
    const match = await this.getMatch(matchId);

    if (match.status === 'finished' || match.status === 'cancelled') {
      throw new BadRequestException('Battle yakunlangan.');
    }

    match.questionResults =
      results as unknown as Record<string, unknown>[];
    match.scores = scores;

    return this.matchRepository.save(match);
  }

  async finishMatch(
    matchId: string,
    scores: Record<string, number>,
  ): Promise<BattleMatch> {
    const match = await this.getMatch(matchId);

    if (match.status === 'finished') {
      return match;
    }

    if (match.status === 'cancelled') {
      throw new BadRequestException(
        'Bekor qilingan Battle yakunlana olmaydi.',
      );
    }

    const playerOneScore = scores[match.playerOneId] || 0;
    const playerTwoScore = match.playerTwoId
      ? scores[match.playerTwoId] || 0
      : 0;

    let winnerId: string | null = null;

    if (playerOneScore > playerTwoScore) {
      winnerId = match.playerOneId;
    } else if (playerTwoScore > playerOneScore) {
      winnerId = match.playerTwoId;
    }

    match.scores = scores;
    match.winnerId = winnerId;
    match.status = 'finished';
    match.finishedAt = new Date();

    const saved = await this.matchRepository.save(match);

    this.logger.log(
      `Battle ${match.roomCode} yakunlandi. G‘olib: ${winnerId || 'Durang'}`,
    );

    return saved;
  }

  async cancelMatch(matchId: string): Promise<void> {
    const match = await this.getMatch(matchId);

    if (match.status === 'finished' || match.status === 'cancelled') {
      return;
    }

    match.status = 'cancelled';
    match.finishedAt = new Date();

    await this.matchRepository.save(match);
  }

  // Foydalanuvchining Battle tarixi.
  async getHistory(userId: string, requestedLimit = 20) {
    const limit = Math.min(Math.max(Number(requestedLimit) || 20, 1), 100);

    const matches = await this.matchRepository.find({
      where: [{ playerOneId: userId }, { playerTwoId: userId }],
      order: { createdAt: 'DESC' },
      take: limit,
    });

    const opponentIds = [
      ...new Set(
        matches
          .map((match) =>
            match.playerOneId === userId
              ? match.playerTwoId
              : match.playerOneId,
          )
          .filter((id): id is string => Boolean(id)),
      ),
    ];

    const users = opponentIds.length
      ? await this.userRepository.find({
          where: { id: In(opponentIds) },
          select: {
            id: true,
            displayName: true,
            username: true,
            avatarUrl: true,
          },
        })
      : [];

    const userMap = new Map(users.map((user) => [user.id, user]));

    return {
      total: matches.length,
      matches: matches.map((match) => {
        const opponentId =
          match.playerOneId === userId
            ? match.playerTwoId
            : match.playerOneId;

        const opponent = opponentId
          ? userMap.get(opponentId) || null
          : null;

        let result: 'win' | 'loss' | 'draw' | 'cancelled' | 'unfinished' =
          'unfinished';

        if (match.status === 'cancelled') {
          result = 'cancelled';
        } else if (match.status === 'finished') {
          if (!match.winnerId) {
            result = 'draw';
          } else {
            result = match.winnerId === userId ? 'win' : 'loss';
          }
        }

        return {
          id: match.id,
          roomCode: match.roomCode,
          mode: match.mode,
          status: match.status,
          result,
          opponent: opponent
            ? {
                id: opponent.id,
                displayName: opponent.displayName,
                username: opponent.username,
                avatarUrl: opponent.avatarUrl,
              }
            : null,
          myScore: match.scores?.[userId] || 0,
          opponentScore: opponentId
            ? match.scores?.[opponentId] || 0
            : 0,
          winnerId: match.winnerId,
          createdAt: match.createdAt,
          startedAt: match.startedAt,
          finishedAt: match.finishedAt,
        };
      }),
    };
  }

  // Faqat yakunlangan janglar asosida shaxsiy statistika.
  async getStats(userId: string) {
    const matches = await this.matchRepository.find({
      where: [
        { playerOneId: userId, status: 'finished' },
        { playerTwoId: userId, status: 'finished' },
      ],
      order: { finishedAt: 'DESC' },
    });

    let wins = 0;
    let losses = 0;
    let draws = 0;
    let totalPoints = 0;

    for (const match of matches) {
      totalPoints += match.scores?.[userId] || 0;

      if (!match.winnerId) {
        draws++;
      } else if (match.winnerId === userId) {
        wins++;
      } else {
        losses++;
      }
    }

    const total = matches.length;

    return {
      userId,
      totalMatches: total,
      wins,
      losses,
      draws,
      totalPoints,
      averagePoints:
        total > 0 ? Math.round((totalPoints / total) * 100) / 100 : 0,
      winRate: total > 0 ? Math.round((wins / total) * 10000) / 100 : 0,
      recentMatches: matches.slice(0, 5).map((match) => ({
        id: match.id,
        mode: match.mode,
        result: !match.winnerId
          ? 'draw'
          : match.winnerId === userId
            ? 'win'
            : 'loss',
        myScore: match.scores?.[userId] || 0,
        finishedAt: match.finishedAt,
      })),
    };
  }

  // Battle uchun alohida reyting.
  async getLeaderboard(requestedLimit = 50) {
    const limit = Math.min(Math.max(Number(requestedLimit) || 50, 1), 100);

    const matches = await this.matchRepository.find({
      where: { status: 'finished' },
      order: { finishedAt: 'DESC' },
    });

    const rankingMap = new Map<
      string,
      {
        matches: number;
        wins: number;
        losses: number;
        draws: number;
        points: number;
      }
    >();

    for (const match of matches) {
      const playerIds = [
        match.playerOneId,
        match.playerTwoId,
      ].filter((id): id is string => Boolean(id));

      for (const playerId of playerIds) {
        const current = rankingMap.get(playerId) || {
          matches: 0,
          wins: 0,
          losses: 0,
          draws: 0,
          points: 0,
        };

        current.matches++;
        current.points += match.scores?.[playerId] || 0;

        if (!match.winnerId) {
          current.draws++;
        } else if (match.winnerId === playerId) {
          current.wins++;
        } else {
          current.losses++;
        }

        rankingMap.set(playerId, current);
      }
    }

    const playerIds = [...rankingMap.keys()];

    if (playerIds.length === 0) {
      return { total: 0, leaderboard: [] };
    }

    const users = await this.userRepository.find({
      where: { id: In(playerIds) },
      select: {
        id: true,
        displayName: true,
        username: true,
        avatarUrl: true,
      },
    });

    const userMap = new Map(users.map((user) => [user.id, user]));

    const leaderboard: BattleRankingEntry[] = playerIds
      .map((userId) => {
        const user = userMap.get(userId);
        const stats = rankingMap.get(userId)!;

        if (!user) {
          return null;
        }

        return {
          userId,
          displayName: user.displayName,
          username: user.username,
          avatarUrl: user.avatarUrl,
          matches: stats.matches,
          wins: stats.wins,
          losses: stats.losses,
          draws: stats.draws,
          points: stats.points,
          winRate:
            stats.matches > 0
              ? Math.round((stats.wins / stats.matches) * 10000) / 100
              : 0,
        };
      })
      .filter((entry): entry is BattleRankingEntry => entry !== null)
      .sort(
        (a, b) =>
          b.wins - a.wins ||
          b.winRate - a.winRate ||
          b.points - a.points ||
          b.matches - a.matches,
      );

    return {
      total: leaderboard.length,
      leaderboard: leaderboard.slice(0, limit).map((entry, index) => ({
        rank: index + 1,
        ...entry,
      })),
    };
  }
}
