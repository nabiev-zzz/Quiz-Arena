
import {
  BadRequestException,
  ConflictException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { JwtService } from '@nestjs/jwt';
import { Repository } from 'typeorm';
import * as bcrypt from 'bcryptjs';

import { User } from '../users/entities/user.entity';
import { RegisterDto } from './dto/register.dto';
import { LoginDto } from './dto/login.dto';

export interface UpdateProfileInput {
  displayName?: string;
  username?: string;
  bio?: string | null;
}

@Injectable()
export class AuthService {
  constructor(
    @InjectRepository(User)
    private readonly userRepository: Repository<User>,
    private readonly jwtService: JwtService,
  ) {}

  private getRankTier(points: number): string {
    if (points >= 1400) return 'Grandmaster';
    if (points >= 1100) return 'Master';
    if (points >= 800) return 'Diamond';
    if (points >= 600) return 'Platinum';
    if (points >= 400) return 'Gold';
    if (points >= 200) return 'Silver';
    return 'Bronze';
  }
  private getSafeUser(user: User) {
    return {
      id: user.id,
      displayName: user.displayName,
      username: user.username,
      email: user.email,
      role: user.role,
      status: user.status,
      xp: user.xp,
      rankPoints: user.rankPoints,
      rankTier: this.getRankTier(user.rankPoints),
      level: user.level,
      avatarUrl: user.avatarUrl,
      bio: user.bio,
      profileFrame: user.profileFrame,
      avatarDecoration: user.avatarDecoration,
      createdAt: user.createdAt,
    };
  }

  async getProfile(userId: string) {
    const user = await this.userRepository.findOne({
      where: { id: userId },
    });

    if (!user || user.status !== 'active') {
      throw new UnauthorizedException('Foydalanuvchi topilmadi');
    }

    return this.getSafeUser(user);
  }

  async updateProfile(userId: string, input: UpdateProfileInput) {
    const user = await this.userRepository.findOne({
      where: { id: userId },
    });

    if (!user || user.status !== 'active') {
      throw new UnauthorizedException('Foydalanuvchi topilmadi');
    }

    if (input.displayName !== undefined) {
      const displayName = input.displayName.trim();

      if (displayName.length < 2) {
        throw new BadRequestException(
          'Ism kamida 2 ta belgidan iborat bo‘lsin',
        );
      }

      user.displayName = displayName;
    }

    if (input.username !== undefined) {
      const username = input.username.trim().toLowerCase();

      if (!/^[a-zA-Z0-9_]{3,30}$/.test(username)) {
        throw new BadRequestException(
          'Username 3–30 ta belgi bo‘lsin. Faqat lotin harflari, raqamlar va _ ishlating.',
        );
      }

      const existing = await this.userRepository.findOne({
        where: { username },
      });

      if (existing && existing.id !== userId) {
        throw new ConflictException('Bu username allaqachon band');
      }

      user.username = username;
    }

    if (input.bio !== undefined) {
      user.bio = input.bio?.trim() || null;
    }

    try {
      const savedUser = await this.userRepository.save(user);
      return this.getSafeUser(savedUser);
    } catch (error) {
      if (
        typeof error === 'object' &&
        error !== null &&
        'code' in error &&
        error.code === '23505'
      ) {
        throw new ConflictException('Bu username allaqachon band');
      }

      throw error;
    }
  }

  private async createToken(user: User) {
    return this.jwtService.signAsync({
      sub: user.id,
      username: user.username,
    });
  }

  async register(dto: RegisterDto) {
    const displayName = dto.displayName.trim();
    const username = dto.username.trim().toLowerCase();
    const email = dto.email?.trim().toLowerCase() || null;

    if (displayName.length < 2) {
      throw new BadRequestException(
        'Ism kamida 2 ta belgidan iborat bo‘lsin',
      );
    }

    if (!/^[a-zA-Z0-9_]{3,30}$/.test(username)) {
      throw new BadRequestException('Username formati noto‘g‘ri');
    }

    const existingUsername = await this.userRepository.findOne({
      where: { username },
    });

    if (existingUsername) {
      throw new ConflictException('Bu username allaqachon band');
    }

    if (email) {
      const existingEmail = await this.userRepository.findOne({
        where: { email },
      });

      if (existingEmail) {
        throw new ConflictException(
          'Bu email allaqachon ro‘yxatdan o‘tgan',
        );
      }
    }

    const passwordHash = await bcrypt.hash(dto.password, 12);

    const user = this.userRepository.create({
      displayName,
      username,
      email,
      passwordHash,
      role: 'user',
      status: 'active',
    });

    try {
      const savedUser = await this.userRepository.save(user);

      return {
        accessToken: await this.createToken(savedUser),
        user: this.getSafeUser(savedUser),
      };
    } catch (error) {
      if (
        typeof error === 'object' &&
        error !== null &&
        'code' in error &&
        error.code === '23505'
      ) {
        throw new ConflictException(
          'Username yoki email allaqachon band',
        );
      }

      throw error;
    }
  }

  async login(dto: LoginDto) {
    const username = dto.username.trim().toLowerCase();

    const user = await this.userRepository
      .createQueryBuilder('user')
      .addSelect('user.passwordHash')
      .where('user.username = :username', { username })
      .getOne();

    if (!user) {
      throw new UnauthorizedException(
        'Username yoki parol noto‘g‘ri',
      );
    }

    const passwordMatches = await bcrypt.compare(
      dto.password,
      user.passwordHash,
    );

    if (!passwordMatches) {
      throw new UnauthorizedException(
        'Username yoki parol noto‘g‘ri',
      );
    }

    if (user.status !== 'active') {
      throw new UnauthorizedException('Hisobingiz bloklangan');
    }

    return {
      accessToken: await this.createToken(user),
      user: this.getSafeUser(user),
    };
  }
}
