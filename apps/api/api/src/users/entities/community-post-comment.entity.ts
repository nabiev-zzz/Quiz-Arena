import { Column, CreateDateColumn, Entity, Index, JoinColumn, ManyToOne, PrimaryGeneratedColumn } from 'typeorm';
import { User } from './user.entity';
import { CommunityPost } from './community-post.entity';

@Entity('community_post_comments')
@Index('IDX_community_post_comments_post_created', ['postId', 'createdAt'])
export class CommunityPostComment {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid' })
  postId: string;

  @ManyToOne(() => CommunityPost, { onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'postId' })
  post: CommunityPost;

  @Column({ type: 'uuid' })
  authorId: string;

  @ManyToOne(() => User, { onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'authorId' })
  author: User;

  @Column({ type: 'varchar', length: 1000 })
  content: string;

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt: Date;
}
