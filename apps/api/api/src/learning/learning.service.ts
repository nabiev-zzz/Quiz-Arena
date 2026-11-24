import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { AiService } from '../ai/ai.service';
import { LearningQuestion } from './entities/learning-question.entity';
import { LearningTopic } from './entities/learning-topic.entity';
import { InjectRepository } from '@nestjs/typeorm';
import { In, IsNull, Repository } from 'typeorm';
import { LearningAttempt } from './entities/learning-attempt.entity';
import { learningCatalog } from './learning-catalog';
import { LearningWebSession } from './entities/learning-web-session.entity';

export interface CreateLearningAttemptInput {
  subjectId: string;
  subjectName: string;
  topicId: string;
  topicName: string;
  totalQuestions: number;
  correctAnswers: number;
}

@Injectable()
export class LearningService {
  constructor(
    @InjectRepository(LearningAttempt)
    private readonly attempts: Repository<LearningAttempt>,
    @InjectRepository(LearningTopic)
    private readonly topics: Repository<LearningTopic>,
    @InjectRepository(LearningWebSession)
    private readonly webSessions: Repository<LearningWebSession>,
    private readonly dataSource: DataSource,
    private readonly aiService: AiService,
  ) {}

  getCatalog() {
    return learningCatalog;
  }

  async getTopicQuestions(input: {
    subjectId: string;
    topicId: string;
    count: number;
    difficulty: 'easy' | 'medium' | 'hard' | 'expert';
    language: 'uz' | 'ru' | 'en';
  }) {
    const subjectId = String(input?.subjectId ?? '').trim();
    const topicId = String(input?.topicId ?? '').trim();
    const count = Number(input?.count);
    if (!subjectId || !topicId || !Number.isInteger(count) || count < 1 || count > 20) {
      throw new BadRequestException('Test sozlamalari noto‘g‘ri.');
    }

    const topic = await this.topics.findOne({ where: { subjectId, topicId, isActive: true } });
    if (!topic) throw new NotFoundException('Bu mavzu topilmadi yoki vaqtincha faol emas.');

    // Bir mavzu/til/qiyinlik kombinatsiyasi uchun parallel so‘rovlar faqat bir marta AI chaqiradi.
    const lockKey = [subjectId, topicId, input.language, input.difficulty].join(':');
    return this.dataSource.transaction(async (manager) => {
      await manager.query('SELECT pg_advisory_xact_lock(hashtext($1))', [lockKey]);
      const bank = manager.getRepository(LearningQuestion);
      let cached = await bank.find({
        where: { subjectId, topicId, language: input.language, difficulty: input.difficulty, isActive: true },
        order: { createdAt: 'ASC' },
        take: 20,
      });

      if (cached.length < 20) {
        const generated = await this.aiService.generateQuestions({
          subjectId,
          topicId,
          subjectName: topic.subjectName,
          topicName: topic.topicName,
          topicDescription: topic.description,
          count: 20 - cached.length,
          difficulty: input.difficulty,
          language: input.language,
        });
        const rows = generated.map((question: { question: string; options: string[]; correctAnswer: number; explanation: string }) => bank.create({
          subjectId,
          topicId,
          language: input.language,
          difficulty: input.difficulty,
          question: question.question,
          options: question.options,
          correctAnswer: question.correctAnswer,
          explanation: question.explanation,
          isActive: true,
        }));
        await bank.save(rows);
        cached = [...cached, ...rows];
      }

      const selected = await bank.createQueryBuilder('question')
        .where('question.subjectId = :subjectId', { subjectId })
        .andWhere('question.topicId = :topicId', { topicId })
        .andWhere('question.language = :language', { language: input.language })
        .andWhere('question.difficulty = :difficulty', { difficulty: input.difficulty })
        .andWhere('question.isActive = TRUE')
        .orderBy('RANDOM()')
        .take(count)
        .getMany();

      return { questions: selected.map((question) => ({
        id: question.id,
        subjectId: question.subjectId,
        topicId: question.topicId,
        question: question.question,
        options: question.options,
        correctAnswer: question.correctAnswer,
        explanation: question.explanation,
        difficulty: question.difficulty,
      })), source: 'database', cachedQuestionCount: cached.length };
    });
  }

