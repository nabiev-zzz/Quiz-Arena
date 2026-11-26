import { CreateDateColumn, Entity, Index, JoinColumn, ManyToOne, PrimaryGeneratedColumn } from 'typeorm';
import { Column } from 'typeorm';
import { User } from './user.entity';
import { CommunityPost } from './community-post.entity';

@Entity('community_post_likes')
@Index('UQ_community_post_likes_pair', ['postId', 'userId'], { unique: true })
@Index('IDX_community_post_likes_post', ['postId'])
export class CommunityPostLike {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid' })
  postId: string;

  @ManyToOne(() => CommunityPost, { onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'postId' })
  post: CommunityPost;

  @Column({ type: 'uuid' })
  userId: string;

  @ManyToOne(() => User, { onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'userId' })
  user: User;

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt: Date;
}
