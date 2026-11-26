import { Column, CreateDateColumn, Entity, Index, JoinColumn, ManyToOne, OneToMany, PrimaryGeneratedColumn, UpdateDateColumn } from 'typeorm';
import { User } from './user.entity';
import { DirectMessage } from './direct-message.entity';

@Entity('direct_conversations')
@Index('UQ_direct_conversations_pair', ['participantOneId', 'participantTwoId'], { unique: true })
@Index('IDX_direct_conversations_one_last', ['participantOneId', 'lastMessageAt'])
@Index('IDX_direct_conversations_two_last', ['participantTwoId', 'lastMessageAt'])
export class DirectConversation {
  @PrimaryGeneratedColumn('uuid') id: string;
  @Column({ type: 'uuid' }) participantOneId: string;
  @Column({ type: 'uuid' }) participantTwoId: string;
  @ManyToOne(() => User, { onDelete: 'RESTRICT' }) @JoinColumn({ name: 'participantOneId' }) participantOne: User;
  @ManyToOne(() => User, { onDelete: 'RESTRICT' }) @JoinColumn({ name: 'participantTwoId' }) participantTwo: User;
  @OneToMany(() => DirectMessage, (message) => message.conversation) messages: DirectMessage[];
  @Column({ type: 'timestamptz', default: () => 'now()' }) lastMessageAt: Date;
  @CreateDateColumn({ type: 'timestamptz' }) createdAt: Date;
  @UpdateDateColumn({ type: 'timestamptz' }) updatedAt: Date;
}
