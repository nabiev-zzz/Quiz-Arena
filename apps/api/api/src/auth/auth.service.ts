import {
  BadRequestException,
  ConflictException,
  Injectable,
  ServiceUnavailableException,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { JwtService } from '@nestjs/jwt';
import { Repository } from 'typeorm';
import * as bcrypt from 'bcryptjs';
import { createHash, randomBytes, randomInt } from 'node:crypto';

import { User } from '../users/entities/user.entity';
import { RegisterDto } from './dto/register.dto';
import { LoginDto } from './dto/login.dto';
import { PhoneRegisterDto, PasswordResetDto } from './dto/phone-otp.dto';
import { AuthOtpService } from './auth-otp.service';
import { AuthOAuthCode } from './entities/auth-oauth-code.entity';

export interface UpdateProfileInput {
  displayName?: string;
  username?: string;
  bio?: string | null;
  avatarDecoration?: string | null;
  profileFrame?: string | null;
}

@Injectable()
export class AuthService {
  constructor(
    @InjectRepository(User)
    private readonly userRepository: Repository<User>,
    private readonly jwtService: JwtService,
    private readonly otpService: AuthOtpService,
    private readonly config: ConfigService,
    @InjectRepository(AuthOAuthCode)
    private readonly oauthCodeRepository: Repository<AuthOAuthCode>,
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
      phoneNumber: user.phoneNumber,
      phoneVerified: Boolean(user.phoneVerifiedAt),
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
    const user = await this.userRepository.findOne({ where: { id: userId } });
    if (!user || user.status !== 'active') {
      throw new UnauthorizedException('Foydalanuvchi topilmadi');
    }
    return this.getSafeUser(user);
  }

  async updateProfile(userId: string, input: UpdateProfileInput) {
    const user = await this.userRepository.findOne({ where: { id: userId } });
    if (!user || user.status !== 'active') {
      throw new UnauthorizedException('Foydalanuvchi topilmadi');
    }

    if (input.displayName !== undefined) {
      const displayName = input.displayName.trim();
      if (displayName.length < 2) {
        throw new BadRequestException('Ism kamida 2 ta belgidan iborat bo‘lsin');
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
      const existing = await this.userRepository.findOne({ where: { username } });
      if (existing && existing.id !== userId) {
        throw new ConflictException('Bu username allaqachon band');
      }
      user.username = username;
    }

    if (input.bio !== undefined) user.bio = input.bio?.trim() || null;
    if (input.avatarDecoration !== undefined) user.avatarDecoration = input.avatarDecoration;
    if (input.profileFrame !== undefined) user.profileFrame = input.profileFrame;

    try {
      const savedUser = await this.userRepository.save(user);
      return this.getSafeUser(savedUser);
    } catch (error) {
      if (typeof error === 'object' && error !== null && 'code' in error && error.code === '23505') {
        throw new ConflictException('Bu username allaqachon band');
      }
      throw error;
    }
  }

  private async createToken(user: User) {
    return this.jwtService.signAsync({ sub: user.id, username: user.username });
  }

  async register(dto: RegisterDto) {
    const displayName = dto.displayName.trim();
    const username = dto.username.trim().toLowerCase();
    const email = dto.email?.trim().toLowerCase() || null;

    if (displayName.length < 2) {
      throw new BadRequestException('Ism kamida 2 ta belgidan iborat bo‘lsin');
    }
    if (!/^[a-zA-Z0-9_]{3,30}$/.test(username)) {
      throw new BadRequestException('Username formati noto‘g‘ri');
    }
    if (await this.userRepository.findOne({ where: { username } })) {
      throw new ConflictException('Bu username allaqachon band');
    }
    if (email && await this.userRepository.findOne({ where: { email } })) {
      throw new ConflictException('Bu email allaqachon ro‘yxatdan o‘tgan');
    }

    const passwordHash = await bcrypt.hash(dto.password, 12);
    const user = this.userRepository.create({
      displayName, username, email, passwordHash, role: 'user', status: 'active',
    });

    try {
      const savedUser = await this.userRepository.save(user);
      return { accessToken: await this.createToken(savedUser), user: this.getSafeUser(savedUser) };
    } catch (error) {
      if (typeof error === 'object' && error !== null && 'code' in error && error.code === '23505') {
        throw new ConflictException('Username yoki email allaqachon band');
      }
      throw error;
    }
  }

  async requestRegistrationOtp(phoneNumber: string) {
    const phone = this.otpService.normalizePhone(phoneNumber);
    const existing = await this.userRepository.findOne({ where: { phoneNumber: phone } });
    if (existing) throw new ConflictException('Bu telefon raqami allaqachon ro‘yxatdan o‘tgan');
    await this.otpService.issue(phone, 'register');
    return { message: 'Tasdiqlash kodi telefon raqamingizga yuborildi' };
  }

  async registerWithPhone(dto: PhoneRegisterDto) {
    const phone = this.otpService.normalizePhone(dto.phoneNumber);
    const displayName = dto.displayName.trim();
    const username = dto.username.trim().toLowerCase();
    const email = dto.email?.trim().toLowerCase() || null;

    if (displayName.length < 2) throw new BadRequestException('Ism kamida 2 ta belgidan iborat bo‘lsin');
    if (!/^[a-zA-Z0-9_]{3,30}$/.test(username)) throw new BadRequestException('Username formati noto‘g‘ri');
    if (await this.userRepository.findOne({ where: { username } })) throw new ConflictException('Bu username allaqachon band');
    if (email && await this.userRepository.findOne({ where: { email } })) throw new ConflictException('Bu email allaqachon ro‘yxatdan o‘tgan');
    if (await this.userRepository.findOne({ where: { phoneNumber: phone } })) throw new ConflictException('Bu telefon raqami allaqachon ro‘yxatdan o‘tgan');

    // Consume the OTP only after the submitted profile fields have passed validation.
    await this.otpService.verify(phone, 'register', dto.code);
    const user = this.userRepository.create({
      displayName, username, email, phoneNumber: phone, phoneVerifiedAt: new Date(),
      passwordHash: await bcrypt.hash(dto.password, 12), role: 'user', status: 'active',
    });
    const savedUser = await this.userRepository.save(user);
    return { accessToken: await this.createToken(savedUser), user: this.getSafeUser(savedUser) };
  }

  async requestPasswordReset(phoneNumber: string) {
    const phone = this.otpService.normalizePhone(phoneNumber);
    const user = await this.userRepository
      .createQueryBuilder('user')
      .where('user.phoneNumber = :phone', { phone })
      .andWhere('user.phoneVerifiedAt IS NOT NULL')
      .getOne();
    // Keep the response identical whether the account exists or not.
    if (user) await this.otpService.issue(phone, 'password_reset');
    return { message: 'Agar raqam QUIZ ARENA hisobiga bog‘langan bo‘lsa, kod yuboriladi' };
  }


  async resetPassword(dto: PasswordResetDto) {
    const phone = await this.otpService.verify(dto.phoneNumber, 'password_reset', dto.code);
    const user = await this.userRepository.findOne({ where: { phoneNumber: phone } });
    if (!user || !user.phoneVerifiedAt || user.status !== 'active') {
      throw new UnauthorizedException('Kod noto‘g‘ri yoki muddati tugagan');
    }
    user.passwordHash = await bcrypt.hash(dto.newPassword, 12);
    await this.userRepository.save(user);
    return { message: 'Parol muvaffaqiyatli yangilandi. Endi yangi parol bilan kiring.' };
  }

  async requestPhoneLink(userId: string, phoneNumber: string) {
    const phone = this.otpService.normalizePhone(phoneNumber);
    const existing = await this.userRepository.findOne({ where: { phoneNumber: phone } });
    if (existing && existing.id !== userId) {
      throw new ConflictException('Bu telefon raqami boshqa hisobga bog‘langan');
    }
    await this.otpService.issue(phone, 'phone_link');
    return { message: 'Tasdiqlash kodi telefon raqamingizga yuborildi' };
  }

  async linkPhone(userId: string, phoneNumber: string, code: string) {
    const phone = await this.otpService.verify(phoneNumber, 'phone_link', code);
    const user = await this.userRepository.findOne({ where: { id: userId } });
    if (!user || user.status !== 'active') {
      throw new UnauthorizedException('Foydalanuvchi topilmadi');
    }
    const existing = await this.userRepository.findOne({ where: { phoneNumber: phone } });
    if (existing && existing.id !== userId) {
      throw new ConflictException('Bu telefon raqami boshqa hisobga bog‘langan');
    }
    user.phoneNumber = phone;
    user.phoneVerifiedAt = new Date();
    const savedUser = await this.userRepository.save(user);
    return this.getSafeUser(savedUser);
  }

  async requestPhoneLogin(phoneNumber: string) {
    const phone = this.otpService.normalizePhone(phoneNumber);
    const user = await this.userRepository.findOne({ where: { phoneNumber: phone } });
    if (user?.phoneVerifiedAt && user.status === 'active') {
      await this.otpService.issue(phone, 'phone_login');
    }
    return { message: 'Agar tasdiqlangan telefon raqami hisobga bog‘langan bo‘lsa, kod yuboriladi' };
  }

  async loginWithPhone(phoneNumber: string, code: string) {
    const phone = await this.otpService.verify(phoneNumber, 'phone_login', code);
    const user = await this.userRepository.findOne({ where: { phoneNumber: phone } });
    if (!user || !user.phoneVerifiedAt || user.status !== 'active') {
      throw new UnauthorizedException('Kod noto‘g‘ri yoki muddati tugagan');
    }
    return { accessToken: await this.createToken(user), user: this.getSafeUser(user) };
  }


  private getGoogleRedirectUri(): string {
    const redirectUri = this.config.get<string>('GOOGLE_REDIRECT_URI');
    if (!redirectUri) {
      throw new ServiceUnavailableException('Google OAuth callback manzili sozlanmagan');
    }
    return redirectUri;
  }

  async getGoogleAuthorizationUrl(): Promise<string> {
    const clientId = this.config.get<string>('GOOGLE_CLIENT_ID');
    if (!clientId) throw new ServiceUnavailableException('Google orqali kirish hali sozlanmagan');
    const nonce = randomBytes(18).toString('hex');
    const state = await this.jwtService.signAsync(
      { purpose: 'google_oauth', nonce },
      { expiresIn: 600 },
    );
    const url = new URL('https://accounts.google.com/o/oauth2/v2/auth');
    url.searchParams.set('client_id', clientId);
    url.searchParams.set('redirect_uri', this.getGoogleRedirectUri());
    url.searchParams.set('response_type', 'code');
    url.searchParams.set('scope', 'openid email profile');
    url.searchParams.set('state', state);
    url.searchParams.set('nonce', nonce);
    url.searchParams.set('prompt', 'select_account');
    return url.toString();
  }

  async handleGoogleCallback(code: string, state: string): Promise<string> {
    let statePayload: { purpose?: string; nonce?: string };
    try {
      statePayload = await this.jwtService.verifyAsync(state);
    } catch {
      throw new UnauthorizedException('Google kirish so‘rovi muddati tugagan yoki noto‘g‘ri');
    }
    if (statePayload.purpose !== 'google_oauth' || !statePayload.nonce) {
      throw new UnauthorizedException('Google kirish so‘rovi noto‘g‘ri');
    }

    const clientId = this.config.get<string>('GOOGLE_CLIENT_ID');
    const clientSecret = this.config.get<string>('GOOGLE_CLIENT_SECRET');
    if (!clientId || !clientSecret) {
      throw new ServiceUnavailableException('Google OAuth hali to‘liq sozlanmagan');
    }

    const body = new URLSearchParams({
      code,
      client_id: clientId,
      client_secret: clientSecret,
      redirect_uri: this.getGoogleRedirectUri(),
      grant_type: 'authorization_code',
    });
    const tokenResponse = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body,
      signal: AbortSignal.timeout(10_000),
    });
    const tokenPayload = await tokenResponse.json().catch(() => null) as
      | { id_token?: string }
      | null;
    if (!tokenResponse.ok || !tokenPayload?.id_token) {
      throw new UnauthorizedException('Google hisobini tasdiqlash amalga oshmadi');
    }

    const result = await this.loginWithGoogle(tokenPayload.id_token, statePayload.nonce);
    const rawCode = randomBytes(32).toString('base64url');
    const codeHash = createHash('sha256').update(rawCode).digest('hex');
    await this.oauthCodeRepository.save(this.oauthCodeRepository.create({
      userId: result.user.id,
      codeHash,
      expiresAt: new Date(Date.now() + 90_000),
      consumedAt: null,
    }));
    return `quizarena://auth?code=${encodeURIComponent(rawCode)}`;
  }

  async exchangeGoogleCode(rawCode: string) {
    if (!/^[A-Za-z0-9_-]{40,60}$/.test(rawCode)) {
      throw new UnauthorizedException('Google kirish kodi noto‘g‘ri yoki muddati tugagan');
    }
    const codeHash = createHash('sha256').update(rawCode).digest('hex');
    const challenge = await this.oauthCodeRepository
      .createQueryBuilder('oauth')
      .addSelect('oauth.codeHash')
      .where('oauth.codeHash = :codeHash', { codeHash })
      .andWhere('oauth.consumedAt IS NULL')
      .andWhere('oauth.expiresAt > :now', { now: new Date() })
      .getOne();
    if (!challenge) throw new UnauthorizedException('Google kirish kodi noto‘g‘ri yoki muddati tugagan');

    const consumed = await this.oauthCodeRepository
      .createQueryBuilder()
      .update(AuthOAuthCode)
      .set({ consumedAt: new Date() })
      .where('id = :id', { id: challenge.id })
      .andWhere('"consumedAt" IS NULL')
      .andWhere('"expiresAt" > :now', { now: new Date() })
      .execute();
    if (consumed.affected !== 1) {
      throw new UnauthorizedException('Google kirish kodi noto‘g‘ri yoki muddati tugagan');
    }
    const user = await this.userRepository.findOne({ where: { id: challenge.userId } });
    if (!user || user.status !== 'active') throw new UnauthorizedException('Hisob topilmadi yoki bloklangan');
    return { accessToken: await this.createToken(user), user: this.getSafeUser(user) };
  }

  async loginWithGoogle(idToken: string, expectedNonce?: string) {
    const clientId = this.config.get<string>('GOOGLE_CLIENT_ID');
    if (!clientId) throw new ServiceUnavailableException('Google orqali kirish hali sozlanmagan');

    const response = await fetch(
      `https://oauth2.googleapis.com/tokeninfo?id_token=${encodeURIComponent(idToken)}`,
      { signal: AbortSignal.timeout(10_000) },
    );
    const claims = await response.json().catch(() => null) as
      | { aud?: string; iss?: string; sub?: string; email?: string; email_verified?: string; name?: string; nonce?: string }
      | null;

    if (
      !response.ok || !claims?.sub || claims.aud !== clientId ||
      !['accounts.google.com', 'https://accounts.google.com'].includes(claims.iss ?? '') ||
      claims.email_verified !== 'true' || !claims.email ||
      (expectedNonce !== undefined && claims.nonce !== expectedNonce)
    ) {
      throw new UnauthorizedException('Google hisobini tasdiqlash amalga oshmadi');
    }

    const email = claims.email.trim().toLowerCase();
    let user = await this.userRepository.findOne({ where: { googleSubject: claims.sub } });

    if (!user) {
      user = await this.userRepository.findOne({ where: { email } });
      if (user) {
        if (user.googleSubject && user.googleSubject !== claims.sub) {
          throw new ConflictException('Bu email boshqa Google hisobiga bog‘langan');
        }
        user.googleSubject = claims.sub;
      } else {
        const base = (email.split('@')[0] || 'player').toLowerCase().replace(/[^a-z0-9_]/g, '_').slice(0, 20) || 'player';
        let username = base;
        while (await this.userRepository.findOne({ where: { username } })) {
          username = `${base.slice(0, 18)}_${randomInt(10, 99)}`;
        }
        user = this.userRepository.create({
          displayName: (claims.name || base).slice(0, 100),
          username,
          email,
          googleSubject: claims.sub,
          passwordHash: await bcrypt.hash(randomBytes(32).toString('hex'), 12),
          role: 'user',
          status: 'active',
        });
      }
      user = await this.userRepository.save(user);
    }

    if (user.status !== 'active') throw new UnauthorizedException('Hisobingiz bloklangan');
    return { accessToken: await this.createToken(user), user: this.getSafeUser(user) };
  }

  async login(dto: LoginDto) {
    const username = dto.username.trim().toLowerCase();
    const user = await this.userRepository
      .createQueryBuilder('user')
      .addSelect('user.passwordHash')
      .where('user.username = :username', { username })
      .getOne();

    if (!user) throw new UnauthorizedException('Username yoki parol noto‘g‘ri');
    const passwordMatches = await bcrypt.compare(dto.password, user.passwordHash);
    if (!passwordMatches) throw new UnauthorizedException('Username yoki parol noto‘g‘ri');
    if (user.status !== 'active') throw new UnauthorizedException('Hisobingiz bloklangan');

    return { accessToken: await this.createToken(user), user: this.getSafeUser(user) };
  }
}
