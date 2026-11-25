import { jest, describe, expect, it, beforeEach } from '@jest/globals';
import { EmailAuthService } from './email-auth.service';

describe('EmailAuthService account deletion verification', () => {
  const findOne = jest.fn();
  const issueCode = jest.fn();
  const consumeCode = jest.fn();
  let service: EmailAuthService;

  beforeEach(() => {
    findOne.mockReset();
    issueCode.mockReset();
    consumeCode.mockReset();
    service = new EmailAuthService(
      { findOne } as never,
      {} as never,
      {} as never,
      {} as never,
    );
    (service as unknown as { issueCode: typeof issueCode }).issueCode = issueCode;
    (service as unknown as { consumeCode: typeof consumeCode }).consumeCode = consumeCode;
  });

  it('returns a generic response and sends no code for unknown or unverified email', async () => {
    findOne.mockResolvedValue(null);
    const result = await service.requestAccountDeletion('missing@example.com');
    expect(result.message).toContain('Agar tasdiqlangan email');
    expect(issueCode).not.toHaveBeenCalled();
  });

  it('sends a deletion code only to a verified active account email', async () => {
    findOne.mockResolvedValue({ emailVerifiedAt: new Date(), status: 'active' });
    await service.requestAccountDeletion(' Player@Example.com ');
    expect(issueCode).toHaveBeenCalledWith('player@example.com', 'delete_account');
  });

  it('returns the account ID only after the one-time code is consumed', async () => {
    consumeCode.mockResolvedValue('player@example.com');
    findOne.mockResolvedValue({ id: 'user-123', emailVerifiedAt: new Date(), status: 'active' });
    const result = await service.confirmAccountDeletion('player@example.com', '123456');
    expect(consumeCode).toHaveBeenCalledWith('player@example.com', 'delete_account', '123456');
    expect(result).toEqual({ userId: 'user-123' });
  });
});
