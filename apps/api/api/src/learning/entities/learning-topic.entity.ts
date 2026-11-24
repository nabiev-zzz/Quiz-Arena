import { Column, CreateDateColumn, Entity, Index, PrimaryColumn } from 'typeorm';

@Entity('learning_topics')
@Index('IDX_learning_topics_subject_active', ['subjectId', 'isActive'])
export class LearningTopic {
  @PrimaryColumn({ type: 'varchar', length: 80 })
  subjectId: string;

  @PrimaryColumn({ type: 'varchar', length: 100 })
  topicId: string;

  @Column({ type: 'varchar', length: 120 })
  subjectName: string;

  @Column({ type: 'varchar', length: 160 })
  topicName: string;

  @Column({ type: 'text' })
  description: string;

  @Column({ type: 'integer', default: 20 })
  questionCount: number;

  @Column({ type: 'varchar', length: 20, default: 'medium' })
  difficulty: string;

  @Column({ type: 'boolean', default: true })
  isActive: boolean;

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt: Date;
}
