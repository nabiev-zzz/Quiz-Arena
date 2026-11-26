
import {
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
  Column,
} from 'typeorm';

import { User } from '../../users/entities/user.entity';

export type AiTutorMessageRole = 'user' | 'assistant';

@Entity('ai_tutor_messages')
@Index('IDX_ai_tutor_messages_user_created', ['userId', 'createdAt'])
export class AiTutorMessage {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({
    type: 'uuid',
  })
  userId: string;

  @ManyToOne(() => User, {
    onDelete: 'CASCADE',
  })
  @JoinColumn({
    name: 'userId',
  })
  user: User;

  @Column({
    type: 'varchar',
    length: 20,
  })
  role: AiTutorMessageRole;

  @Column({
    type: 'text',
  })
  content: string;

  @Column({ type: 'uuid', nullable: true })
  generationJobId: string | null;

  @CreateDateColumn({
    type: 'timestamptz',
  })
  createdAt: Date;
}
