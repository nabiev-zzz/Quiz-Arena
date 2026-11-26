import { Injectable } from '@nestjs/common';
import { OnGatewayConnection, OnGatewayDisconnect, WebSocketGateway, WebSocketServer } from '@nestjs/websockets';
import { JwtService } from '@nestjs/jwt';
import { InjectRepository } from '@nestjs/typeorm';
import { Namespace, Socket } from 'socket.io';
import { Repository } from 'typeorm';
import { User } from './entities/user.entity';

@WebSocketGateway({ namespace: '/direct', cors: { origin: true, credentials: true } })
@Injectable()
export class DirectMessagesGateway implements OnGatewayConnection, OnGatewayDisconnect {
  @WebSocketServer() server: Namespace;
  constructor(private readonly jwt: JwtService, @InjectRepository(User) private readonly users: Repository<User>) {}

  async handleConnection(client: Socket) {
    try {
      const authToken = client.handshake.auth?.token;
      const header = client.handshake.headers.authorization;
      const token = (typeof authToken === 'string' ? authToken : typeof header === 'string' ? header : '').replace(/^Bearer\s+/i, '').trim();
      if (!token) throw new Error('Token topilmadi');
      const payload = await this.jwt.verifyAsync<{ sub: string }>(token);
      const user = await this.users.findOne({ where: { id: payload.sub, status: 'active' }, select: { id: true, username: true } });
      if (!user) throw new Error('Foydalanuvchi faol emas');
      client.data.userId = user.id;
      await client.join(`user:${user.id}`);
      client.emit('direct:connected', { connected: true });
    } catch {
      client.emit('direct:error', { message: 'Chatga ulanish uchun qayta kiring' });
      client.disconnect(true);
    }
  }

  handleDisconnect(client: Socket) { void client.data.userId; }

  notifyMessage(senderId: string, recipientId: string, message: unknown) {
    if (!this.server) return;
    this.server.to(`user:${senderId}`).emit('direct:message', { ...(message as Record<string, unknown>), isMine: true });
    this.server.to(`user:${recipientId}`).emit('direct:message', { ...(message as Record<string, unknown>), isMine: false });
  }

  notifyRead(recipientId: string, conversationId: string) {
    if (this.server) this.server.to(`user:${recipientId}`).emit('direct:read', { conversationId });
  }
}
