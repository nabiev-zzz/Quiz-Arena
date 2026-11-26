import { Column, CreateDateColumn, Entity, Index, JoinColumn, ManyToOne, PrimaryGeneratedColumn } from 'typeorm';
import { User } from './user.entity';

@Entity('community_stories')
@Index('IDX_community_stories_expires', ['expiresAt'])
@Index('IDX_community_stories_author_created', ['authorId', 'createdAt'])
export class CommunityStory {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid' })
  authorId: string;

  @ManyToOne(() => User, { onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'authorId' })
  author: User;

  @Column({ type: 'varchar', length: 500 })
  mediaKey: string;

  @Column({ type: 'varchar', length: 100, default: 'image/jpeg' })
  mediaType: string;

  @Column({ type: 'varchar', length: 300, default: '' })
  caption: string;

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt: Date;

  @Column({ type: 'timestamptz' })
  expiresAt: Date;
}
