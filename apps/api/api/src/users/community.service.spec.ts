import { jest } from '@jest/globals';
import { CommunityService } from './community.service';
import { CommunityPost } from './entities/community-post.entity';
import { CommunityPostLike } from './entities/community-post-like.entity';
import { CommunityPostComment } from './entities/community-post-comment.entity';
import { CommunityPostSave } from './entities/community-post-save.entity';
import { CommunityStory } from './entities/community-story.entity';
import { CommunityStoryView } from './entities/community-story-view.entity';
import { User } from './entities/user.entity';
import { CommunityStorageService } from './community-storage.service';
import { ZcWalletService } from './zc-wallet.service';
import { DataSource, Repository } from 'typeorm';

describe('CommunityService clip interactions', () => {
  const user = { id: 'user-1', status: 'active', displayName: 'Test User', username: 'tester', avatarUrl: null } as User;
  const post = { id: 'clip-1', status: 'active', mediaType: 'video/mp4', authorId: 'user-2' } as CommunityPost;
  const saveBuilder = { insert: jest.fn().mockReturnThis(), values: jest.fn().mockReturnThis(), orIgnore: jest.fn().mockReturnThis(), execute: jest.fn().mockResolvedValue(undefined) };
  const users = { findOne: jest.fn() };
  const posts = { findOne: jest.fn(), exists: jest.fn() };
  const likes = {};
  const comments = { findOne: jest.fn(), find: jest.fn(), create: jest.fn((value) => value), save: jest.fn() };
  const saves = { createQueryBuilder: jest.fn(() => saveBuilder), delete: jest.fn().mockResolvedValue(undefined), exists: jest.fn() };
  const stories = {};
  const storyViews = {};
  const storage = {};
  const dataSource = {};
  const wallet = {};
  let service: CommunityService;

  beforeEach(() => {
    jest.clearAllMocks();
    service = new CommunityService(
      users as unknown as Repository<User>,
      posts as unknown as Repository<CommunityPost>,
      likes as unknown as Repository<CommunityPostLike>,
      comments as unknown as Repository<CommunityPostComment>,
      saves as unknown as Repository<CommunityPostSave>,
      stories as Repository<CommunityStory>,
      storyViews as Repository<CommunityStoryView>,
      storage as CommunityStorageService,
      dataSource as DataSource,
      wallet as ZcWalletService,
    );
  });

  it('saves a video clip idempotently', async () => {
    posts.findOne.mockResolvedValue(post);
    await expect(service.saveClip('user-1', 'clip-1')).resolves.toEqual({ isSaved: true });
    expect(saveBuilder.insert).toHaveBeenCalledTimes(1);
    expect(saveBuilder.values).toHaveBeenCalledWith({ postId: 'clip-1', userId: 'user-1' });
    expect(saveBuilder.orIgnore).toHaveBeenCalledTimes(1);
  });

  it('removes a saved clip without deleting the clip itself', async () => {
    posts.findOne.mockResolvedValue(post);
    await expect(service.unsaveClip('user-1', 'clip-1')).resolves.toEqual({ isSaved: false });
    expect(saves.delete).toHaveBeenCalledWith({ postId: 'clip-1', userId: 'user-1' });
  });

  it('rejects saving a non-video post', async () => {
    posts.findOne.mockResolvedValue({ id: post.id, status: post.status, mediaType: 'image/jpeg', authorId: post.authorId } as CommunityPost);
    await expect(service.saveClip('user-1', 'clip-1')).rejects.toThrow('Lavha topilmadi');
    expect(saveBuilder.insert).not.toHaveBeenCalled();
  });

  it('creates a reply only under a top-level comment on the same post', async () => {
    posts.findOne.mockResolvedValue(post);
    comments.findOne.mockResolvedValue({ id: 'comment-1', postId: 'clip-1', parentId: null });
    users.findOne.mockResolvedValue(user);
    comments.save.mockImplementation(async (value) => ({ id: 'reply-1', createdAt: new Date('2026-11-27T00:00:00Z'), ...value }));
    const result = await service.addComment('user-1', 'clip-1', 'Good explanation', 'comment-1');
    expect(comments.findOne).toHaveBeenCalledWith({ where: { id: 'comment-1', postId: 'clip-1', parentId: expect.anything() } });
    expect(result).toMatchObject({ id: 'reply-1', parentId: 'comment-1', content: 'Good explanation' });
  });

  it('returns top-level comments with collapsed reply collections', async () => {
    posts.exists.mockResolvedValue(true);
    comments.find.mockResolvedValue([
      { id: 'root-1', postId: 'clip-1', parentId: null, content: 'Root', createdAt: new Date(), author: user },
      { id: 'reply-1', postId: 'clip-1', parentId: 'root-1', content: 'Reply', createdAt: new Date(), author: user },
    ]);
    const result = await service.listComments('clip-1');
    expect(result).toHaveLength(1);
    expect(result[0]).toMatchObject({ id: 'root-1', repliesCount: 1 });
    expect(result[0].replies[0]).toMatchObject({ id: 'reply-1', parentId: 'root-1' });
  });
});