  async getWebTopicQuestions(userId: string, input: {
    subjectId: string;
    topicId: string;
    count: number;
    difficulty: 'easy' | 'medium' | 'hard' | 'expert';
    language: 'uz' | 'ru' | 'en';
  }) {
    const result = await this.getTopicQuestions(input);
    const session = this.webSessions.create({
      userId,
      subjectId: input.subjectId,
      topicId: input.topicId,
      language: input.language,
      difficulty: input.difficulty,
      questionIds: result.questions.map((question) => question.id),
      expiresAt: new Date(Date.now() + 60 * 60 * 1000),
      submittedAt: null,
    });
    await this.webSessions.save(session);

    return {
      sessionId: session.id,
      source: result.source,
      cachedQuestionCount: result.cachedQuestionCount,
      questions: result.questions.map(({ id, subjectId, topicId, question, options, difficulty }) => ({
        id, subjectId, topicId, question, options, difficulty,
      })),
    };
  }

  async submitWebAttempt(userId: string, input: {
    sessionId: string;
    subjectId: string;
    topicId: string;
    language: 'uz' | 'ru' | 'en';
    difficulty: 'easy' | 'medium' | 'hard' | 'expert';
    answers: Array<{ questionId: string; selectedAnswer: number }>;
  }) {
    return this.dataSource.transaction(async (manager) => {
      const sessionRepo = manager.getRepository(LearningWebSession);
      const session = await sessionRepo.findOne({
        where: { id: input.sessionId, userId, submittedAt: IsNull() },
        lock: { mode: 'pessimistic_write' },
      });
      if (!session || session.expiresAt.getTime() <= Date.now()) {
        throw new BadRequestException('Test sessiyasi tugagan. Iltimos, testni qayta boshlang.');
      }
      if (
        session.subjectId !== input.subjectId ||
        session.topicId !== input.topicId ||
        session.language !== input.language ||
        session.difficulty !== input.difficulty
      ) {
        throw new BadRequestException('Test sozlamalari sessiyaga mos kelmadi.');
      }

      const expectedIds = session.questionIds;
      const answerIds = input.answers.map((answer) => answer.questionId);
      if (
        answerIds.length !== expectedIds.length ||
        new Set(answerIds).size !== answerIds.length ||
        expectedIds.some((id) => !answerIds.includes(id))
      ) {
        throw new BadRequestException('Barcha savollarga bittadan javob berish shart.');
      }

      const questions = await manager.getRepository(LearningQuestion).find({
        where: {
          id: In(expectedIds),
          subjectId: session.subjectId,
          topicId: session.topicId,
          language: session.language,
          difficulty: session.difficulty,
          isActive: true,
        },
      });
      if (questions.length !== expectedIds.length) {
        throw new BadRequestException('Test savollari bazada topilmadi. Testni qayta boshlang.');
      }

      const byId = new Map(questions.map((question) => [question.id, question]));
      const answersById = new Map(input.answers.map((answer) => [answer.questionId, answer.selectedAnswer]));
      const review = expectedIds.map((id) => {
        const question = byId.get(id)!;
        const selectedAnswer = answersById.get(id)!;
        return {
          id: question.id,
          question: question.question,
          options: question.options,
          selectedAnswer,
          correctAnswer: question.correctAnswer,
          isCorrect: selectedAnswer === question.correctAnswer,
          explanation: question.explanation,
        };
      });
      const correctAnswers = review.filter((item) => item.isCorrect).length;
      const totalQuestions = review.length;
      const accuracy = Math.round((correctAnswers / totalQuestions) * 10000) / 100;
      const topic = await manager.getRepository(LearningTopic).findOne({
        where: { subjectId: session.subjectId, topicId: session.topicId, isActive: true },
      });
      if (!topic) throw new NotFoundException('Bu mavzu topilmadi.');

      const attempt = manager.getRepository(LearningAttempt).create({
        userId,
        subjectId: session.subjectId,
        subjectName: topic.subjectName,
        topicId: session.topicId,
        topicName: topic.topicName,
        totalQuestions,
        correctAnswers,
        accuracy,
      });
      await manager.getRepository(LearningAttempt).save(attempt);
      session.submittedAt = new Date();
      await sessionRepo.save(session);

      return { attemptId: attempt.id, totalQuestions, correctAnswers, accuracy, review };
    });
  }

