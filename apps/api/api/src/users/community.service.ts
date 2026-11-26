import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { User } from './entities/user.entity';
import { CommunityPost } from './entities/community-post.entity';
import { CommunityPostLike } from './entities/community-post-like.entity';
import { CommunityPostComment } from './entities/community-post-comment.entity';
import { CommunityStory } from './entities/community-story.entity';
import { CommunityStoryView } from './entities/community-story-view.entity';
import { CommunityStorageService } from './community-storage.service';

@Injectable()
export class CommunityService {
  constructor(
    @InjectRepository(User) private readonly users: Repository<User>,
    @InjectRepository(CommunityPost) private readonly posts: Repository<CommunityPost>,
    @InjectRepository(CommunityPostLike) private readonly likes: Repository<CommunityPostLike>,
    @InjectRepository(CommunityPostComment) private readonly comments: Repository<CommunityPostComment>,
    @InjectRepository(CommunityStory) private readonly stories: Repository<CommunityStory>,
    @InjectRepository(CommunityStoryView) private readonly storyViews: Repository<CommunityStoryView>,
    private readonly storage: CommunityStorageService,
  ) {}

  private safePerson(user: User) {
    return {
      id: user.id,
      displayName: user.displayName,
      username: user.username,
      avatarUrl: user.avatarUrl,
      profileFrame: user.profileFrame,
      profileBadge: user.profileBadge,
    };
  }

  createUploadFileName(contentType: string) {
    const extensions: Record<string, string> = { 'image/jpeg': 'jpg', 'image/png': 'png', 'image/webp': 'webp', 'video/mp4': 'mp4', 'video/quicktime': 'mov', 'video/webm': 'webm' };
    const extension = extensions[contentType];
    if (!extension) throw new BadRequestException('JPG, PNG, WEBP rasmlari yoki MP4, MOV, WEBM videolar qabul qilinadi');
    return { fileName: this.storage.createKey('upload', extension).split('/').pop(), mediaType: contentType };
  }

  uploadMedia(userId: string, fileName: string, contentType: string, buffer: Buffer) {
    return this.storage.upload(userId, fileName, contentType, buffer);
  }

  private async mediaUrl(mediaKey?: string | null) {
    return mediaKey ? this.storage.sign('GET', mediaKey, 86400) : null;
  }

  async feed(viewerId: string, limit = 30) {
    const posts = await this.posts.find({
      where: { status: 'active' },
      relations: { author: true },
      order: { createdAt: 'DESC' },
      take: Math.min(Math.max(limit, 1), 50),
    });
    return Promise.all(posts.filter((post) => post.author?.status === 'active').map(async (post) => {
      const [likesCount, commentsCount, liked, mediaUrl] = await Promise.all([
        this.likes.count({ where: { postId: post.id } }),
        this.comments.count({ where: { postId: post.id } }),
        this.likes.exists({ where: { postId: post.id, userId: viewerId } }),
        this.mediaUrl(post.mediaKey),
      ]);
      return {
        id: post.id,
        content: post.content,
        createdAt: post.createdAt,
        mediaUrl,
        mediaType: post.mediaType,
        author: this.safePerson(post.author),
        likesCount,
        commentsCount,
        isLiked: liked,
        isOwn: post.authorId === viewerId,
      };
    }));
  }

  async createPost(authorId: string, rawContent: string, mediaKey?: string, mediaType?: string) {
    const content = typeof rawContent === 'string' ? rawContent.trim() : '';
    if (!content && !mediaKey) throw new BadRequestException('Matn yoki media qo‘shing');
    if (content.length > 2000) throw new BadRequestException('Post 2000 belgidan oshmasin');
    if (mediaKey && (!mediaKey.startsWith(`community/${authorId}/`) || !['image/jpeg', 'image/png', 'image/webp', 'video/mp4', 'video/quicktime', 'video/webm'].includes(mediaType || ''))) {
      throw new BadRequestException('Media fayl noto‘g‘ri');
    }
    const author = await this.users.findOne({ where: { id: authorId, status: 'active' } });
    if (!author) throw new NotFoundException('Foydalanuvchi topilmadi');
    const post = await this.posts.save(this.posts.create({
      authorId, content, mediaKey: mediaKey || null, mediaType: mediaKey ? mediaType : null,
    }));
    return {
      id: post.id, content: post.content, createdAt: post.createdAt,
      mediaUrl: await this.mediaUrl(post.mediaKey), mediaType: post.mediaType,
      author: this.safePerson(author), likesCount: 0, commentsCount: 0, isLiked: false, isOwn: true,
    };
  }

  async clips(viewerId: string, limit = 30) {
    const posts = await this.posts.createQueryBuilder('post')
      .leftJoinAndSelect('post.author', 'author')
      .where('post.status = :status', { status: 'active' })
      .andWhere('author.status = :authorStatus', { authorStatus: 'active' })
      .andWhere('post.mediaType LIKE :videoType', { videoType: 'video/%' })
      .orderBy('post.createdAt', 'DESC')
      .take(Math.min(Math.max(limit, 1), 50))
      .getMany();
    return Promise.all(posts.map(async (post) => {
      const [likesCount, commentsCount, liked, mediaUrl] = await Promise.all([
        this.likes.count({ where: { postId: post.id } }),
        this.comments.count({ where: { postId: post.id } }),
        this.likes.exists({ where: { postId: post.id, userId: viewerId } }),
        this.mediaUrl(post.mediaKey),
      ]);
      return {
        id: post.id, content: post.content, createdAt: post.createdAt, mediaUrl, mediaType: post.mediaType,
        author: this.safePerson(post.author), likesCount, commentsCount, isLiked: liked, isOwn: post.authorId === viewerId,
      };
    }));
  }

