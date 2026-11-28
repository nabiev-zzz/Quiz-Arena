import { BadRequestException, ConflictException } from '@nestjs/common';
import { jest } from '@jest/globals';

jest.unstable_mockModule('./entities/user.entity', () => ({ User: class User {} }));
jest.unstable_mockModule('./entities/direct-conversation.entity', () => ({ DirectConversation: class DirectConversation {} }));
jest.unstable_mockModule('./entities/direct-message.entity', () => ({ DirectMessage: class DirectMessage {} }));

const { DirectMessagesService } = await import('./direct-messages.service');

const conversation = { id: 'conversation-1', participantOneId: 'user-1', participantTwoId: 'user-2', lastMessageAt: new Date() };
const sender = { id: 'user-1', displayName: 'Sender', username: 'sender', avatarUrl: null, profileFrame: null, profileBadge: null };
const recipient = { id: 'user-2', displayName: 'Recipient', username: 'recipient', avatarUrl: null, profileFrame: null, profileBadge: null };
const priorMessage = {
  id: 'message-existing', conversationId: 'conversation-1', senderId: 'user-1', recipientId: 'user-2',
  content: 'Hello', mediaType: null, durationSeconds: null, readAt: null, createdAt: new Date('2026-11-28T09:00:00Z'),
};

function setup() {
  const users = { findOne: jest.fn(async ({ where }: { where: { id: string } }) => where.id === 'user-1' ? sender : recipient) };
  const conversations = { findOne: jest.fn().mockResolvedValue(conversation), save: jest.fn(async (value) => value) };
  const messages = {
    findOne: jest.fn().mockResolvedValue(null),
    create: jest.fn((value) => value),
    save: jest.fn(async (value) => ({ ...value, id: 'message-new', createdAt: new Date() })),
  };
  const storage = { verify: jest.fn().mockResolvedValue({ verified: true }), sign: jest.fn() };
  const service = new DirectMessagesService(users as never, conversations as never, messages as never, storage as never);
  return { service, users, conversations, messages, storage };
}

describe('DirectMessagesService idempotency', () => {
  it('stores a client message key with a new message', async () => {
    const { service, messages, conversations } = setup();
    const result = await service.sendMessage('user-1', 'conversation-1', 'Hello', { clientMessageId: 'dm-test-key-123' });
    expect(result.created).toBe(true);
    expect(messages.create).toHaveBeenCalledWith(expect.objectContaining({ clientMessageId: 'dm-test-key-123' }));
    expect(messages.save).toHaveBeenCalledTimes(1);
    expect(conversations.save).toHaveBeenCalledTimes(1);
  });

  it('returns the existing message without saving again on retry', async () => {
    const { service, messages, conversations } = setup();
    messages.findOne.mockResolvedValueOnce(priorMessage as never);
    const result = await service.sendMessage('user-1', 'conversation-1', 'Hello', { clientMessageId: 'dm-test-key-123' });
    expect(result.created).toBe(false);
    expect(result.message.id).toBe('message-existing');
    expect(messages.save).not.toHaveBeenCalled();
    expect(conversations.save).not.toHaveBeenCalled();
  });

  it('recovers a concurrent duplicate insert using the unique database index', async () => {
    const { service, messages, conversations } = setup();
    const duplicateError = Object.assign(new Error('duplicate key'), { driverError: { code: '23505' } });
    messages.save.mockRejectedValueOnce(duplicateError as never);
    messages.findOne.mockResolvedValueOnce(null).mockResolvedValueOnce(priorMessage as never);
    const result = await service.sendMessage('user-1', 'conversation-1', 'Hello', { clientMessageId: 'dm-test-key-123' });
    expect(result.created).toBe(false);
    expect(result.message.id).toBe('message-existing');
    expect(conversations.save).not.toHaveBeenCalled();
  });

  it('rejects reusing the same key in another conversation', async () => {
    const { service, messages } = setup();
    messages.findOne.mockResolvedValueOnce(priorMessage as never);
    await expect(service.sendMessage('user-1', 'conversation-else', 'Hello', { clientMessageId: 'dm-test-key-123' }))
      .rejects.toBeInstanceOf(ConflictException);
    expect(messages.save).not.toHaveBeenCalled();
  });

  it('rejects malformed client message keys', async () => {
    const { service } = setup();
    await expect(service.sendMessage('user-1', 'conversation-1', 'Hello', { clientMessageId: 'bad' }))
      .rejects.toBeInstanceOf(BadRequestException);
  });
});

