import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { UserNotification } from './entities/user-notification.entity';

@Injectable()
export class NotificationsService {
  constructor(@InjectRepository(UserNotification) private readonly notifications: Repository<UserNotification>) {}
  async list(userId: string) {
    const [items, unread] = await Promise.all([
      this.notifications.find({ where: { userId }, order: { createdAt: 'DESC' }, take: 50 }),
      this.notifications.count({ where: { userId, isRead: false } }),
    ]);
    return { items, unread };
  }
  async markRead(userId: string, id: string) {
    await this.notifications.update({ id, userId }, { isRead: true });
    return this.list(userId);
  }
  async markAllRead(userId: string) {
    await this.notifications.update({ userId, isRead: false }, { isRead: true });
    return this.list(userId);
  }
}
