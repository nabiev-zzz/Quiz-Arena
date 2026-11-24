import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
} from 'typeorm';

@Entity('learning_attempts')
@Index('IDX_learning_attempts_user_completed', ['userId', 'completedAt'])
export class LearningAttempt {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid' })
  userId: string;

  @Column({ type: 'varchar', length: 80 })
  subjectId: string;

  @Column({ type: 'varchar', length: 120 })
  subjectName: string;

  @Column({ type: 'varchar', length: 100 })
  topicId: string;

  @Column({ type: 'varchar', length: 160 })
  topicName: string;

  @Column({ type: 'integer' })
  totalQuestions: number;

  @Column({ type: 'integer' })
  correctAnswers: number;

  @Column({ type: 'numeric', precision: 5, scale: 2 })
  accuracy: number;

  @CreateDateColumn({ type: 'timestamptz' })
  completedAt: Date;
}
