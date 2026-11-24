import { Column, CreateDateColumn, Entity, Index, PrimaryGeneratedColumn } from 'typeorm';

@Entity('learning_questions')
@Index('IDX_learning_questions_topic_bank', ['subjectId', 'topicId', 'language', 'difficulty', 'isActive'])
export class LearningQuestion {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'varchar', length: 80 })
  subjectId: string;

  @Column({ type: 'varchar', length: 100 })
  topicId: string;

  @Column({ type: 'varchar', length: 5 })
  language: string;

  @Column({ type: 'varchar', length: 20 })
  difficulty: string;

  @Column({ type: 'text' })
  question: string;

  @Column({ type: 'jsonb' })
  options: string[];

  @Column({ type: 'smallint' })
  correctAnswer: number;

  @Column({ type: 'text' })
  explanation: string;

  @Column({ type: 'boolean', default: true })
  isActive: boolean;

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt: Date;
}
