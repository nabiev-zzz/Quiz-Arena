import { CreateDateColumn, Entity, Index, JoinColumn, ManyToOne, PrimaryGeneratedColumn, Column } from 'typeorm';
import { User } from './user.entity';
import { CommunityStory } from './community-story.entity';

@Entity('community_story_views')
@Index('UQ_community_story_views_pair', ['storyId', 'viewerId'], { unique: true })
@Index('IDX_community_story_views_story', ['storyId'])
export class CommunityStoryView {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid' })
  storyId: string;

  @ManyToOne(() => CommunityStory, { onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'storyId' })
  story: CommunityStory;

  @Column({ type: 'uuid' })
  viewerId: string;

  @ManyToOne(() => User, { onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'viewerId' })
  viewer: User;

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt: Date;
}
