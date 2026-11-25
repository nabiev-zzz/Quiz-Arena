import { afterEach, beforeEach, describe, expect, it, jest } from '@jest/globals';
import { BattleGateway } from './battle.gateway';

describe('BattleGateway private Friends Battle rooms', () => {
  const battleService = { createMatch: jest.fn() };
  const featureUsageService = { consume: jest.fn(), refund: jest.fn() };
  const battleStateStore = {
    isReady: jest.fn(() => false),
    listActive: jest.fn().mockResolvedValue([]),
    save: jest.fn().mockResolvedValue(undefined),
    remove: jest.fn().mockResolvedValue(undefined),
    get: jest.fn().mockResolvedValue(null),
    recordAnswer: jest.fn(),
    claimQuestionResolution: jest.fn(),
    markPlayerReady: jest.fn(),
    claimAdvance: jest.fn(),
    withMatchLock: jest.fn(),
  };
  const gateway = new BattleGateway(
    {} as never,
    battleService as never,
    {} as never,
    featureUsageService as never,
    battleStateStore as never,
  );

  const makeSocket = (userId: string, id: string) => ({
    id,
    data: { userId, username: userId },
    emit: jest.fn(),
  });

  beforeEach(() => {
    jest.useFakeTimers();
    jest.clearAllMocks();
    featureUsageService.consume.mockResolvedValue({
      allowed: true, featureKey: 'privateBattle', tier: 'free',
      period: 'daily', limit: 3, used: 1, remaining: 2,
    });
  });

  afterEach(() => {
    jest.clearAllTimers();
    jest.useRealTimers();
  });

  it('creates a twelve-character private room and consumes the host daily quota', async () => {
    const host = makeSocket('host-1', 'socket-host');
    await gateway.createPrivateRoom(host as never);

    const created = host.emit.mock.calls.find(([event]) => event === 'battle:private:created')?.[1] as { roomCode: string; maxPlayers: number };
    expect(created.roomCode).toMatch(/^[A-F0-9]{12}$/);
    expect(created.maxPlayers).toBe(2);
    expect(featureUsageService.consume).toHaveBeenCalledWith('host-1', 'privateBattle');

    await gateway.cancelPrivateRoom(host as never, { roomCode: created.roomCode });
    expect(featureUsageService.refund).toHaveBeenCalledWith('host-1', 'privateBattle');
  });

  it('does not create a room when the daily quota is exhausted', async () => {
    featureUsageService.consume.mockResolvedValue({
      allowed: false, featureKey: 'privateBattle', tier: 'free',
      period: 'daily', limit: 3, used: 3, remaining: 0,
    });
    const host = makeSocket('host-2', 'socket-host-2');

    await gateway.createPrivateRoom(host as never);

    expect(host.emit).toHaveBeenCalledWith('battle:error', expect.objectContaining({
      message: expect.stringContaining('limiti'),
    }));
    expect(host.emit).not.toHaveBeenCalledWith('battle:private:created', expect.anything());
  });

  it('prevents the room owner from joining their own invite code', async () => {
    const host = makeSocket('host-3', 'socket-host-3');
    await gateway.createPrivateRoom(host as never);
    const created = host.emit.mock.calls.find(([event]) => event === 'battle:private:created')?.[1] as { roomCode: string };

    await gateway.joinPrivateRoom(host as never, { roomCode: created.roomCode });

    expect(host.emit).toHaveBeenCalledWith('battle:error', expect.objectContaining({
      message: expect.stringContaining('O‘z xonangiz'),
    }));
    await gateway.cancelPrivateRoom(host as never, { roomCode: created.roomCode });
  });

  it('rejects malformed invite codes without touching the database', async () => {
    const guest = makeSocket('guest-1', 'socket-guest');
    await gateway.joinPrivateRoom(guest as never, { roomCode: 'BAD-CODE' });

    expect(guest.emit).toHaveBeenCalledWith('battle:error', expect.objectContaining({
      message: '12 belgili xona kodi noto‘g‘ri.',
    }));
    expect(battleService.createMatch).not.toHaveBeenCalled();
  });
});
