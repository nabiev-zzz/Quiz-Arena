import { beforeEach, describe, expect, it, jest } from '@jest/globals';
import { DirectMessagesGateway } from './direct-messages.gateway';

describe('DirectMessagesGateway authentication and delivery', () => {
  const jwt = { verifyAsync: jest.fn() };
  const users = { findOne: jest.fn() };
  const gateway = new DirectMessagesGateway(jwt as never, { findOne: users.findOne } as never);
  const makeSocket = (overrides: Record<string, unknown> = {}) => ({
    handshake: { auth: { token: 'valid-token' }, headers: {}, ...overrides },
    data: {} as Record<string, unknown>,
    join: jest.fn().mockResolvedValue(undefined),
    emit: jest.fn(),
    disconnect: jest.fn(),
  });

  beforeEach(() => {
    jest.clearAllMocks();
    jwt.verifyAsync.mockResolvedValue({ sub: 'user-1' });
    users.findOne.mockResolvedValue({ id: 'user-1', username: 'one' });
  });

  it('authenticates a socket and joins only the verified user room', async () => {
    const socket = makeSocket();
    await gateway.handleConnection(socket as never);

    expect(jwt.verifyAsync).toHaveBeenCalledWith('valid-token');
    expect(users.findOne).toHaveBeenCalledWith({
      where: { id: 'user-1', status: 'active' },
      select: { id: true, username: true },
    });
    expect(socket.data.userId).toBe('user-1');
    expect(socket.join).toHaveBeenCalledWith('user:user-1');
    expect(socket.emit).toHaveBeenCalledWith('direct:connected', { connected: true });
    expect(socket.disconnect).not.toHaveBeenCalled();
  });

  it('rejects missing, invalid, or inactive-user credentials', async () => {
    const missing = makeSocket({ auth: {} });
    await gateway.handleConnection(missing as never);
    expect(missing.disconnect).toHaveBeenCalledWith(true);
    expect(missing.join).not.toHaveBeenCalled();

    jwt.verifyAsync.mockRejectedValueOnce(new Error('expired'));
    const invalid = makeSocket();
    await gateway.handleConnection(invalid as never);
    expect(invalid.disconnect).toHaveBeenCalledWith(true);
    expect(invalid.join).not.toHaveBeenCalled();

    users.findOne.mockResolvedValueOnce(null);
    const inactive = makeSocket();
    await gateway.handleConnection(inactive as never);
    expect(inactive.disconnect).toHaveBeenCalledWith(true);
    expect(inactive.join).not.toHaveBeenCalled();
  });

  it('supports a Bearer authorization header when handshake auth is absent', async () => {
    const socket = makeSocket({ auth: {}, headers: { authorization: 'Bearer header-token' } });
    await gateway.handleConnection(socket as never);
    expect(jwt.verifyAsync).toHaveBeenCalledWith('header-token');
    expect(socket.join).toHaveBeenCalledWith('user:user-1');
  });

  it('sends message and read notifications only to the intended user rooms', () => {
    const emit = jest.fn();
    const to = jest.fn(() => ({ emit }));
    (gateway as unknown as { server: unknown }).server = { to };
    const message = { id: 'message-1', conversationId: 'conversation-1', isMine: true };

    gateway.notifyMessage('sender-1', 'recipient-1', message);
    expect(to).toHaveBeenNthCalledWith(1, 'user:sender-1');
    expect(emit).toHaveBeenNthCalledWith(1, 'direct:message', { ...message, isMine: true });
    expect(to).toHaveBeenNthCalledWith(2, 'user:recipient-1');
    expect(emit).toHaveBeenNthCalledWith(2, 'direct:message', { ...message, isMine: false });

    gateway.notifyRead('reader-1', 'conversation-1');
    expect(to).toHaveBeenNthCalledWith(3, 'user:reader-1');
    expect(emit).toHaveBeenNthCalledWith(3, 'direct:read', { conversationId: 'conversation-1' });
  });

  it('calculates ownership correctly for edited-message events', () => {
    const emits: Array<{ room: string; event: string; payload: Record<string, unknown> }> = [];
    const server = { to: (room: string) => ({ emit: (event: string, payload: Record<string, unknown>) => emits.push({ room, event, payload }) }) };
    (gateway as unknown as { server: unknown }).server = server;
    gateway.notifyMessageUpdated('user-1', 'user-2', { id: 'message-1', senderId: 'user-1' });
    expect(emits.map((entry) => [entry.room, entry.payload.isMine])).toEqual([['user:user-1', true], ['user:user-2', false]]);
  });

  it('calculates ownership correctly for deleted-message events', () => {
    const emits: Array<{ room: string; event: string; payload: Record<string, unknown> }> = [];
    const server = { to: (room: string) => ({ emit: (event: string, payload: Record<string, unknown>) => emits.push({ room, event, payload }) }) };
    (gateway as unknown as { server: unknown }).server = server;
    gateway.notifyMessageDeleted(['user-1', 'user-2'], 'conversation-1', { id: 'message-1', senderId: 'user-1' });
    expect(emits.map((entry) => [entry.room, entry.payload.isMine])).toEqual([['user:user-1', true], ['user:user-2', false]]);
  });
});
