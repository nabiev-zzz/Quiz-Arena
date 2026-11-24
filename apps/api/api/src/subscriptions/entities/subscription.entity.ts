import { Column, CreateDateColumn, Entity, PrimaryGeneratedColumn, UpdateDateColumn } from 'typeorm';

export type SubscriptionProvider = 'google_play' | 'click' | 'payme';
export type SubscriptionStatus = 'pending' | 'active' | 'expired' | 'cancelled' | 'refunded';

@Entity('user_subscriptions')
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
