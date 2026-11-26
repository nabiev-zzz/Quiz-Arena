import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { IsNull, Not, Repository } from 'typeorm';
import { User } from './entities/user.entity';
import { DirectConversation } from './entities/direct-conversation.entity';
import { DirectMessage } from './entities/direct-message.entity';

@Injectable()
export class DirectMessagesService {
  constructor(
    @InjectRepository(User) private readonly users: Repository<User>,
    @InjectRepository(DirectConversation) private readonly conversations: Repository<DirectConversation>,
    @InjectRepository(DirectMessage) private readonly messages: Repository<DirectMessage>,
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
      this.messages.findOne({ where: { conversationId: conversation.id }, order: { createdAt: 'DESC' } }),
      this.messages.count({ where: { conversationId: conversation.id, recipientId: userId, readAt: IsNull() } }),
    ]);
    return { id: conversation.id, otherUser: this.person(other), lastMessage: last ? { content: last.content, senderId: last.senderId, createdAt: last.createdAt } : null, lastMessageAt: conversation.lastMessageAt, unreadCount };
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
      .where('message.conversationId = :conversationId', { conversationId });
    if (before) {
      const date = new Date(before);
      if (!Number.isNaN(date.getTime())) query.andWhere('message.createdAt < :before', { before: date });
    }
    const rows = await query.orderBy('message.createdAt', 'DESC').take(60).getMany();
    return rows.reverse().map((message) => ({
      id: message.id, conversationId, content: message.content, createdAt: message.createdAt,
      readAt: message.readAt, senderId: message.senderId, isMine: message.senderId === userId,
      sender: message.sender ? this.person(message.sender) : null,
    }));
  }

  async sendMessage(userId: string, conversationId: string, rawContent: string) {
    const content = typeof rawContent === 'string' ? rawContent.trim() : '';
    if (!content) throw new BadRequestException('Xabar matnini kiriting');
    if (content.length > 4000) throw new BadRequestException('Xabar 4000 belgidan oshmasin');
    const conversation = await this.assertParticipant(userId, conversationId);
    const recipientId = conversation.participantOneId === userId ? conversation.participantTwoId : conversation.participantOneId;
    const recipient = await this.users.findOne({ where: { id: recipientId, status: 'active' } });
    const sender = await this.users.findOne({ where: { id: userId, status: 'active' } });
    if (!recipient || !sender) throw new NotFoundException('Suhbatdosh topilmadi');
    const saved = await this.messages.save(this.messages.create({ conversationId, senderId: userId, recipientId, content }));
    conversation.lastMessageAt = saved.createdAt;
    await this.conversations.save(conversation);
    return {
      recipientId,
      message: { id: saved.id, conversationId, content, createdAt: saved.createdAt, readAt: null, senderId: userId, isMine: true, sender: this.person(sender) },
    };
  }

  async markRead(userId: string, conversationId: string) {
    const conversation = await this.assertParticipant(userId, conversationId);
    const recipientId = conversation.participantOneId === userId ? conversation.participantTwoId : conversation.participantOneId;
    const result = await this.messages.update({ conversationId, recipientId: userId, senderId: Not(userId), readAt: IsNull() }, { readAt: new Date() });
    return { updated: result.affected ?? 0, otherUserId: recipientId };
  }
}
