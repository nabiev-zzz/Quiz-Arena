import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { User } from './entities/user.entity';
import { CommunityPost } from './entities/community-post.entity';
import { CommunityPostLike } from './entities/community-post-like.entity';
import { CommunityPostComment } from './entities/community-post-comment.entity';

@Injectable()
export class CommunityService {
  constructor(
    @InjectRepository(User) private readonly users: Repository<User>,
    @InjectRepository(CommunityPost) private readonly posts: Repository<CommunityPost>,
    @InjectRepository(CommunityPostLike) private readonly likes: Repository<CommunityPostLike>,
    @InjectRepository(CommunityPostComment) private readonly comments: Repository<CommunityPostComment>,
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

  async feed(viewerId: string, limit = 30) {
    const posts = await this.posts.find({
      where: { status: 'active' },
      relations: { author: true },
      order: { createdAt: 'DESC' },
      take: Math.min(Math.max(limit, 1), 50),
    });
    return Promise.all(posts.filter((post) => post.author?.status === 'active').map(async (post) => {
      const [likesCount, commentsCount, liked] = await Promise.all([
        this.likes.count({ where: { postId: post.id } }),
        this.comments.count({ where: { postId: post.id } }),
        this.likes.exists({ where: { postId: post.id, userId: viewerId } }),
      ]);
      return {
        id: post.id,
        content: post.content,
        createdAt: post.createdAt,
        author: this.safePerson(post.author),
        likesCount,
        commentsCount,
        isLiked: liked,
        isOwn: post.authorId === viewerId,
      };
    }));
  }

  async createPost(authorId: string, rawContent: string) {
    const content = typeof rawContent === 'string' ? rawContent.trim() : '';
    if (!content) throw new BadRequestException('Post matnini kiriting');
    if (content.length > 2000) throw new BadRequestException('Post 2000 belgidan oshmasin');
    const author = await this.users.findOne({ where: { id: authorId, status: 'active' } });
    if (!author) throw new NotFoundException('Foydalanuvchi topilmadi');
    const post = await this.posts.save(this.posts.create({ authorId, content }));
    return {
      id: post.id,
      content: post.content,
      createdAt: post.createdAt,
      author: this.safePerson(author),
      likesCount: 0,
      commentsCount: 0,
      isLiked: false,
      isOwn: true,
    };
  }

  async toggleLike(userId: string, postId: string, liked: boolean) {
    const post = await this.posts.findOne({ where: { id: postId, status: 'active' } });
    if (!post) throw new NotFoundException('Post topilmadi');
    if (liked) {
      await this.likes.createQueryBuilder()
        .insert()
        .values({ postId, userId })
        .orIgnore()
        .execute();
    } else {
      await this.likes.delete({ postId, userId });
    }
    return {
      isLiked: liked,
      likesCount: await this.likes.count({ where: { postId } }),
    };
  }

  async listComments(postId: string) {
    const postExists = await this.posts.exists({ where: { id: postId, status: 'active' } });
    if (!postExists) throw new NotFoundException('Post topilmadi');
    const comments = await this.comments.find({
      where: { postId },
      relations: { author: true },
      order: { createdAt: 'ASC' },
      take: 100,
    });
    return comments.filter((item) => item.author?.status === 'active').map((item) => ({
      id: item.id,
      content: item.content,
      createdAt: item.createdAt,
      author: this.safePerson(item.author),
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
    return {
      id: comment.id,
      content: comment.content,
      createdAt: comment.createdAt,
      author: this.safePerson(author),
    };
  }
}