  async createClip(authorId: string, rawContent: string, mediaKey: string, mediaType: string) {
    if (!mediaKey?.startsWith(`community/${authorId}/`) || !['video/mp4', 'video/quicktime', 'video/webm'].includes(mediaType)) {
      throw new BadRequestException('Faqat MP4, MOV yoki WEBM videolar qabul qilinadi');
    }
    const content = typeof rawContent === 'string' ? rawContent.trim() : '';
    if (content.length > 2000) throw new BadRequestException('Video izohi 2000 belgidan oshmasin');
    const author = await this.users.findOne({ where: { id: authorId, status: 'active' } });
    if (!author) throw new NotFoundException('Foydalanuvchi topilmadi');
    const post = await this.posts.save(this.posts.create({ authorId, content, mediaKey, mediaType }));
    return {
      id: post.id, content, createdAt: post.createdAt, mediaUrl: await this.mediaUrl(mediaKey), mediaType,
      author: this.safePerson(author), likesCount: 0, commentsCount: 0, isLiked: false, isOwn: true,
    };
  }

  async createStory(authorId: string, mediaKey: string, mediaType: string, rawCaption?: string) {
    const caption = typeof rawCaption === 'string' ? rawCaption.trim() : '';
    if (!mediaKey?.startsWith(`community/${authorId}/`) || !['image/jpeg', 'image/png', 'image/webp'].includes(mediaType)) {
      throw new BadRequestException('Story rasmi noto‘g‘ri');
    }
    if (caption.length > 300) throw new BadRequestException('Story matni 300 belgidan oshmasin');
    const author = await this.users.findOne({ where: { id: authorId, status: 'active' } });
    if (!author) throw new NotFoundException('Foydalanuvchi topilmadi');
    const createdAt = new Date();
    const story = await this.stories.save(this.stories.create({
      authorId, mediaKey, mediaType, caption,
      expiresAt: new Date(createdAt.getTime() + 24 * 60 * 60 * 1000),
    }));
    return {
      id: story.id, mediaUrl: await this.mediaUrl(story.mediaKey), mediaType,
      caption, createdAt, expiresAt: story.expiresAt, author: this.safePerson(author),
      isOwn: true, viewed: true, viewsCount: 0,
    };
  }

  async listStories(viewerId: string) {
    const stories = await this.stories.find({
      where: { expiresAt: require('typeorm').MoreThan(new Date()) },
      relations: { author: true },
      order: { createdAt: 'ASC' },
      take: 100,
    });
    return Promise.all(stories.filter((story) => story.author?.status === 'active').map(async (story) => {
      const [viewed, viewsCount, mediaUrl] = await Promise.all([
        this.storyViews.exists({ where: { storyId: story.id, viewerId } }),
        this.storyViews.count({ where: { storyId: story.id } }),
        this.mediaUrl(story.mediaKey),
      ]);
      return {
        id: story.id, mediaUrl, mediaType: story.mediaType, caption: story.caption,
        createdAt: story.createdAt, expiresAt: story.expiresAt,
        author: this.safePerson(story.author), isOwn: story.authorId === viewerId,
        viewed: story.authorId === viewerId || viewed, viewsCount,
      };
    }));
  }

  async markStoryViewed(viewerId: string, storyId: string) {
    const story = await this.stories.findOne({
      where: { id: storyId, expiresAt: require('typeorm').MoreThan(new Date()) },
    });
    if (!story) throw new NotFoundException('Story topilmadi yoki muddati tugagan');
    if (story.authorId !== viewerId) {
      await this.storyViews.createQueryBuilder().insert()
        .values({ storyId, viewerId }).orIgnore().execute();
    }
    return { viewed: true, viewsCount: await this.storyViews.count({ where: { storyId } }) };
  }

  async toggleLike(userId: string, postId: string, liked: boolean) {
    const post = await this.posts.findOne({ where: { id: postId, status: 'active' } });
    if (!post) throw new NotFoundException('Post topilmadi');
    if (liked) {
      await this.likes.createQueryBuilder().insert().values({ postId, userId }).orIgnore().execute();
    } else {
      await this.likes.delete({ postId, userId });
    }
    return { isLiked: liked, likesCount: await this.likes.count({ where: { postId } }) };
  }

  async listComments(postId: string) {
    const postExists = await this.posts.exists({ where: { id: postId, status: 'active' } });
    if (!postExists) throw new NotFoundException('Post topilmadi');
    const comments = await this.comments.find({
      where: { postId }, relations: { author: true }, order: { createdAt: 'ASC' }, take: 100,
    });
    return comments.filter((item) => item.author?.status === 'active').map((item) => ({
      id: item.id, content: item.content, createdAt: item.createdAt, author: this.safePerson(item.author),
    }));
  }

  async addComment(authorId: string, postId: string, rawContent: string) {
    const content = typeof rawContent === 'string' ? rawContent.trim() : '';
    if (!content) throw new BadRequestException('Izoh matnini kiriting');
    if (content.length > 1000) throw new BadRequestException('Izoh 1000 belgidan oshmasin');
    const post = await this.posts.findOne({ where: { id: postId, status: 'active' } });
    if (!post) throw new NotFoundException('Post topilmadi');
    const author = await this.users.findOne({ where: { id: authorId, status: 'active' } });
    if (!author) throw new NotFoundException('Foydalanuvchi topilmadi');
    const comment = await this.comments.save(this.comments.create({ postId, authorId, content }));
    return { id: comment.id, content: comment.content, createdAt: comment.createdAt, author: this.safePerson(author) };
  }
}