  async createAttempt(userId: string, input: CreateLearningAttemptInput) {
    const totalQuestions = Number(input?.totalQuestions);
    const correctAnswers = Number(input?.correctAnswers);
    const subjectId = String(input?.subjectId ?? '').trim();
    const subjectName = String(input?.subjectName ?? '').trim();
    const topicId = String(input?.topicId ?? '').trim();
    const topicName = String(input?.topicName ?? '').trim();

    if (
      !subjectId || subjectId.length > 80 ||
      !subjectName || subjectName.length > 120 ||
      !topicId || topicId.length > 100 ||
      !topicName || topicName.length > 160 ||
      !Number.isInteger(totalQuestions) || totalQuestions < 1 || totalQuestions > 200 ||
      !Number.isInteger(correctAnswers) || correctAnswers < 0 ||
      correctAnswers > totalQuestions
    ) {
      throw new BadRequestException('Test natijasi ma’lumotlari noto‘g‘ri.');
    }

    const attempt = this.attempts.create({
      userId,
      subjectId,
      subjectName,
      topicId,
      topicName,
      totalQuestions,
      correctAnswers,
      accuracy: Math.round((correctAnswers / totalQuestions) * 10000) / 100,
    });

    return this.attempts.save(attempt);
  }

  async getStats(userId: string) {
    const summary = await this.attempts
      .createQueryBuilder('attempt')
      .select('COUNT(attempt.id)', 'totalAttempts')
      .addSelect('COALESCE(SUM(attempt.totalQuestions), 0)', 'totalQuestions')
      .addSelect('COALESCE(SUM(attempt.correctAnswers), 0)', 'correctAnswers')
      .where('attempt.userId = :userId', { userId })
      .getRawOne();

    const subjectRows = await this.attempts
      .createQueryBuilder('attempt')
      .select('attempt.subjectId', 'subjectId')
      .addSelect('attempt.subjectName', 'subjectName')
      .addSelect('COUNT(attempt.id)', 'attempts')
      .addSelect('SUM(attempt.totalQuestions)', 'totalQuestions')
      .addSelect('SUM(attempt.correctAnswers)', 'correctAnswers')
      .where('attempt.userId = :userId', { userId })
      .groupBy('attempt.subjectId')
      .addGroupBy('attempt.subjectName')
      .orderBy('COUNT(attempt.id)', 'DESC')
      .getRawMany();

    const since = new Date();
    since.setUTCHours(0, 0, 0, 0);
    since.setUTCDate(since.getUTCDate() - 6);

    const activityRows = await this.attempts
      .createQueryBuilder('attempt')
      .select("TO_CHAR(DATE_TRUNC('day', attempt.completedAt), 'YYYY-MM-DD')", 'day')
      .addSelect('COUNT(attempt.id)', 'attempts')
      .addSelect('SUM(attempt.correctAnswers)', 'correctAnswers')
      .where('attempt.userId = :userId', { userId })
      .andWhere('attempt.completedAt >= :since', { since })
      .groupBy("DATE_TRUNC('day', attempt.completedAt)")
      .orderBy("DATE_TRUNC('day', attempt.completedAt)", 'ASC')
      .getRawMany();

    const activityMap = new Map(
      activityRows.map((row) => [
        String(row.day),
        {
          attempts: Number(row.attempts) || 0,
          correctAnswers: Number(row.correctAnswers) || 0,
        } as const,
      ]),
    );

    const weeklyActivity = Array.from({ length: 7 }, (_, index) => {
      const date = new Date(since);
      date.setUTCDate(since.getUTCDate() + index);
      const day = date.toISOString().slice(0, 10);
      const item = activityMap.get(day);
      return {
        day,
        attempts: item?.attempts ?? 0,
        correctAnswers: item?.correctAnswers ?? 0,
      };
    });

    const totalAttempts = Number(summary?.totalAttempts) || 0;
    const totalQuestions = Number(summary?.totalQuestions) || 0;
    const correctAnswers = Number(summary?.correctAnswers) || 0;

    const recentAttempts = await this.attempts.find({
      where: { userId },
      order: { completedAt: 'DESC' },
      take: 8,
    });

    return {
      totalAttempts,
      totalQuestions,
      correctAnswers,
      accuracy: totalQuestions > 0
        ? Math.round((correctAnswers / totalQuestions) * 10000) / 100
        : 0,
      weeklyActivity,
      subjectBreakdown: subjectRows.map((row) => {
        const questions = Number(row.totalQuestions) || 0;
        const correct = Number(row.correctAnswers) || 0;
        return {
          subjectId: String(row.subjectId),
          subjectName: String(row.subjectName),
          attempts: Number(row.attempts) || 0,
          totalQuestions: questions,
          correctAnswers: correct,
          accuracy: questions > 0
            ? Math.round((correct / questions) * 10000) / 100
            : 0,
        };
      }),
      recentAttempts,
    };
  }
}
