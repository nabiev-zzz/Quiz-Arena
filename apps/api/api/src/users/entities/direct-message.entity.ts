import { Column, CreateDateColumn, Entity, Index, JoinColumn, ManyToOne, PrimaryGeneratedColumn } from 'typeorm';
import { User } from './user.entity';
import { DirectConversation } from './direct-conversation.entity';

@Entity('direct_messages')
@Index('IDX_direct_messages_conversation_created', ['conversationId', 'createdAt'])
@Index('IDX_direct_messages_recipient_unread', ['conversationId', 'recipientId', 'readAt'])
export class DirectMessage {
  @PrimaryGeneratedColumn('uuid') id: string;
  @Column({ type: 'uuid' }) conversationId: string;
  @Column({ type: 'uuid' }) senderId: string;
  @Column({ type: 'uuid' }) recipientId: string;
  @ManyToOne(() => DirectConversation, (conversation) => conversation.messages, { onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'conversationId' }) conversation: DirectConversation;
  @ManyToOne(() => User, { onDelete: 'RESTRICT' }) @JoinColumn({ name: 'senderId' }) sender: User;
  @ManyToOne(() => User, { onDelete: 'RESTRICT' }) @JoinColumn({ name: 'recipientId' }) recipient: User;
  @Column({ type: 'varchar', length: 4000 }) content: string;
  @Column({ type: 'timestamptz', nullable: true }) readAt: Date | null;
  @CreateDateColumn({ type: 'timestamptz' }) createdAt: Date;
}
