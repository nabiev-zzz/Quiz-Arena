import { Injectable, NotFoundException, BadRequestException, ConflictException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { User } from './entities/user.entity';
import { UserFollow } from './entities/user-follow.entity';

@Injectable()
export class UsersService {
  constructor(
    @InjectRepository(User) private readonly users: Repository<User>,
    @InjectRepository(UserFollow) private readonly follows: Repository<UserFollow>,
  ) {}

  private safeUser(user: User) {
    return {
      id: user.id,
      displayName: user.displayName,
      username: user.username,
      avatarUrl: user.avatarUrl,
      bio: user.bio,
      xp: user.xp,
      level: user.level,
      rankPoints: user.rankPoints,
      rankTier: this.rankTier(user.rankPoints),
      profileFrame: user.profileFrame,
      avatarDecoration: user.avatarDecoration,
      createdAt: user.createdAt,
    };
  }

  private rankTier(points: number) {
    if (points >= 1400) return 'Grandmaster';
    if (points >= 1100) return 'Master';
    if (points >= 800) return 'Diamond';
    if (points >= 600) return 'Platinum';
    if (points >= 400) return 'Gold';
    if (points >= 200) return 'Silver';
    return 'Bronze';
  }

  async suggestions(viewerId: string, limit = 12) {
    const following = await this.follows.find({ where: { followerId: viewerId } });
    const excluded = [viewerId, ...following.map((item) => item.followedId)];
    const result = await this.users.createQueryBuilder('user')
      .addSelect(
        (query) => query
          .select('COUNT(*)')
          .from(UserFollow, 'follow')
          .where('follow.followedId = user.id'),
        'followersCount',
      )
      .where('user.status = :status', { status: 'active' })
      .andWhere('user.id NOT IN (:...excluded)', { excluded })
      .orderBy('user.createdAt', 'DESC')
      .take(Math.min(Math.max(limit, 1), 30))
      .getRawAndEntities();

    return result.entities.map((user, index) => ({
      ...this.safeUser(user),
      followersCount: Number(result.raw[index]?.followersCount ?? 0),
      isFollowing: false,
    }));
  }

  async publicProfile(username: string, viewerId?: string) {
    const user = await this.users.findOne({ where: { username: username.toLowerCase(), status: 'active' } });
    if (!user) throw new NotFoundException('Foydalanuvchi topilmadi');

    const [followersCount, followingCount, isFollowing, isFriend] = await Promise.all([
      this.follows.count({ where: { followedId: user.id } }),
      this.follows.count({ where: { followerId: user.id } }),
      viewerId ? this.follows.exists({ where: { followerId: viewerId, followedId: user.id } }) : false,
      viewerId && viewerId !== user.id
        ? this.follows.exists({ where: { followerId: user.id, followedId: viewerId } })
          .then(async (followsViewer) => followsViewer && this.follows.exists({ where: { followerId: viewerId, followedId: user.id } }))
        : false,
    ]);

    return {
      ...this.safeUser(user),
      followersCount,
      followingCount,
      isFollowing,
      isFriend,
      isSelf: viewerId === user.id,
    };
  }

  async follow(viewerId: string, targetId: string) {
    if (viewerId === targetId) throw new BadRequestException('O‘zingizni kuzata olmaysiz');
    const target = await this.users.findOne({ where: { id: targetId, status: 'active' } });
    if (!target) throw new NotFoundException('Foydalanuvchi topilmadi');
    const existing = await this.follows.findOne({ where: { followerId: viewerId, followedId: targetId } });
    if (existing) throw new ConflictException('Siz bu foydalanuvchini allaqachon kuzatyapsiz');
    await this.follows.save(this.follows.create({ followerId: viewerId, followedId: targetId }));
    return { following: true, followersCount: await this.follows.count({ where: { followedId: targetId } }) };
  }

  async unfollow(viewerId: string, targetId: string) {
    await this.follows.delete({ followerId: viewerId, followedId: targetId });
    return { following: false, followersCount: await this.follows.count({ where: { followedId: targetId } }) };
  }

  async followers(userId: string) {
    const users = await this.users.createQueryBuilder('user')
      .innerJoin(UserFollow, 'follow', 'follow.followerId = user.id')
      .where('follow.followedId = :userId', { userId })
      .andWhere('user.status = :status', { status: 'active' })
      .orderBy('follow.createdAt', 'DESC')
      .take(100)
      .getMany();

    return users.map((user) => this.safeUser(user));
  }

  async following(userId: string) {
    const users = await this.users.createQueryBuilder('user')
      .innerJoin(UserFollow, 'follow', 'follow.followedId = user.id')
      .where('follow.followerId = :userId', { userId })
      .andWhere('user.status = :status', { status: 'active' })
      .orderBy('follow.createdAt', 'DESC')
      .take(100)
      .getMany();

    return users.map((user) => this.safeUser(user));
  }
}
