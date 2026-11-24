import { Column, CreateDateColumn, Entity, Index, PrimaryGeneratedColumn, UpdateDateColumn } from 'typeorm';

export type SubscriptionProvider = 'google_play' | 'click' | 'payme';
export type SubscriptionStatus = 'pending' | 'active' | 'expired' | 'cancelled' | 'refunded';

@Entity('user_subscriptions')
@Index('IDX_user_subscriptions_user_status', ['userId', 'status'])
@Index('UQ_user_subscriptions_provider_reference', ['provider', 'providerReference'], { unique: true })
export class UserSubscription {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid' })
  userId: string;

  @Column({ type: 'varchar', length: 40 })
  planKey: string;

  @Column({ type: 'varchar', length: 20 })
  provider: SubscriptionProvider;

  @Column({ type: 'varchar', length: 30, default: 'pending' })
  status: SubscriptionStatus;

  @Column({ type: 'varchar', length: 255, nullable: true })
  providerReference: string | null;

  @Column({ type: 'timestamptz', nullable: true })
  startsAt: Date | null;

  @Column({ type: 'timestamptz', nullable: true })
  expiresAt: Date | null;

  @Column({ type: 'boolean', default: false })
  autoRenew: boolean;

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt: Date;

  @UpdateDateColumn({ type: 'timestamptz' })
  updatedAt: Date;
}
