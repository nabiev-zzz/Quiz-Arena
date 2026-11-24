import { CreateDateColumn, Entity, Index, PrimaryGeneratedColumn } from 'typeorm';
import { Column } from 'typeorm';

@Entity('user_follows')
@Index('UQ_user_follows_pair', ['followerId', 'followedId'], { unique: true })
@Index('IDX_user_follows_follower', ['followerId'])
@Index('IDX_user_follows_followed', ['followedId'])
export class UserFollow {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid' })
  followerId: string;

  @Column({ type: 'uuid' })
  followedId: string;

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt: Date;
}
