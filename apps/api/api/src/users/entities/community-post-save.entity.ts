import { CreateDateColumn, Entity, Index, PrimaryGeneratedColumn, Column, ManyToOne, JoinColumn } from 'typeorm';
import { CommunityPost } from './community-post.entity';
import { User } from './user.entity';

@Entity('community_post_saves')
@Index('UQ_community_post_saves_pair', ['postId', 'userId'], { unique: true })
@Index('IDX_community_post_saves_post', ['postId'])
export class CommunityPostSave {
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
