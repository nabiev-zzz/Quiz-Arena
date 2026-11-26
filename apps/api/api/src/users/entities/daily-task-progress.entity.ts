import { Column, CreateDateColumn, Entity, Index, PrimaryGeneratedColumn, UpdateDateColumn } from 'typeorm';

@Entity('daily_task_progress')
@Index('UQ_daily_task_user_day_task', ['userId', 'taskDate', 'taskId'], { unique: true })
@Index('IDX_daily_task_user_day', ['userId', 'taskDate'])
export class DailyTaskProgress {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid' })
  userId: string;

  @Column({ type: 'date' })
  taskDate: string;

  @Column({ type: 'varchar', length: 50 })
  taskId: string;

  @Column({ type: 'integer', default: 0 })
  progress: number;

  @Column({ type: 'timestamptz', nullable: true })
  claimedAt: Date | null;

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt: Date;

  @UpdateDateColumn({ type: 'timestamptz' })
  updatedAt: Date;
}
