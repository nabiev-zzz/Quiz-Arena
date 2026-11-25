import { jest, describe, expect, it, beforeEach } from '@jest/globals';
import * as bcrypt from 'bcryptjs';
import { AuthService } from './auth.service';

describe('AuthService.deleteAccount', () => {
  const userId = '00000000-0000-4000-8000-000000000001';
  const user = {
    id: userId,
    email: 'player@example.com',
    phoneNumber: '+998901234567',
    passwordHash: '',
  };
  const query = jest.fn<() => Promise<unknown>>();
  const manager = { query };
  const transaction = jest.fn(async (callback: (value: typeof manager) => Promise<unknown>) => callback(manager));
  const getOne = jest.fn<() => Promise<typeof user | null>>();
  const queryBuilder = {
    addSelect: jest.fn(),
    where: jest.fn(),
    andWhere: jest.fn(),
    getOne,
  };
  const userRepository = { createQueryBuilder: jest.fn(() => queryBuilder), findOne: jest.fn() };
  let service: AuthService;

  beforeEach(async () => {
    query.mockReset();
    query.mockResolvedValue([]);
    transaction.mockClear();
    getOne.mockReset();
    getOne.mockResolvedValue(user);
    userRepository.findOne.mockResolvedValue(user);
    queryBuilder.addSelect.mockReturnValue(queryBuilder);
    queryBuilder.where.mockReturnValue(queryBuilder);
    queryBuilder.andWhere.mockReturnValue(queryBuilder);
    user.passwordHash = await bcrypt.hash('correct-password', 4);
    service = new AuthService(
      userRepository as never,
      {} as never,
      {} as never,
      {} as never,
      {} as never,
      { transaction } as never,
    );
  });


  it('requires a password and never starts a transaction without one', async () => {
    await expect(service.deleteAccount(userId, '')).rejects.toThrow('tasdiqlash usuli topilmadi');
    expect(transaction).not.toHaveBeenCalled();
  });

  it('does not delete anything when the password is wrong', async () => {
    await expect(service.deleteAccount(userId, 'wrong-password')).rejects.toThrow('Parol noto‘g‘ri');
    expect(transaction).not.toHaveBeenCalled();
  });

  it('allows a verified Google or Telegram session to delete without a local password', async () => {
    getOne.mockResolvedValue({ ...user, googleSubject: 'google-subject' });
    const result = await service.deleteAccount(userId);
    expect(result.deleted).toBe(true);
    expect(transaction).toHaveBeenCalledTimes(1);
  });

  it('deletes account-linked data transactionally and anonymizes the payment ledger', async () => {
    const result = await service.deleteAccount(userId, 'correct-password');
    expect(result.deleted).toBe(true);
    expect(transaction).toHaveBeenCalledTimes(1);
    const statements = query.mock.calls.map(([sql]) => String(sql));
    expect(statements.some((sql) => sql.includes('DELETE FROM auth_oauth_codes'))).toBe(true);
    expect(statements.some((sql) => sql.includes('DELETE FROM battle_matches'))).toBe(true);
    expect(statements.some((sql) => sql.includes('UPDATE subscription_payments') && sql.includes('SET \"userId\" = NULL') && sql.includes('providerPayload') && sql.includes('pending') && sql.includes('cancelled'))).toBe(true);
    expect(statements.some((sql) => sql.includes('DELETE FROM auth_email_codes'))).toBe(true);
    expect(statements.some((sql) => sql.includes('DELETE FROM auth_otps'))).toBe(true);
    expect(statements.some((sql) => sql.includes('DELETE FROM learning_web_sessions'))).toBe(true);
    expect(statements.at(-1)).toContain('DELETE FROM users');
  });
});
