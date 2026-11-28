import { BadRequestException, ConflictException, GoneException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { IsNull, Not, Repository } from 'typeorm';
import { User } from './entities/user.entity';
import { DirectConversation } from './entities/direct-conversation.entity';
import { DirectMessage } from './entities/direct-message.entity';
import { CommunityStorageService } from './community-storage.service';

@Injectable()
export class DirectMessagesService {
  constructor(
    @InjectRepository(User) private readonly users: Repository<User>,
    @InjectRepository(DirectConversation) private readonly conversations: Repository<DirectConversation>,
    @InjectRepository(DirectMessage) private readonly messages: Repository<DirectMessage>,
    private readonly storage: CommunityStorageService,
  ) {}

  private person(user: User) {
    return { id: user.id, displayName: user.displayName, username: user.username, avatarUrl: user.avatarUrl, profileFrame: user.profileFrame, profileBadge: user.profileBadge };
  }

  private async findConversation(userId: string, otherId: string) {
    return this.conversations.findOne({ where: [
      { participantOneId: userId, participantTwoId: otherId },
      { participantOneId: otherId, participantTwoId: userId },
    ] });
  }

  async startConversation(userId: string, otherId: string) {
    if (!otherId || userId === otherId) throw new BadRequestException('O‘zingiz bilan suhbat boshlay olmaysiz');
    const other = await this.users.findOne({ where: { id: otherId, status: 'active' } });
    if (!other) throw new NotFoundException('Foydalanuvchi topilmadi');
    const existing = await this.findConversation(userId, otherId);
    if (existing) return this.conversationDto(existing, userId);
    const [one, two] = [userId, otherId].sort();
    try {
      const created = await this.conversations.save(this.conversations.create({ participantOneId: one, participantTwoId: two }));
      return this.conversationDto(created, userId);
    } catch {
      const raced = await this.findConversation(userId, otherId);
      if (raced) return this.conversationDto(raced, userId);
      throw new ConflictException('Suhbat yaratilmadi. Qayta urinib ko‘ring');
    }
  }

  private async conversationDto(conversation: DirectConversation, userId: string) {
    const otherId = conversation.participantOneId === userId ? conversation.participantTwoId : conversation.participantOneId;
    const other = await this.users.findOne({ where: { id: otherId, status: 'active' } });
    if (!other) throw new NotFoundException('Suhbatdosh topilmadi');
    const [last, unreadCount] = await Promise.all([
      this.messages.findOne({ where: [
        { conversationId: conversation.id, senderId: userId, senderDeletedAt: IsNull() },
        { conversationId: conversation.id, recipientId: userId, recipientDeletedAt: IsNull() },
      ], order: { createdAt: 'DESC' } }),
      this.messages.count({ where: { conversationId: conversation.id, recipientId: userId, readAt: IsNull(), recipientDeletedAt: IsNull() } }),
    ]);
    return { id: conversation.id, otherUser: this.person(other), lastMessage: last ? { content: last.deletedForEveryone ? 'Xabar o‘chirildi' : last.mediaType?.startsWith('audio/') ? '🎤 Ovozli xabar' : last.mediaType?.startsWith('image/') ? '📷 Rasm' : last.mediaType ? '📎 Hujjat' : last.content, senderId: last.senderId, createdAt: last.createdAt, mediaType: last.deletedForEveryone ? null : last.mediaType, isDeleted: last.deletedForEveryone, editedAt: last.editedAt } : null, lastMessageAt: conversation.lastMessageAt, unreadCount };
  }

  async listConversations(userId: string) {
    const rows = await this.conversations.find({
      where: [{ participantOneId: userId }, { participantTwoId: userId }],
      order: { lastMessageAt: 'DESC' }, take: 100,
    });
    return Promise.all(rows.map((row) => this.conversationDto(row, userId)));
  }

  private async assertParticipant(userId: string, conversationId: string) {
    const conversation = await this.conversations.findOne({ where: [
      { id: conversationId, participantOneId: userId },
      { id: conversationId, participantTwoId: userId },
    ] });
    if (!conversation) throw new NotFoundException('Suhbat topilmadi');
    return conversation;
  }

  async listMessages(userId: string, conversationId: string, before?: string) {
    await this.assertParticipant(userId, conversationId);
    const query = this.messages.createQueryBuilder('message')
      .leftJoinAndSelect('message.sender', 'sender')
      .where('message.conversationId = :conversationId', { conversationId })
      .andWhere('((message.senderId = :userId AND message.senderDeletedAt IS NULL) OR (message.recipientId = :userId AND message.recipientDeletedAt IS NULL))', { userId });
    if (before) {
      const date = new Date(before);
      if (!Number.isNaN(date.getTime())) query.andWhere('message.createdAt < :before', { before: date });
    }
    const rows = await query.orderBy('message.createdAt', 'DESC').take(60).getMany();
    return Promise.all(rows.reverse().map(async (message) => ({
      id: message.id, conversationId, content: message.deletedForEveryone ? '' : message.content, createdAt: message.createdAt,
      readAt: message.readAt, senderId: message.senderId, isMine: message.senderId === userId,
      sender: message.sender ? this.person(message.sender) : null,
      mediaType: message.deletedForEveryone ? null : message.mediaType, durationSeconds: message.deletedForEveryone ? null : message.durationSeconds,
      isEdited: Boolean(message.editedAt), editedAt: message.editedAt, isDeleted: Boolean(message.deletedForEveryone), deletedAt: message.deletedAt,
    })));
  }

  async sendMessage(userId: string, conversationId: string, rawContent: string, attachment?: { mediaKey?: string; mediaType?: string; mediaSize?: number; durationSeconds?: number; clientMessageId?: string }) {
    const content = typeof rawContent === 'string' ? rawContent.trim() : '';
    const mediaKey = typeof attachment?.mediaKey === 'string' ? attachment.mediaKey : '';
    const mediaType = typeof attachment?.mediaType === 'string' ? attachment.mediaType : '';
    const hasMedia = Boolean(mediaKey || mediaType || attachment?.durationSeconds);
    const hasAudio = mediaType.startsWith('audio/');
    if (!content && !mediaKey) throw new BadRequestException('Xabar matnini yoki ovozli xabarni kiriting');
    if (content.length > 4000) throw new BadRequestException('Xabar 4000 belgidan oshmasin');
    const conversation = await this.assertParticipant(userId, conversationId);
    const clientMessageId = typeof attachment?.clientMessageId === 'string' ? attachment.clientMessageId.trim() : '';
    if (clientMessageId && !/^[A-Za-z0-9._:-]{8,128}$/.test(clientMessageId)) {
      throw new BadRequestException('Xabar identifikatori noto‘g‘ri');
    }
    if (clientMessageId) {
      const existing = await this.messages.findOne({ where: { senderId: userId, clientMessageId } });
      if (existing) {
        if (existing.conversationId !== conversationId) throw new ConflictException('Xabar identifikatori boshqa suhbatda ishlatilgan');
        if (existing.deletedForEveryone || existing.senderDeletedAt) throw new GoneException('Bu xabar avval o‘chirilgan');
        return { created: false, recipientId: existing.recipientId, message: this.messageDto(existing, userId) };
      }
    }
    let durationSeconds: number | null = null;
    if (hasMedia) {
      const allowedTypes = ['audio/mp4', 'audio/webm', 'image/jpeg', 'image/png', 'image/webp', 'application/pdf', 'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'];
      if (!mediaKey || !allowedTypes.includes(mediaType)) throw new BadRequestException('Biriktirilgan fayl formati qo‘llab-quvvatlanmaydi');
      const maxBytes = mediaType.startsWith('application/') ? 15 * 1024 * 1024 : 8 * 1024 * 1024;
      if (!Number.isSafeInteger(attachment?.mediaSize) || (attachment?.mediaSize ?? 0) <= 0 || (attachment?.mediaSize ?? 0) > maxBytes) {
        throw new BadRequestException(mediaType.startsWith('application/') ? 'Hujjat hajmi 15 MB dan oshmasin' : 'Media fayl hajmi 8 MB dan oshmasin');
      }
      if (hasAudio) {
        if (!Number.isInteger(attachment?.durationSeconds) || (attachment?.durationSeconds ?? 0) < 1 || (attachment?.durationSeconds ?? 0) > 120) {
          throw new BadRequestException('Ovozli xabar 1–120 soniya oralig‘ida bo‘lishi kerak');
        }
        durationSeconds = attachment!.durationSeconds!;
      } else if (attachment?.durationSeconds !== undefined) {
        throw new BadRequestException('Fayl davomiyligi noto‘g‘ri');
      }
      await this.storage.verify(userId, mediaKey, mediaType, attachment!.mediaSize!);
    }
    const recipientId = conversation.participantOneId === userId ? conversation.participantTwoId : conversation.participantOneId;
    const recipient = await this.users.findOne({ where: { id: recipientId, status: 'active' } });
    const sender = await this.users.findOne({ where: { id: userId, status: 'active' } });
    if (!recipient || !sender) throw new NotFoundException('Suhbatdosh topilmadi');
    let saved: DirectMessage;
    try {
      saved = await this.messages.save(this.messages.create({ conversationId, senderId: userId, recipientId, content, mediaKey: mediaKey || null, mediaType: mediaKey ? mediaType : null, durationSeconds, clientMessageId: clientMessageId || null }));
    } catch (error) {
      const databaseError = error as { code?: string; driverError?: { code?: string } };
      const databaseCode = databaseError?.driverError?.code ?? databaseError?.code;
      if (clientMessageId && databaseCode === '23505') {
        const existing = await this.messages.findOne({ where: { senderId: userId, clientMessageId } });
        if (existing?.conversationId === conversationId) {
          if (existing.deletedForEveryone || existing.senderDeletedAt) throw new GoneException('Bu xabar avval o‘chirilgan');
          return { created: false, recipientId: existing.recipientId, message: this.messageDto(existing, userId) };
        }
      }
      throw error;
    }
    conversation.lastMessageAt = saved.createdAt;
    await this.conversations.save(conversation);
    return {
      created: true, recipientId,
      message: { id: saved.id, conversationId, content, createdAt: saved.createdAt, readAt: null, senderId: userId, isMine: true, sender: this.person(sender), mediaType: saved.mediaType, durationSeconds: saved.durationSeconds },
    };
  }

  private messageDto(message: DirectMessage, userId: string) {
    return {
      id: message.id, conversationId: message.conversationId,
      content: message.deletedForEveryone ? '' : message.content,
      createdAt: message.createdAt, readAt: message.readAt,
      senderId: message.senderId, isMine: message.senderId === userId,
      sender: message.sender ? this.person(message.sender) : null,
      mediaType: message.deletedForEveryone ? null : message.mediaType,
      durationSeconds: message.deletedForEveryone ? null : message.durationSeconds,
      isEdited: Boolean(message.editedAt), editedAt: message.editedAt,
      isDeleted: Boolean(message.deletedForEveryone), deletedAt: message.deletedAt,
    };
  }

  async getConversationParticipants(userId: string, conversationId: string) {
    const conversation = await this.assertParticipant(userId, conversationId);
    return { otherUserId: conversation.participantOneId === userId ? conversation.participantTwoId : conversation.participantOneId };
  }

  async editMessage(userId: string, conversationId: string, messageId: string, rawContent: string) {
    const conversation = await this.assertParticipant(userId, conversationId);
    const otherUserId = conversation.participantOneId === userId ? conversation.participantTwoId : conversation.participantOneId;
    const content = typeof rawContent === 'string' ? rawContent.trim() : '';
    if (!content) throw new BadRequestException('Xabar matni bo‘sh bo‘lmasin');
    if (content.length > 4000) throw new BadRequestException('Xabar 4000 belgidan oshmasin');
    const message = await this.messages.findOne({ where: { id: messageId, conversationId, senderId: userId, recipientId: otherUserId, senderDeletedAt: IsNull() } });
    if (!message) throw new NotFoundException('Xabar topilmadi yoki sizga tegishli emas');
    if (message.deletedForEveryone) throw new ConflictException('O‘chirilgan xabarni tahrirlab bo‘lmaydi');
    if (message.mediaKey) throw new BadRequestException('Fayl biriktirilgan xabarni tahrirlab bo‘lmaydi');
    if (Date.now() - new Date(message.createdAt).getTime() > 15 * 60 * 1000) throw new ConflictException('Xabarni faqat 15 daqiqa ichida tahrirlash mumkin');
    if (content === message.content) return this.messageDto(message, userId);
    const now = new Date();
    const history = Array.isArray(message.history) ? message.history : [];
    message.history = [...history, { action: 'edited', content: message.content, at: now.toISOString(), actorId: userId }];
    message.content = content;
    message.editedAt = now;
    const saved = await this.messages.save(message);
    return this.messageDto(saved, userId);
  }

  async deleteMessage(userId: string, conversationId: string, messageId: string, scope: 'me' | 'everyone') {
    const conversation = await this.assertParticipant(userId, conversationId);
    const otherUserId = conversation.participantOneId === userId ? conversation.participantTwoId : conversation.participantOneId;
    const message = await this.messages.findOne({ where: { id: messageId, conversationId } });
    const validPair = message && ((message.senderId === userId && message.recipientId === otherUserId) || (message.senderId === otherUserId && message.recipientId === userId));
    if (!validPair || !message || (message.senderId === userId ? Boolean(message.senderDeletedAt) : Boolean(message.recipientDeletedAt))) throw new NotFoundException('Xabar topilmadi');
    const isSender = message.senderId === userId;
    const now = new Date();
    if (scope === 'everyone') {
      if (!isSender) throw new ConflictException('Xabarni hamma uchun faqat muallifi o‘chira oladi');
      if (message.deletedForEveryone) return this.messageDto(message, userId);
      if (now.getTime() - new Date(message.createdAt).getTime() > 60 * 60 * 1000) throw new ConflictException('Xabarni hamma uchun faqat 1 soat ichida o‘chirish mumkin');
      const history = Array.isArray(message.history) ? message.history : [];
      message.history = [...history, { action: 'deleted_for_everyone', content: message.content, at: now.toISOString(), actorId: userId }];
      message.content = '';
      message.mediaKey = null;
      message.mediaType = null;
      message.durationSeconds = null;
      message.deletedForEveryone = true;
      message.deletedAt = now;
      message.deletedBy = userId;
    } else {
      if (isSender ? message.senderDeletedAt : message.recipientDeletedAt) return this.messageDto(message, userId);
      const history = Array.isArray(message.history) ? message.history : [];
      message.history = [...history, { action: 'deleted_for_me', content: message.content, at: now.toISOString(), actorId: userId }];
      if (isSender) message.senderDeletedAt = now;
      else message.recipientDeletedAt = now;
    }
    const saved = await this.messages.save(message);
    return { ...this.messageDto(saved, userId), deletedForMe: scope === 'me' };
  }

  async getMessageHistory(userId: string, conversationId: string, messageId: string) {
    const conversation = await this.assertParticipant(userId, conversationId);
    const otherUserId = conversation.participantOneId === userId ? conversation.participantTwoId : conversation.participantOneId;
    const message = await this.messages.findOne({ where: { id: messageId, conversationId, senderId: userId, recipientId: otherUserId } });
    if (!message) throw new NotFoundException('Xabar tarixi topilmadi');
    return { messageId, entries: (Array.isArray(message.history) ? message.history : []).map((entry) => ({ action: entry.action, content: entry.content, at: entry.at })) };
  }

  async getAttachmentPlaybackUrl(userId: string, conversationId: string, messageId: string) {
    const conversation = await this.assertParticipant(userId, conversationId);
    const otherUserId = conversation.participantOneId === userId ? conversation.participantTwoId : conversation.participantOneId;
    const message = await this.messages.findOne({ where: { id: messageId, conversationId } });
    const validPair = message && ((message.senderId === userId && message.recipientId === otherUserId) || (message.senderId === otherUserId && message.recipientId === userId));
    const allowedTypes = ['audio/mp4', 'audio/webm', 'image/jpeg', 'image/png', 'image/webp', 'application/pdf', 'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'];
    if (!validPair || !message?.mediaKey || message.deletedForEveryone || (message.senderId === userId ? Boolean(message.senderDeletedAt) : Boolean(message.recipientDeletedAt)) || !message.mediaType || !allowedTypes.includes(message.mediaType)
      || !message.mediaKey.startsWith(`community/${message.senderId}/`)) {
      throw new NotFoundException('Biriktirilgan fayl topilmadi');
    }
    return { url: this.storage.sign('GET', message.mediaKey, 300), mediaType: message.mediaType };
  }

  async markRead(userId: string, conversationId: string) {
    const conversation = await this.assertParticipant(userId, conversationId);
    const recipientId = conversation.participantOneId === userId ? conversation.participantTwoId : conversation.participantOneId;
    const result = await this.messages.update({ conversationId, recipientId: userId, senderId: Not(userId), readAt: IsNull(), recipientDeletedAt: IsNull() }, { readAt: new Date() });
    return { updated: result.affected ?? 0, otherUserId: recipientId };
  }
}
