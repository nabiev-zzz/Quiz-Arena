import { Column, CreateDateColumn, Entity, Index, PrimaryGeneratedColumn } from 'typeorm';

export type ZcTransactionType = 'credit' | 'debit';

@Entity('zc_transactions')
@Index('IDX_zc_transactions_user_created', ['userId', 'createdAt'])
@Index('UQ_zc_transactions_idempotency', ['idempotencyKey'], { unique: true, where: '"idempotencyKey" IS NOT NULL' })
export class ZcTransaction {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid' })
  userId: string;

  @Column({ type: 'varchar', length: 10 })
  type: ZcTransactionType;

  @Column({ type: 'integer' })
  amount: number;

  @Column({ type: 'integer' })
  balanceAfter: number;

  @Column({ type: 'varchar', length: 80 })
  reason: string;

  @Column({ type: 'varchar', length: 120, nullable: true })
  idempotencyKey: string | null;

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt: Date;
}
