import { Column, CreateDateColumn, Entity, Index, PrimaryGeneratedColumn, UpdateDateColumn } from 'typeorm';

export type PaymentProvider = 'google_play' | 'click' | 'payme';
export type PaymentStatus = 'pending' | 'paid' | 'failed' | 'cancelled' | 'refunded';

@Entity('subscription_payments')
@Index('IDX_subscription_payments_user_status', ['userId', 'status', 'createdAt'])
@Index('UQ_subscription_payments_provider_transaction', ['provider', 'providerTransactionId'], { unique: true })
export class SubscriptionPayment {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid' })
  userId: string;

  @Column({ type: 'varchar', length: 40 })
  planKey: string;

  @Column({ type: 'varchar', length: 20 })
  provider: PaymentProvider;

  @Column({ type: 'integer' })
  amount: number;

  @Column({ type: 'varchar', length: 3, default: 'UZS' })
  currency: string;

  @Column({ type: 'varchar', length: 30, default: 'pending' })
  status: PaymentStatus;

  @Column({ type: 'varchar', length: 255, nullable: true })
  providerTransactionId: string | null;

  @Column({ type: 'varchar', length: 255, nullable: true })
  providerOrderId: string | null;

  @Column({ type: 'timestamptz', nullable: true })
  paidAt: Date | null;

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt: Date;

  @UpdateDateColumn({ type: 'timestamptz' })
  updatedAt: Date;
}
