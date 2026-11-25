import { Column, CreateDateColumn, Entity, Index, PrimaryGeneratedColumn, UpdateDateColumn } from 'typeorm';

export type AiGenerationJobType = 'topic_questions' | 'document_quiz' | 'smart_practice' | 'ai_tutor' | 'ai_generate';
export type AiGenerationJobStatus = 'queued' | 'active' | 'completed' | 'failed';

@Entity('ai_generation_jobs')
@Index('IDX_ai_generation_jobs_user_created', ['userId', 'createdAt'])
@Index('UQ_ai_generation_jobs_user_idempotency', ['userId', 'idempotencyKey'], { unique: true })
export class AiGenerationJob {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid', nullable: true })
  userId: string | null;

  @Column({ type: 'varchar', length: 40 })
  jobType: AiGenerationJobType;

  @Column({ type: 'varchar', length: 20, default: 'queued' })
  status: AiGenerationJobStatus;

  @Column({ type: 'jsonb' })
  payload: Record<string, unknown>;

  // Temporary durable storage for document uploads; cleared after terminal completion.
  @Column({ type: 'bytea', nullable: true, select: false })
  fileBuffer: Buffer | null;

  @Column({ type: 'jsonb', nullable: true })
  result: Record<string, unknown> | null;

  @Column({ type: 'text', nullable: true })
  error: string | null;

  @Column({ type: 'varchar', length: 40, nullable: true })
  quotaFeature: string | null;

  @Column({ type: 'boolean', default: false })
  quotaConsumed: boolean;

  @Column({ type: 'boolean', default: false })
  quotaRefunded: boolean;

  @Column({ type: 'varchar', length: 64, nullable: true })
  idempotencyKey: string | null;

  @Column({ type: 'integer', default: 50 })
  priority: number;

  @Column({ type: 'integer', default: 0 })
  attempts: number;

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt: Date;

  @UpdateDateColumn({ type: 'timestamptz' })
  updatedAt: Date;

  @Column({ type: 'timestamptz', nullable: true })
  completedAt: Date | null;
}
