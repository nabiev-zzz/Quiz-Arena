import { Column, CreateDateColumn, Entity, Index, PrimaryGeneratedColumn } from 'typeorm';

@Entity('zc_store_items')
@Index('UQ_zc_store_user_item', ['userId', 'itemId'], { unique: true })
export class ZcStoreItem {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid' })
  userId: string;

  @Column({ type: 'varchar', length: 60 })
  itemId: string;

  @Column({ type: 'varchar', length: 20 })
  kind: 'frame' | 'decoration';

  @Column({ type: 'integer' })
  price: number;

  @CreateDateColumn({ type: 'timestamptz' })
  purchasedAt: Date;
}
