import { Column, CreateDateColumn, Entity, Index, PrimaryGeneratedColumn } from 'typeorm';

@Entity('user_notifications')
@Index('IDX_user_notifications_user_created', ['userId', 'createdAt'])
export class UserNotification {
  @PrimaryGeneratedColumn('uuid') id: string;
  @Column({ type: 'uuid' }) userId: string;
  @Column({ type: 'varchar', length: 30 }) type: string;
  @Column({ type: 'varchar', length: 120 }) title: string;
  @Column({ type: 'text' }) body: string;
  @Column({ type: 'boolean', default: false }) isRead: boolean;
  @CreateDateColumn({ type: 'timestamptz' }) createdAt: Date;
}
