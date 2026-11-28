import { jest } from '@jest/globals';

jest.unstable_mockModule('./direct-messages.service', () => ({ DirectMessagesService: class DirectMessagesService {} }));
jest.unstable_mockModule('./direct-messages.gateway', () => ({ DirectMessagesGateway: class DirectMessagesGateway {} }));

const { DirectMessagesController } = await import('./direct-messages.controller');

describe('DirectMessagesController idempotent sends', () => {
  it('does not broadcast a duplicate message retry', async () => {
    const result = { created: false, recipientId: 'recipient-1', message: { id: 'message-1' } };
    const direct = { sendMessage: jest.fn().mockResolvedValue(result) };
    const gateway = { notifyMessage: jest.fn() };
    const controller = new DirectMessagesController(direct as never, gateway as never);

    await expect(controller.send({ user: { id: 'sender-1' } }, 'conversation-1', { content: 'hello', clientMessageId: 'dm-test-key-123' }))
      .resolves.toBe(result.message);
    expect(direct.sendMessage).toHaveBeenCalledWith('sender-1', 'conversation-1', 'hello', { content: 'hello', clientMessageId: 'dm-test-key-123' });
    expect(gateway.notifyMessage).not.toHaveBeenCalled();
  });

  it('broadcasts only a newly created message', async () => {
    const message = { id: 'message-2' };
    const result = { created: true, recipientId: 'recipient-1', message };
    const direct = { sendMessage: jest.fn().mockResolvedValue(result) };
    const gateway = { notifyMessage: jest.fn() };
    const controller = new DirectMessagesController(direct as never, gateway as never);

    await expect(controller.send({ user: { id: 'sender-1' } }, 'conversation-1', { content: 'hello', clientMessageId: 'dm-test-key-456' }))
      .resolves.toBe(message);
    expect(gateway.notifyMessage).toHaveBeenCalledWith('sender-1', 'recipient-1', message);
  });

  it('broadcasts edited messages to both participants after the service authorizes the edit', async () => {
    const message = { id: 'message-edit', senderId: 'sender-1', content: 'updated' };
    const direct = {
      editMessage: jest.fn().mockResolvedValue(message),
      getConversationParticipants: jest.fn().mockResolvedValue({ otherUserId: 'recipient-1' }),
    };
    const gateway = { notifyMessageUpdated: jest.fn() };
    const controller = new DirectMessagesController(direct as never, gateway as never);
    await expect(controller.edit({ user: { id: 'sender-1' } }, 'conversation-1', 'message-edit', { content: 'updated' })).resolves.toBe(message);
    expect(gateway.notifyMessageUpdated).toHaveBeenCalledWith('sender-1', 'recipient-1', message);
  });

  it('validates delete scope and notifies both users for delete-for-everyone', async () => {
    const message = { id: 'message-delete', senderId: 'sender-1' };
    const direct = {
      deleteMessage: jest.fn().mockResolvedValue(message),
      getConversationParticipants: jest.fn().mockResolvedValue({ otherUserId: 'recipient-1' }),
    };
    const gateway = { notifyMessageDeleted: jest.fn() };
    const controller = new DirectMessagesController(direct as never, gateway as never);
    await expect(controller.remove({ user: { id: 'sender-1' } }, 'conversation-1', 'message-delete', 'everyone')).resolves.toBe(message);
    expect(gateway.notifyMessageDeleted).toHaveBeenCalledWith(['sender-1', 'recipient-1'], 'conversation-1', message);
    await expect(controller.remove({ user: { id: 'sender-1' } }, 'conversation-1', 'message-delete', 'all'))
      .rejects.toMatchObject({ status: 400 });
  });

  it('notifies only the requesting user for delete-for-me', async () => {
    const message = { id: 'message-delete', senderId: 'sender-1' };
    const direct = { deleteMessage: jest.fn().mockResolvedValue(message) };
    const gateway = { notifyMessageDeleted: jest.fn() };
    const controller = new DirectMessagesController(direct as never, gateway as never);
    await controller.remove({ user: { id: 'recipient-1' } }, 'conversation-1', 'message-delete', 'me');
    expect(gateway.notifyMessageDeleted).toHaveBeenCalledWith(['recipient-1'], 'conversation-1', message);
  });
});
