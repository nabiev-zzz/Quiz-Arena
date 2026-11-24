import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { AiService } from '../ai/ai.service';
import { LearningQuestion } from './entities/learning-question.entity';
import { LearningTopic } from './entities/learning-topic.entity';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { LearningAttempt } from './entities/learning-attempt.entity';

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
    private readonly dataSource: DataSource,
    private readonly aiService: AiService,
  ) {}

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
          count: 20 - cached.length,
          difficulty: input.difficulty,
          language: input.language,
        });
        const rows = generated.map((question) => bank.create({
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
