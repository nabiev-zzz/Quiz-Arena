import { describe, expect, it, jest } from '@jest/globals';
import { DailyTasksService } from './daily-tasks.service';
import { User } from './entities/user.entity';

describe('DailyTasksService', () => {
  it('returns the three daily missions with Tashkent timezone', async () => {
    const dataSource: any = { getRepository: () => ({ find: async () => [] }) };
    const service = new DailyTasksService(dataSource);
    const result = await service.getToday('user-1');
    expect(result.timezone).toBe('Asia/Tashkent');
    expect(result.tasks).toHaveLength(3);
    expect(result.tasks.every((task: any) => task.progress === 0 && !task.claimed)).toBe(true);
  });

  it('rejects claiming a mission before it is completed', async () => {
    const row = { userId: 'user-1', progress: 0, claimedAt: null };
    const manager: any = {
      findOne: jest.fn(async (entity: any) => entity === User ? ({ id: 'user-1', zcBalance: 0 }) : row),
      getRepository: () => ({ findOne: async () => row }),
      save: jest.fn(async (_entity: any, value: any) => value),
      create: (_entity: any, value: any) => value,
    };
    const dataSource: any = { transaction: async (callback: any) => callback(manager) };
    const service = new DailyTasksService(dataSource);
    await expect(service.claim('user-1', 'ranked_battle_1')).rejects.toThrow('Vazifa hali bajarilmagan');
    expect(manager.save).not.toHaveBeenCalled();
  });

  it('credits a completed daily mission once and stores its wallet ledger entry', async () => {
    const row: any = { userId: 'user-1', progress: 1, claimedAt: null };
    const user: any = { id: 'user-1', zcBalance: 30 };
    const saved: any[] = [];
    const manager: any = {
      findOne: jest.fn(async (entity: any) => entity === User ? user : row),
      getRepository: () => ({ findOne: async () => row }),
      save: jest.fn(async (_entity: any, value: any) => { saved.push(value); return value; }),
      create: (_entity: any, value: any) => value,
    };
    const dataSource: any = { transaction: async (callback: any) => callback(manager) };
    const service = new DailyTasksService(dataSource);

    const first = await service.claim('user-1', 'ranked_battle_1');
    expect(first).toEqual({ claimed: true, reward: 10, balance: 40 });
    expect(user.zcBalance).toBe(40);
    expect(row.claimedAt).toBeInstanceOf(Date);
    expect(saved).toHaveLength(3);
    expect(saved.some((entry) => entry.type === 'credit' && entry.amount === 10 && entry.idempotencyKey.includes('ranked_battle_1'))).toBe(true);

    const second = await service.claim('user-1', 'ranked_battle_1');
    expect(second.claimed).toBe(false);
    expect(second.alreadyClaimed).toBe(true);
    expect(user.zcBalance).toBe(40);
  });

  it('records progress only through the trusted ranked battle event', async () => {
    const queries: unknown[][] = [];
    const manager: any = { getRepository: () => ({ query: async (...args: unknown[]) => { queries.push(args); } }) };
    const dataSource: any = {};
    const service = new DailyTasksService(dataSource);
    await service.recordRankedBattle(manager, 'user-1', true);
    expect(queries).toHaveLength(3);
    expect(queries.every((query) => String(query[0]).includes('ON CONFLICT'))).toBe(true);
  });
});
