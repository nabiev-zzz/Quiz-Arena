import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectDataSource, InjectRepository } from '@nestjs/typeorm';
import { DataSource, Repository } from 'typeorm';
import { User } from './entities/user.entity';
import { ZcTransaction } from './entities/zc-transaction.entity';

@Injectable()
export class ZcWalletService {
  constructor(
    @InjectDataSource() private readonly dataSource: DataSource,
    @InjectRepository(ZcTransaction) private readonly transactions: Repository<ZcTransaction>,
  ) {}

  async history(userId: string, limit = 30, offset = 0) {
    const safeLimit = Math.min(Math.max(Math.trunc(limit) || 30, 1), 100);
    const safeOffset = Math.max(Math.trunc(offset) || 0, 0);
    const [items, total] = await this.transactions.findAndCount({
      where: { userId },
      order: { createdAt: 'DESC' },
      take: safeLimit,
      skip: safeOffset,
    });
    return {
      items: items.map(({ id, type, amount, balanceAfter, reason, createdAt }) => ({
        id, type, amount, balanceAfter, reason, createdAt,
      })),
      total,
      limit: safeLimit,
      offset: safeOffset,
    };
  }

  async credit(userId: string, amount: number, reason: string, idempotencyKey?: string) {
    return this.applyChange(userId, amount, 'credit', reason, idempotencyKey);
  }

  async debit(userId: string, amount: number, reason: string, idempotencyKey?: string) {
    return this.applyChange(userId, amount, 'debit', reason, idempotencyKey);
  }

  private async applyChange(
    userId: string,
    amount: number,
    type: 'credit' | 'debit',
    reason: string,
    idempotencyKey?: string,
  ) {
    if (!Number.isSafeInteger(amount) || amount <= 0) {
      throw new BadRequestException('ZC miqdori musbat butun son bo‘lishi kerak');
    }
    if (!reason || reason.trim().length < 2 || reason.length > 80) {
      throw new BadRequestException('Tranzaksiya sababi 2–80 belgi bo‘lishi kerak');
    }
    if (idempotencyKey && (idempotencyKey.length > 120 || idempotencyKey.trim().length === 0)) {
      throw new BadRequestException('Idempotency kaliti noto‘g‘ri');
    }

    return this.dataSource.transaction(async (manager) => {
      const user = await manager.findOne(User, {
        where: { id: userId },
        lock: { mode: 'pessimistic_write' },
      });
      if (!user) throw new NotFoundException('Foydalanuvchi topilmadi');

      if (idempotencyKey) {
        const existing = await manager.findOne(ZcTransaction, { where: { idempotencyKey } });
        if (existing) {
          if (existing.userId !== userId || existing.type !== type || existing.amount !== amount) {
            throw new BadRequestException('Idempotency kaliti boshqa tranzaksiyada ishlatilgan');
          }
          return existing;
        }
      }

      const currentBalance = Math.max(0, Number(user.zcBalance ?? 0));
      if (type === 'debit' && currentBalance < amount) {
        throw new BadRequestException('ZC balansi yetarli emas');
      }
      const nextBalance = type === 'credit' ? currentBalance + amount : currentBalance - amount;
      if (!Number.isSafeInteger(nextBalance)) {
        throw new BadRequestException('ZC balansi ruxsat etilgan chegaradan oshdi');
      }

      user.zcBalance = nextBalance;
      await manager.save(User, user);
      const transaction = manager.create(ZcTransaction, {
        userId,
        type,
        amount,
        balanceAfter: nextBalance,
        reason: reason.trim(),
        idempotencyKey: idempotencyKey ?? null,
      });
      return manager.save(ZcTransaction, transaction);
    });
  }
}
