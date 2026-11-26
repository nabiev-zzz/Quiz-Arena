import { Column, CreateDateColumn, Entity, Index, JoinColumn, ManyToOne, PrimaryGeneratedColumn } from 'typeorm';
import { User } from './user.entity';

@Entity('community_posts')
@Index('IDX_community_posts_created', ['createdAt'])
@Index('IDX_community_posts_author_created', ['authorId', 'createdAt'])
export class CommunityPost {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid' })
  authorId: string;

  @ManyToOne(() => User, { onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'authorId' })
  author: User;

  @Column({ type: 'varchar', length: 2000 })
  content: string;

  @Column({ type: 'varchar', length: 20, default: 'active' })
  status: 'active' | 'hidden';

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt: Date;
}