describe('DirectMessagesService moderation', () => {
  it('edits only the sender text and stores the previous version in history', async () => {
    const { service, messages } = setup();
    const original = { ...priorMessage, createdAt: new Date(), history: [], mediaKey: null, deletedForEveryone: false, editedAt: null };
    messages.findOne.mockResolvedValueOnce(original as never);
    messages.save.mockImplementationOnce(async (value) => value as never);
    const result = await service.editMessage('user-1', 'conversation-1', 'message-existing', 'Updated text');
    expect(result.content).toBe('Updated text');
    expect(result.isEdited).toBe(true);
    expect(messages.save).toHaveBeenCalledWith(expect.objectContaining({
      content: 'Updated text', history: [expect.objectContaining({ action: 'edited', content: 'Hello', actorId: 'user-1' })],
    }));
  });

  it('does not allow another participant to edit the message', async () => {
    const { service, messages } = setup();
    messages.findOne.mockResolvedValueOnce(null);
    await expect(service.editMessage('user-2', 'conversation-1', 'message-existing', 'Changed'))
      .rejects.toMatchObject({ status: 404 });
    expect(messages.save).not.toHaveBeenCalled();
  });

  it('rejects edits after the 15-minute window', async () => {
    const { service, messages } = setup();
    messages.findOne.mockResolvedValueOnce({ ...priorMessage, createdAt: new Date(Date.now() - 16 * 60 * 1000), history: [] } as never);
    await expect(service.editMessage('user-1', 'conversation-1', 'message-existing', 'Changed'))
      .rejects.toMatchObject({ status: 409 });
    expect(messages.save).not.toHaveBeenCalled();
  });

  it('soft-deletes for everyone while preserving the old text in author history', async () => {
    const { service, messages } = setup();
    const original = { ...priorMessage, createdAt: new Date(), history: [], mediaKey: null, mediaType: null, durationSeconds: null, deletedForEveryone: false };
    messages.findOne.mockResolvedValueOnce(original as never);
    messages.save.mockImplementationOnce(async (value) => value as never);
    const result = await service.deleteMessage('user-1', 'conversation-1', 'message-existing', 'everyone');
    expect(result.isDeleted).toBe(true);
    expect(result.content).toBe('');
    expect(messages.save).toHaveBeenCalledWith(expect.objectContaining({
      content: '', deletedForEveryone: true, deletedBy: 'user-1',
      history: [expect.objectContaining({ action: 'deleted_for_everyone', content: 'Hello' })],
    }));
  });

  it('does not allow a recipient to delete a message for everyone', async () => {
    const { service, messages } = setup();
    messages.findOne.mockResolvedValueOnce(priorMessage as never);
    await expect(service.deleteMessage('user-2', 'conversation-1', 'message-existing', 'everyone'))
      .rejects.toMatchObject({ status: 409 });
    expect(messages.save).not.toHaveBeenCalled();
  });

  it('hides a message only for the requesting recipient', async () => {
    const { service, messages } = setup();
    const original = { ...priorMessage, history: [], recipientDeletedAt: null, senderDeletedAt: null, deletedForEveryone: false };
    messages.findOne.mockResolvedValueOnce(original as never);
    messages.save.mockImplementationOnce(async (value) => value as never);
    const result = await service.deleteMessage('user-2', 'conversation-1', 'message-existing', 'me');
    expect(result.deletedForMe).toBe(true);
    expect(messages.save).toHaveBeenCalledWith(expect.objectContaining({ recipientDeletedAt: expect.any(Date), senderDeletedAt: null }));
  });

  it('allows a participant to hide an already globally deleted tombstone for themselves', async () => {
    const { service, messages } = setup();
    const tombstone = { ...priorMessage, content: '', deletedForEveryone: true, history: [], recipientDeletedAt: null, senderDeletedAt: null };
    messages.findOne.mockResolvedValueOnce(tombstone as never);
    messages.save.mockImplementationOnce(async (value) => value as never);
    const result = await service.deleteMessage('user-2', 'conversation-1', 'message-existing', 'me');
    expect(result.deletedForMe).toBe(true);
    expect(messages.save).toHaveBeenCalledWith(expect.objectContaining({ recipientDeletedAt: expect.any(Date) }));
  });

  it('only exposes message history to its author', async () => {
    const { service, messages } = setup();
    messages.findOne.mockResolvedValueOnce({ ...priorMessage, history: [{ action: 'edited', content: 'Original', at: '2026-11-28T09:00:00Z', actorId: 'user-1' }] } as never);
    await expect(service.getMessageHistory('user-1', 'conversation-1', 'message-existing'))
      .resolves.toMatchObject({ entries: [{ action: 'edited', content: 'Original' }] });
    messages.findOne.mockResolvedValueOnce(null);
    await expect(service.getMessageHistory('user-2', 'conversation-1', 'message-existing'))
      .rejects.toMatchObject({ status: 404 });
  });
});
