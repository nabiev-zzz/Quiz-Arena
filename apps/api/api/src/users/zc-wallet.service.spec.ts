import { beforeEach, describe, expect, it, jest } from '@jest/globals';
import { BadRequestException, NotFoundException } from '@nestjs/common';
import { ZcWalletService } from './zc-wallet.service';
import { User } from './entities/user.entity';

describe('ZcWalletService', () => {
  const manager = {
    findOne: jest.fn(),
    save: jest.fn(),
    create: jest.fn(),
  };
  const dataSource = {
    transaction: jest.fn(async (work: (tx: typeof manager) => Promise<unknown>) => work(manager)),
  };
  const transactions = { findAndCount: jest.fn() };
  const service = new ZcWalletService(dataSource as never, transactions as never);

  beforeEach(() => {
    jest.clearAllMocks();
    dataSource.transaction.mockImplementation(async (work) => work(manager));
    manager.findOne.mockImplementation(async (_entity, options) => {
      const where = (options as { where?: Record<string, unknown> } | undefined)?.where || {};
      return 'idempotencyKey' in where ? null : { id: 'user-1', zcBalance: 100 };
    });
    manager.save.mockImplementation(async (_entity, value) => value);
    manager.create.mockImplementation((_entity, value) => value);
  });

  it('bounds history pagination and scopes results to the authenticated user', async () => {
    transactions.findAndCount.mockResolvedValue([[], 0]);
    const result = await service.history('user-1', 500, -20);
    expect(transactions.findAndCount).toHaveBeenCalledWith({
      where: { userId: 'user-1' }, order: { createdAt: 'DESC' }, take: 100, skip: 0,
    });
    expect(result).toMatchObject({ total: 0, limit: 100, offset: 0 });
  });

  it('credits and debits under a row lock and records the resulting balance', async () => {
    const credit = await service.credit('user-1', 25, 'Battle mukofoti', 'credit-1');
    expect(manager.findOne).toHaveBeenCalledWith(User, {
      where: { id: 'user-1' }, lock: { mode: 'pessimistic_write' },
    });
    expect(manager.save).toHaveBeenCalledWith(User, expect.objectContaining({ zcBalance: 125 }));
    expect(credit).toMatchObject({ userId: 'user-1', type: 'credit', amount: 25, balanceAfter: 125, idempotencyKey: 'credit-1' });

    manager.findOne.mockResolvedValueOnce({ id: 'user-1', zcBalance: 125 });
    const debit = await service.debit('user-1', 40, 'Do‘kon xaridi');
    expect(debit).toMatchObject({ userId: 'user-1', type: 'debit', amount: 40, balanceAfter: 85 });
  });

  it('rejects insufficient funds without saving a changed balance', async () => {
    await expect(service.debit('user-1', 101, 'Do‘kon xaridi')).rejects.toBeInstanceOf(BadRequestException);
    expect(manager.save).not.toHaveBeenCalled();
  });

  it('returns the prior transaction for an identical idempotency key', async () => {
    const prior = { id: 'tx-1', userId: 'user-1', type: 'credit', amount: 25, balanceAfter: 125 };
    manager.findOne.mockResolvedValueOnce({ id: 'user-1', zcBalance: 125 }).mockResolvedValueOnce(prior);
    await expect(service.credit('user-1', 25, 'Battle mukofoti', 'same-key')).resolves.toBe(prior);
    expect(manager.save).not.toHaveBeenCalled();
  });

  it('rejects a reused idempotency key with different transaction details', async () => {
    manager.findOne.mockResolvedValueOnce({ id: 'user-1', zcBalance: 125 }).mockResolvedValueOnce({
      id: 'tx-1', userId: 'user-1', type: 'credit', amount: 25,
    });
    await expect(service.debit('user-1', 25, 'Do‘kon xaridi', 'same-key')).rejects.toBeInstanceOf(BadRequestException);
    expect(manager.save).not.toHaveBeenCalled();
  });

  it('rejects missing users and invalid transaction amounts', async () => {
    manager.findOne.mockResolvedValueOnce(null);
    await expect(service.credit('missing-user', 10, 'Bonus')).rejects.toBeInstanceOf(NotFoundException);
    await expect(service.credit('user-1', 0, 'Bonus')).rejects.toBeInstanceOf(BadRequestException);
    await expect(service.credit('user-1', 1.5, 'Bonus')).rejects.toBeInstanceOf(BadRequestException);
  });
});
