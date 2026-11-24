import { Column, CreateDateColumn, Entity, Index, PrimaryGeneratedColumn } from 'typeorm';

@Entity('learning_web_sessions')
@Index('IDX_learning_web_sessions_user_expiry', ['userId', 'expiresAt'])
export class LearningWebSession {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid' })
  userId: string;

  @Column({ type: 'varchar', length: 80 })
  subjectId: string;

  @Column({ type: 'varchar', length: 100 })
  topicId: string;

  @Column({ type: 'varchar', length: 5 })
  language: string;

  @Column({ type: 'varchar', length: 20 })
  difficulty: string;

  @Column({ type: 'jsonb' })
  questionIds: string[];

  @Column({ type: 'timestamptz' })
  expiresAt: Date;

  @Column({ type: 'timestamptz', nullable: true })
  submittedAt: Date | null;

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt: Date;
}
