import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource, EntityManager } from 'typeorm';
import { User } from './entities/user.entity';
import { ZcTransaction } from './entities/zc-transaction.entity';
import { DailyTaskProgress } from './entities/daily-task-progress.entity';

type DailyTaskDefinition = {
  id: string;
  title: string;
  description: string;
  target: number;
  reward: number;
};

// The task IDs remain stable so existing per-day progress and reward claims stay compatible.
// Targets and rewards rotate deterministically by Tashkent calendar date; no cron job is required.
const DAILY_TASK_ROTATIONS: DailyTaskDefinition[][] = [
  [
    { id: 'ranked_battle_1', title: 'Birinchi jang', description: 'Bugun 1 ta Ranked Battle yakunlang', target: 1, reward: 10 },
    { id: 'ranked_win_1', title: 'G‘alaba sari', description: 'Bugun 1 ta Ranked Battle yuting', target: 1, reward: 15 },
    { id: 'ranked_battle_3', title: 'Faol jangchi', description: 'Bugun 2 ta Ranked Battle yakunlang', target: 2, reward: 14 },
  ],
  [
    { id: 'ranked_battle_1', title: 'Jangni boshlang', description: 'Bugun 1 ta Ranked Battle yakunlang', target: 1, reward: 10 },
    { id: 'ranked_win_1', title: 'Ketma-ket g‘alaba', description: 'Bugun 2 ta Ranked Battle yuting', target: 2, reward: 22 },
    { id: 'ranked_battle_3', title: 'Maydonda faol', description: 'Bugun 3 ta Ranked Battle yakunlang', target: 3, reward: 20 },
  ],
  [
    { id: 'ranked_battle_1', title: 'Bugungi start', description: 'Bugun 1 ta Ranked Battle yakunlang', target: 1, reward: 10 },
    { id: 'ranked_win_1', title: 'Chempion ruhi', description: 'Bugun 3 ta Ranked Battle yuting', target: 3, reward: 30 },
    { id: 'ranked_battle_3', title: 'Tirishqoq jangchi', description: 'Bugun 4 ta Ranked Battle yakunlang', target: 4, reward: 26 },
  ],
  [
    { id: 'ranked_battle_1', title: 'Birinchi qadam', description: 'Bugun 1 ta Ranked Battle yakunlang', target: 1, reward: 10 },
    { id: 'ranked_win_1', title: 'G‘alabalar seriyasi', description: 'Bugun 1 ta Ranked Battle yuting', target: 1, reward: 18 },
    { id: 'ranked_battle_3', title: 'Faollik sinovi', description: 'Bugun 5 ta Ranked Battle yakunlang', target: 5, reward: 32 },
  ],
];

function tasksForDate(date: string): DailyTaskDefinition[] {
  const dayNumber = Math.floor(Date.parse(`${date}T00:00:00.000Z`) / 86_400_000);
  const rotationIndex = ((dayNumber % DAILY_TASK_ROTATIONS.length) + DAILY_TASK_ROTATIONS.length) % DAILY_TASK_ROTATIONS.length;
  return DAILY_TASK_ROTATIONS[rotationIndex];
}

function tashkentDate(): string {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Tashkent',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(new Date());
  const values = Object.fromEntries(parts.map((part) => [part.type, part.value]));
  return `${values.year}-${values.month}-${values.day}`;
}

@Injectable()
export class DailyTasksService {
  constructor(@InjectDataSource() private readonly dataSource: DataSource) {}

  async getToday(userId: string) {
    const date = tashkentDate();
    const rows = await this.dataSource.getRepository(DailyTaskProgress).find({
      where: { userId, taskDate: date },
    });
    const byId = new Map(rows.map((row) => [row.taskId, row]));
    return {
      date,
      timezone: 'Asia/Tashkent',
      tasks: tasksForDate(date).map((task) => {
        const row = byId.get(task.id);
        const progress = Math.min(task.target, row?.progress ?? 0);
        return {
          ...task,
          progress,
          completed: progress >= task.target,
          claimed: Boolean(row?.claimedAt),
          claimedAt: row?.claimedAt ?? null,
        };
      }),
    };
  }

  async recordRankedBattle(manager: EntityManager, userId: string, won: boolean) {
    const date = tashkentDate();
    const repo = manager.getRepository(DailyTaskProgress);
    const increments = [
      { id: 'ranked_battle_1', amount: 1 },
      { id: 'ranked_battle_3', amount: 1 },
      ...(won ? [{ id: 'ranked_win_1', amount: 1 }] : []),
    ];
    for (const item of increments) {
      await repo.query(
        `INSERT INTO daily_task_progress ("userId", "taskDate", "taskId", progress, "createdAt", "updatedAt")
         VALUES ($1, $2, $3, $4, now(), now())
         ON CONFLICT ("userId", "taskDate", "taskId")
         DO UPDATE SET progress = daily_task_progress.progress + EXCLUDED.progress, "updatedAt" = now()`,
        [userId, date, item.id, item.amount],
      );
    }
  }

  async claim(userId: string, taskId: string) {
    return this.dataSource.transaction(async (manager) => {
      const user = await manager.findOne(User, {
        where: { id: userId },
        lock: { mode: 'pessimistic_write' },
      });
      if (!user) throw new NotFoundException('Foydalanuvchi topilmadi');

      const date = tashkentDate();
      const task = tasksForDate(date).find((item) => item.id === taskId);
      if (!task) throw new NotFoundException('Kunlik vazifa topilmadi');
      const repo = manager.getRepository(DailyTaskProgress);
      const row = await repo.findOne({
        where: { userId, taskDate: date, taskId },
        lock: { mode: 'pessimistic_write' },
      });
      if (!row || row.progress < task.target) {
        throw new BadRequestException('Vazifa hali bajarilmagan');
      }
      if (row.claimedAt) {
        return { claimed: false, alreadyClaimed: true, reward: task.reward, balance: user.zcBalance };
      }

      const balance = Number(user.zcBalance ?? 0);
      const nextBalance = balance + task.reward;
      if (!Number.isSafeInteger(nextBalance)) throw new BadRequestException('ZC balans chegarasidan oshdi');

      user.zcBalance = nextBalance;
      row.claimedAt = new Date();
      await manager.save(User, user);
      await manager.save(DailyTaskProgress, row);
      await manager.save(ZcTransaction, manager.create(ZcTransaction, {
        userId,
        type: 'credit',
        amount: task.reward,
        balanceAfter: nextBalance,
        reason: `Kunlik vazifa: ${task.title}`,
        idempotencyKey: `daily-task:${userId}:${date}:${task.id}`,
      }));

      return { claimed: true, reward: task.reward, balance: nextBalance };
    });
  }
}
