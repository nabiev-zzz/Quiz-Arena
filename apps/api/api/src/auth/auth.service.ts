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
import { createHash, createHmac, createPublicKey, randomBytes, randomInt, timingSafeEqual, verify as verifySignature } from 'node:crypto';

import { User } from '../users/entities/user.entity';
import { ZcStoreItem } from '../users/entities/zc-store-item.entity';
import { RegisterDto } from './dto/register.dto';
import { LoginDto } from './dto/login.dto';
import { PhoneRegisterDto, PasswordResetDto } from './dto/phone-otp.dto';
import { AuthOtpService } from './auth-otp.service';
import { AuthOAuthCode } from './entities/auth-oauth-code.entity';
import { TelegramBotAuthSession } from './entities/telegram-bot-auth-session.entity';

export interface UpdateProfileInput {
  displayName?: string;
  username?: string;
  bio?: string | null;
  avatarUrl?: string | null;
  avatarDecoration?: string | null;
  profileFrame?: string | null;
  profileBadge?: string | null;
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
    @InjectRepository(ZcStoreItem)
    private readonly zcStoreItems: Repository<ZcStoreItem>,
    @InjectRepository(TelegramBotAuthSession)
    private readonly telegramSessions: Repository<TelegramBotAuthSession>,
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
      emailVerified: Boolean(user.emailVerifiedAt),
      phoneNumber: user.phoneNumber,
      phoneVerified: Boolean(user.phoneVerifiedAt),
      role: user.role,
      status: user.status,
      xp: user.xp,
      zcBalance: user.zcBalance ?? 0,
      rankPoints: user.rankPoints,
      rankTier: this.getRankTier(user.rankPoints),
      level: user.level,
      avatarUrl: user.avatarUrl,
      bio: user.bio,
      profileFrame: user.profileFrame,
      avatarDecoration: user.avatarDecoration,
      profileBadge: user.profileBadge,
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
    if (input.avatarUrl !== undefined) user.avatarUrl = input.avatarUrl;

    if (input.avatarDecoration !== undefined && input.avatarDecoration !== user.avatarDecoration) {
      if (input.avatarDecoration !== null) {
        const owned = await this.zcStoreItems.exists({ where: { userId, kind: 'decoration', itemId: `decoration_${input.avatarDecoration}` } });
        if (!owned) throw new BadRequestException('Bu avatar bezagi sizda yo‘q. Avval ZC do‘konidan xarid qiling.');
      }
      user.avatarDecoration = input.avatarDecoration;
    }
    if (input.profileFrame !== undefined && input.profileFrame !== user.profileFrame) {
      if (input.profileFrame !== null) {
        const itemId = input.profileFrame.endsWith('3d')
          ? `effect_${input.profileFrame}`
          : `frame_${input.profileFrame}`;
        const owned = await this.zcStoreItems.exists({ where: { userId, kind: 'frame', itemId } });
        if (!owned) throw new BadRequestException('Bu profil ramkasi sizda yo‘q. Avval ZC do‘konidan xarid qiling.');
      }
      user.profileFrame = input.profileFrame;
    }
    if (input.profileBadge !== undefined && input.profileBadge !== user.profileBadge) {
      if (input.profileBadge !== null) {
        const owned = await this.zcStoreItems.exists({ where: { userId, kind: 'badge', itemId: `badge_${input.profileBadge}` } });
        if (!owned) throw new BadRequestException('Bu profil nishoni sizda yo‘q. Avval ZC do‘konidan xarid qiling.');
      }
      user.profileBadge = input.profileBadge;
    }

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
    // Run independent database checks and password hashing concurrently.
    // Cost 10 keeps a strong adaptive hash while reducing CPU time on the free tier.
    const [existingUsername, existingEmail, passwordHash] = await Promise.all([
      this.userRepository.findOne({ where: { username } }),
      email ? this.userRepository.findOne({ where: { email } }) : Promise.resolve(null),
      bcrypt.hash(dto.password, 10),
    ]);
    if (existingUsername) {
      throw new ConflictException('Bu username allaqachon band');
    }
    if (existingEmail) {
      throw new ConflictException('Bu email allaqachon ro‘yxatdan o‘tgan');
    }
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
    return { message: 'Agar raqam ZELQEN CORE hisobiga bog‘langan bo‘lsa, kod yuboriladi' };
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


  private getTelegramConfig() {
    const clientId = this.config.get<string>('TELEGRAM_CLIENT_ID');
    const clientSecret = this.config.get<string>('TELEGRAM_CLIENT_SECRET');
    const redirectUri = this.config.get<string>('TELEGRAM_REDIRECT_URI');
    if (!clientId || !clientSecret || !redirectUri) {
      throw new ServiceUnavailableException('Telegram orqali kirish hali sozlanmagan');
    }
    return { clientId, clientSecret, redirectUri };
  }

  async getTelegramAuthorizationUrl(): Promise<string> {
    const { clientId, redirectUri } = this.getTelegramConfig();
    // Telegram enforces a short state parameter; never put a JWT/PKCE verifier in it.
    const state = `${Math.floor(Date.now() / 1000).toString(36)}.${randomBytes(12).toString('base64url')}`;
    const nonce = state;
    const jwtSecret = this.config.get<string>('JWT_SECRET');
    if (!jwtSecret) throw new ServiceUnavailableException('Auth xavfsizlik kaliti sozlanmagan');
    const codeVerifier = createHmac('sha256', jwtSecret)
      .update(`telegram-oauth:${state}`)
      .digest('base64url');
    const codeChallenge = createHash('sha256').update(codeVerifier).digest('base64url');
    const url = new URL('https://oauth.telegram.org/auth');
    url.searchParams.set('client_id', clientId);
    url.searchParams.set('redirect_uri', redirectUri);
    url.searchParams.set('response_type', 'code');
    url.searchParams.set('scope', 'openid profile');
    url.searchParams.set('state', state);
    url.searchParams.set('nonce', nonce);
    url.searchParams.set('code_challenge', codeChallenge);
    url.searchParams.set('code_challenge_method', 'S256');
    return url.toString();
  }

  async handleTelegramCallback(code: string, state: string): Promise<string> {
    if (!code || code.length > 2048 || !state || state.length > 64) {
      throw new UnauthorizedException('Telegram kirish javobi noto‘g‘ri');
    }
    const match = /^([0-9a-z]{1,12})\.([A-Za-z0-9_-]{16})$/.exec(state);
    const issuedAt = match ? Number.parseInt(match[1], 36) : Number.NaN;
    const now = Math.floor(Date.now() / 1000);
    if (!match || !Number.isSafeInteger(issuedAt) || issuedAt > now + 30 || now - issuedAt > 600) {
      throw new UnauthorizedException('Telegram kirish so‘rovi muddati tugagan yoki noto‘g‘ri');
    }
    const jwtSecret = this.config.get<string>('JWT_SECRET');
    if (!jwtSecret) throw new ServiceUnavailableException('Auth xavfsizlik kaliti sozlanmagan');
    const codeVerifier = createHmac('sha256', jwtSecret)
      .update(`telegram-oauth:${state}`)
      .digest('base64url');
    const { clientId, clientSecret, redirectUri } = this.getTelegramConfig();
    const body = new URLSearchParams({
      grant_type: 'authorization_code',
      code,
      redirect_uri: redirectUri,
      client_id: clientId,
      code_verifier: codeVerifier,
    });
    const credentials = Buffer.from(`${clientId}:${clientSecret}`).toString('base64');
    const tokenResponse = await fetch('https://oauth.telegram.org/token', {
      method: 'POST',
      headers: {
        Authorization: `Basic ${credentials}`,
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body,
      signal: AbortSignal.timeout(10_000),
    });
    const tokenPayload = await tokenResponse.json().catch(() => null) as
      | { id_token?: string }
      | null;
    if (!tokenResponse.ok || !tokenPayload?.id_token) {
      throw new UnauthorizedException('Telegram hisobini tasdiqlash amalga oshmadi');
    }

    const result = await this.loginWithTelegram(tokenPayload.id_token, state);
    const rawCode = randomBytes(32).toString('base64url');
    const codeHash = createHash('sha256').update(rawCode).digest('hex');
    await this.oauthCodeRepository.save(this.oauthCodeRepository.create({
      userId: result.user.id,
      codeHash,
      expiresAt: new Date(Date.now() + 90_000),
      consumedAt: null,
    }));
    return `quizarena://auth?provider=telegram&code=${encodeURIComponent(rawCode)}`;
  }

  async loginWithTelegram(idToken: string, expectedNonce: string) {
    const { clientId } = this.getTelegramConfig();
    const parts = idToken.split('.');
    if (parts.length !== 3) {
      throw new UnauthorizedException('Telegram ID token noto‘g‘ri');
    }

    let header: { alg?: string; kid?: string };
    let claims: {
      iss?: string; aud?: string | string[]; sub?: string; exp?: number;
      nonce?: string; name?: string; preferred_username?: string; picture?: string;
    };
    try {
      header = JSON.parse(Buffer.from(parts[0], 'base64url').toString('utf8'));
      claims = JSON.parse(Buffer.from(parts[1], 'base64url').toString('utf8'));
    } catch {
      throw new UnauthorizedException('Telegram ID token noto‘g‘ri');
    }
    if (header.alg !== 'RS256' || !header.kid) {
      throw new UnauthorizedException('Telegram ID token imzosi noto‘g‘ri');
    }

    const jwksResponse = await fetch('https://oauth.telegram.org/.well-known/jwks.json', {
      signal: AbortSignal.timeout(10_000),
    });
    const jwks = await jwksResponse.json().catch(() => null) as
      | { keys?: Array<{ kid?: string; kty?: string; use?: string; alg?: string; n?: string; e?: string }> }
      | null;
    const jwk = jwks?.keys?.find(key => key.kid === header.kid && key.kty === 'RSA');
    if (!jwksResponse.ok || !jwk) {
      throw new UnauthorizedException('Telegram imzo kaliti tekshirilmadi');
    }

    const publicKey = createPublicKey({ key: jwk as any, format: 'jwk' });
    const validSignature = verifySignature(
      'RSA-SHA256',
      Buffer.from(`${parts[0]}.${parts[1]}`),
      publicKey,
      Buffer.from(parts[2], 'base64url'),
    );
    const audienceMatches = Array.isArray(claims.aud)
      ? claims.aud.includes(clientId)
      : claims.aud === clientId;
    if (
      !validSignature ||
      claims.iss !== 'https://oauth.telegram.org' ||
      !audienceMatches ||
      !claims.sub ||
      !claims.exp ||
      claims.exp <= Math.floor(Date.now() / 1000) ||
      claims.nonce !== expectedNonce
    ) {
      throw new UnauthorizedException('Telegram hisobini tasdiqlash amalga oshmadi');
    }

    let user = await this.userRepository.findOne({
      where: { telegramSubject: claims.sub },
    });
    if (!user) {
      const displayName = (claims.name || claims.preferred_username || 'Telegram user')
        .trim().slice(0, 100) || 'Telegram user';
      const base = (claims.preferred_username || `tg_${claims.sub}`)
        .toLowerCase().replace(/[^a-z0-9_]/g, '_').slice(0, 24) || `tg_${claims.sub.slice(-12)}`;
      const usernameBase = base.length >= 3 ? base : `tg_${claims.sub.slice(-12)}`;
      let username = usernameBase;
      let suffix = 1;
      while (await this.userRepository.findOne({ where: { username } })) {
        const tail = `_${suffix++}`;
        username = `${usernameBase.slice(0, 30 - tail.length)}${tail}`;
      }
      user = this.userRepository.create({
        displayName,
        username,
        email: null,
        telegramSubject: claims.sub,
        passwordHash: await bcrypt.hash(randomBytes(32).toString('hex'), 12),
        avatarUrl: claims.picture || null,
        role: 'user',
        status: 'active',
      });
      try {
        user = await this.userRepository.save(user);
      } catch (error) {
        // A concurrent first login may have created the same Telegram identity.
        const existing = await this.userRepository.findOne({
          where: { telegramSubject: claims.sub },
        });
        if (!existing) throw error;
        user = existing;
      }
    }

    if (user.status !== 'active') {
      throw new UnauthorizedException('Hisobingiz bloklangan');
    }
    return { accessToken: await this.createToken(user), user: this.getSafeUser(user) };
  }


  /**
   * Complete a Telegram bot sign-in after Telegram has shared the sender's own
   * contact. The webhook layer verifies Telegram's secret header and contact
   * ownership before calling this method.
   */
  async completeTelegramBotLogin(input: {
    telegramUserId: number;
    phoneNumber: string;
    firstName?: string;
    lastName?: string;
    username?: string;
  }) {
    const phone = this.otpService.normalizePhone(input.phoneNumber);
    const telegramSubject = String(input.telegramUserId);
    let userByTelegram = await this.userRepository.findOne({ where: { telegramSubject } });
    let userByPhone = await this.userRepository.findOne({ where: { phoneNumber: phone } });

    if (userByTelegram && userByPhone && userByTelegram.id !== userByPhone.id) {
      throw new ConflictException('Telegram va telefon raqami ikki xil akkauntga tegishli');
    }
    if (userByPhone?.telegramSubject && userByPhone.telegramSubject !== telegramSubject) {
      throw new ConflictException('Bu telefon raqami boshqa Telegram akkauntiga bog‘langan');
    }
    if (userByTelegram && userByTelegram.phoneNumber && userByTelegram.phoneNumber !== phone) {
      throw new ConflictException('Bu Telegram akkaunti boshqa telefon raqamiga bog‘langan');
    }

    let user = userByTelegram ?? userByPhone;
    if (user) {
      if (user.status !== 'active') throw new UnauthorizedException('Hisobingiz bloklangan');
      user.telegramSubject = telegramSubject;
      user.phoneNumber = phone;
      user.phoneVerifiedAt = new Date();
      user = await this.userRepository.save(user);
    } else {
      const displayName = [input.firstName, input.lastName]
        .filter(Boolean).join(' ').trim().slice(0, 100) || 'Telegram foydalanuvchisi';
      const base = (input.username || `tg_${telegramSubject}`)
        .toLowerCase().replace(/[^a-z0-9_]/g, '_').slice(0, 24);
      const usernameBase = base.length >= 3 ? base : `tg_${telegramSubject.slice(-12)}`;
      let username = usernameBase;
      let suffix = 1;
      while (await this.userRepository.findOne({ where: { username } })) {
        const tail = `_${suffix++}`;
        username = `${usernameBase.slice(0, 30 - tail.length)}${tail}`;
      }
      user = this.userRepository.create({
        displayName,
        username,
        email: null,
        phoneNumber: phone,
        phoneVerifiedAt: new Date(),
        telegramSubject,
        passwordHash: await bcrypt.hash(randomBytes(32).toString('hex'), 12),
        role: 'user',
        status: 'active',
      });
      try {
        user = await this.userRepository.save(user);
      } catch (error) {
        const raced = await this.userRepository.findOne({ where: { telegramSubject } });
        if (!raced) throw error;
        user = raced;
      }
    }

    const rawCode = randomBytes(32).toString('base64url');
    const codeHash = createHash('sha256').update(rawCode).digest('hex');
    await this.oauthCodeRepository.save(this.oauthCodeRepository.create({
      userId: user.id,
      codeHash,
      expiresAt: new Date(Date.now() + 90_000),
      consumedAt: null,
    }));
    return {
      deepLink: `quizarena://auth?provider=telegram&code=${encodeURIComponent(rawCode)}`,
      user: this.getSafeUser(user),
    };
  }


  private telegramSessionHash(value: string): string {
    return createHash('sha256').update(value).digest('hex');
  }

  private telegramOtpHash(sessionId: string, code: string): string {
    const secret = this.config.getOrThrow<string>('JWT_SECRET');
    return createHmac('sha256', secret).update(`telegram-bot:${sessionId}:${code}`).digest('hex');
  }

  async createTelegramBotSession() {
    const sessionId = randomBytes(24).toString('base64url');
    const sessionHash = this.telegramSessionHash(sessionId);
    await this.telegramSessions.save(this.telegramSessions.create({
      sessionHash, telegramUserId: null, phoneNumber: null, codeHash: null,
      firstName: null, lastName: null, telegramUsername: null, attempts: 0,
      expiresAt: new Date(Date.now() + 10 * 60_000), verifiedAt: null, consumedAt: null,
    }));
    const botUsername = this.config.get<string>('TELEGRAM_BOT_USERNAME') || 'quizarenaligininbot';
    return { sessionId, botUrl: `https://t.me/${botUsername}?start=auth_${sessionId}`, expiresIn: 600 };
  }


  async bindTelegramBotSession(sessionId: string, telegramUserId: number): Promise<void> {
    if (!/^[A-Za-z0-9_-]{30,40}$/.test(sessionId)) throw new BadRequestException('Bot havolasi noto‘g‘ri');
    const session = await this.telegramSessions.createQueryBuilder('session').addSelect('session.sessionHash').where('session.sessionHash = :hash', { hash: this.telegramSessionHash(sessionId) }).getOne();
    if (!session || session.expiresAt.getTime() <= Date.now() || session.consumedAt) {
      throw new UnauthorizedException('Sessiya tugagan. Ilovadan qayta boshlang.');
    }
    const existing = await this.telegramSessions.findOne({ where: { telegramUserId: String(telegramUserId), consumedAt: null } });
    if (existing && existing.id !== session.id) {
      existing.consumedAt = new Date();
      await this.telegramSessions.save(existing);
    }
    session.telegramUserId = String(telegramUserId);
    await this.telegramSessions.save(session);
  }

  async issueTelegramBotOtpForUser(input: {
    telegramUserId: number; phoneNumber: string; firstName?: string; lastName?: string; username?: string;
  }): Promise<string> {
    const session = await this.telegramSessions.createQueryBuilder('session').addSelect('session.sessionHash')
      .where('session.telegramUserId = :telegramUserId', { telegramUserId: String(input.telegramUserId) })
      .andWhere('session.consumedAt IS NULL').orderBy('session.createdAt', 'DESC').getOne();
    if (!session || session.expiresAt.getTime() <= Date.now()) {
      throw new UnauthorizedException('Ilovadagi ro‘yxatdan o‘tish oynasidan qayta boshlang.');
    }
    const phone = this.otpService.normalizePhone(input.phoneNumber);
    const telegramSubject = String(input.telegramUserId);
    const existingTelegram = await this.userRepository.findOne({ where: { telegramSubject } });
    if (existingTelegram?.phoneNumber && existingTelegram.phoneNumber !== phone) {
      throw new ConflictException('Bu Telegram akkaunti boshqa telefon raqamiga bog‘langan');
    }
    const existingPhone = await this.userRepository.findOne({ where: { phoneNumber: phone } });
    if (existingPhone?.telegramSubject && existingPhone.telegramSubject !== telegramSubject) {
      throw new ConflictException('Bu telefon raqami boshqa Telegram akkauntiga bog‘langan');
    }
    const code = String(randomInt(100000, 1_000_000));
    session.phoneNumber = phone;
    session.codeHash = createHmac('sha256', this.config.getOrThrow<string>('JWT_SECRET'))
      .update(`telegram-bot:${session.sessionHash}:${code}`).digest('hex');
    session.firstName = input.firstName?.slice(0, 100) || null;
    session.lastName = input.lastName?.slice(0, 100) || null;
    session.telegramUsername = input.username?.slice(0, 64) || null;
    session.attempts = 0;
    session.verifiedAt = null;
    session.expiresAt = new Date(Date.now() + 5 * 60_000);
    await this.telegramSessions.save(session);
    return code;
  }

  async issueTelegramBotOtp(input: {
    sessionId: string; telegramUserId: number; phoneNumber: string;
    firstName?: string; lastName?: string; username?: string;
  }): Promise<string> {
    if (!/^[A-Za-z0-9_-]{30,40}$/.test(input.sessionId)) throw new BadRequestException('Ro‘yxatdan o‘tish sessiyasi noto‘g‘ri');
    const session = await this.telegramSessions.findOne({
      where: { sessionHash: this.telegramSessionHash(input.sessionId) },
    });
    if (!session || session.expiresAt.getTime() <= Date.now() || session.consumedAt) {
      throw new UnauthorizedException('Ro‘yxatdan o‘tish sessiyasi tugagan. Ilovadan qayta boshlang.');
    }
    const phone = this.otpService.normalizePhone(input.phoneNumber);
    const existingTelegram = await this.userRepository.findOne({ where: { telegramSubject: String(input.telegramUserId) } });
    if (existingTelegram?.phoneNumber && existingTelegram.phoneNumber !== phone) {
      throw new ConflictException('Bu Telegram akkaunti boshqa telefon raqamiga bog‘langan');
    }
    const existingPhone = await this.userRepository.findOne({ where: { phoneNumber: phone } });
    if (existingPhone?.telegramSubject && existingPhone.telegramSubject !== String(input.telegramUserId)) {
      throw new ConflictException('Bu telefon raqami boshqa Telegram akkauntiga bog‘langan');
    }
    const code = String(randomInt(100000, 1_000_000));
    session.telegramUserId = String(input.telegramUserId);
    session.phoneNumber = phone;
    session.codeHash = createHmac('sha256', this.config.getOrThrow<string>('JWT_SECRET')).update(`telegram-bot:${session.sessionHash}:${code}`).digest('hex');
    session.firstName = input.firstName?.slice(0, 100) || null;
    session.lastName = input.lastName?.slice(0, 100) || null;
    session.telegramUsername = input.username?.slice(0, 64) || null;
    session.attempts = 0;
    session.verifiedAt = null;
    session.expiresAt = new Date(Date.now() + 5 * 60_000);
    await this.telegramSessions.save(session);
    return code;
  }

  async verifyTelegramBotCode(sessionId: string, code: string) {
    if (!/^[A-Za-z0-9_-]{30,40}$/.test(sessionId) || !/^\\d{6}$/.test(code)) {
      throw new BadRequestException('Sessiya yoki 6 xonali kod noto‘g‘ri');
    }
    const session = await this.telegramSessions.createQueryBuilder('session')
      .addSelect('session.codeHash')
      .addSelect('session.sessionHash')
      .where('session.sessionHash = :hash', { hash: this.telegramSessionHash(sessionId) })
      .getOne();
    if (!session || !session.codeHash || !session.telegramUserId || !session.phoneNumber ||
      session.expiresAt.getTime() <= Date.now() || session.consumedAt || session.attempts >= 5) {
      throw new UnauthorizedException('Kod noto‘g‘ri yoki muddati tugagan. Qayta boshlang.');
    }
    const expected = Buffer.from(session.codeHash, 'hex');
    const actual = Buffer.from(createHmac('sha256', this.config.getOrThrow<string>('JWT_SECRET')).update(`telegram-bot:${session.sessionHash}:${code}`).digest('hex'), 'hex');
    const valid = expected.length === actual.length && timingSafeEqual(expected, actual);
    if (!valid) {
      await this.telegramSessions.createQueryBuilder().update(TelegramBotAuthSession)
        .set({ attempts: () => '"attempts" + 1' }).where('id = :id', { id: session.id })
        .andWhere('attempts < 5').execute();
      throw new UnauthorizedException('Tasdiqlash kodi noto‘g‘ri');
    }

    const telegramSubject = session.telegramUserId;
    const phone = session.phoneNumber;
    let user = await this.userRepository.findOne({ where: { telegramSubject } });
    const byPhone = await this.userRepository.findOne({ where: { phoneNumber: phone } });
    if (user && byPhone && user.id !== byPhone.id) throw new ConflictException('Telegram va telefon ikki xil akkauntga tegishli');
    user = user || byPhone;
    if (user) {
      if (user.status !== 'active') throw new UnauthorizedException('Hisobingiz bloklangan');
      if (user.telegramSubject && user.telegramSubject !== telegramSubject) throw new ConflictException('Telefon boshqa Telegram akkauntiga bog‘langan');
      user.telegramSubject = telegramSubject;
      user.phoneNumber = phone;
      user.phoneVerifiedAt = new Date();
      user = await this.userRepository.save(user);
    } else {
      const displayName = [session.firstName, session.lastName].filter(Boolean).join(' ').trim() || 'Telegram foydalanuvchisi';
      const base = (session.telegramUsername || `tg_${telegramSubject}`).toLowerCase().replace(/[^a-z0-9_]/g, '_').slice(0, 24);
      const usernameBase = base.length >= 3 ? base : `tg_${telegramSubject.slice(-12)}`;
      let username = usernameBase;
      let suffix = 1;
      while (await this.userRepository.findOne({ where: { username } })) {
        const tail = `_${suffix++}`;
        username = `${usernameBase.slice(0, 30 - tail.length)}${tail}`;
      }
      user = await this.userRepository.save(this.userRepository.create({
        displayName: displayName.slice(0, 100), username, email: null,
        phoneNumber: phone, phoneVerifiedAt: new Date(), telegramSubject,
        passwordHash: await bcrypt.hash(randomBytes(32).toString('hex'), 12),
        role: 'user', status: 'active',
      }));
    }
    const consumed = await this.telegramSessions.createQueryBuilder().update(TelegramBotAuthSession)
      .set({ consumedAt: new Date(), verifiedAt: new Date() })
      .where('id = :id', { id: session.id }).andWhere('"consumedAt" IS NULL')
      .andWhere('attempts < 5').execute();
    if (consumed.affected !== 1) throw new UnauthorizedException('Kod avval ishlatilgan yoki muddati tugagan');
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

    if (user.email && !user.emailVerifiedAt) {
      user.emailVerifiedAt = new Date();
      user = await this.userRepository.save(user);
    }
    if (user.status !== 'active') throw new UnauthorizedException('Hisobingiz bloklangan');
    return { accessToken: await this.createToken(user), user: this.getSafeUser(user) };
  }

  private async ensureOwnerAccount(username: string) {
    const configuredUsername = this.config.get<string>('OWNER_ACCOUNT_USERNAME')?.trim().toLowerCase();
    const configuredPassword = this.config.get<string>('OWNER_ACCOUNT_PASSWORD');

    if (!configuredUsername || !configuredPassword || username !== configuredUsername) return;
    if (!/^[a-z0-9_]{3,30}$/.test(configuredUsername) || configuredPassword.length < 20) {
      throw new ServiceUnavailableException('Owner account configuration is invalid');
    }

    const existing = await this.userRepository.findOne({ where: { username: configuredUsername } });
    if (existing) return;

    const passwordHash = await bcrypt.hash(configuredPassword, 12);
    const owner = this.userRepository.create({
      displayName: 'ZELQEN CORE Owner',
      username: configuredUsername,
      email: null,
      passwordHash,
      role: 'admin',
      status: 'active',
    });
    await this.userRepository.save(owner);
  }

  private async ensureQaAdminAccount(username: string) {
    const configuredUsername = this.config.get<string>('QA_ADMIN_ACCOUNT_USERNAME')?.trim().toLowerCase();
    const configuredPassword = this.config.get<string>('QA_ADMIN_ACCOUNT_PASSWORD');

    if (!configuredUsername || !configuredPassword || username !== configuredUsername) return;
    if (!/^[a-z0-9_]{3,30}$/.test(configuredUsername) || configuredPassword.length < 20) {
      throw new ServiceUnavailableException('QA admin account configuration is invalid');
    }

    const existing = await this.userRepository
      .createQueryBuilder('user')
      .addSelect('user.passwordHash')
      .where('user.username = :username', { username: configuredUsername })
      .getOne();
    if (existing) {
      if (existing.role !== 'admin' || existing.status !== 'active') {
        throw new ServiceUnavailableException('Configured QA admin username is already assigned to a non-admin or inactive account');
      }
      // Reconcile the existing QA admin with the currently configured Railway secret.
      // This safely fixes stale database hashes after an intentional secret rotation.
      if (!(await bcrypt.compare(configuredPassword, existing.passwordHash))) {
        existing.passwordHash = await bcrypt.hash(configuredPassword, 12);
        await this.userRepository.save(existing);
      }
      return;
    }

    const passwordHash = await bcrypt.hash(configuredPassword, 12);
    const admin = this.userRepository.create({
      displayName: 'ZELQEN QA Administrator',
      username: configuredUsername,
      email: null,
      passwordHash,
      role: 'admin',
      status: 'active',
    });
    await this.userRepository.save(admin);
  }

  /**
   * Bootstrap the dedicated QA tester account from a Railway secret.
   * The username is intentionally fixed and can never receive admin privileges.
   * If the account already exists, only its configured QA password is reconciled.
   */
  private async ensureQaTesterAccount(username: string) {
    const testerUsername = 'qa_tester_zelqen';
    const configuredPassword = this.config.get<string>('QA_TESTER_ACCOUNT_PASSWORD');

    if (username !== testerUsername || !configuredPassword) return;
    const passwordBytes = Buffer.byteLength(configuredPassword, 'utf8');
    if (passwordBytes < 8 || passwordBytes > 72) {
      throw new ServiceUnavailableException('QA tester password configuration must be 8–72 bytes');
    }

    const existing = await this.userRepository
      .createQueryBuilder('user')
      .addSelect('user.passwordHash')
      .where('user.username = :username', { username: testerUsername })
      .getOne();

    if (existing) {
      if (existing.role !== 'user' || existing.status !== 'active') {
        throw new ServiceUnavailableException('QA tester account must remain an active standard user');
      }
      if (!(await bcrypt.compare(configuredPassword, existing.passwordHash))) {
        existing.passwordHash = await bcrypt.hash(configuredPassword, 12);
        await this.userRepository.save(existing);
      }
      return;
    }

    const tester = this.userRepository.create({
      displayName: 'ZELQEN QA Tester',
      username: testerUsername,
      email: null,
      passwordHash: await bcrypt.hash(configuredPassword, 12),
      role: 'user',
      status: 'active',
    });
    await this.userRepository.save(tester);
  }

  async login(dto: LoginDto) {
    const username = dto.username.trim().toLowerCase();
    await this.ensureOwnerAccount(username);
    await this.ensureQaAdminAccount(username);
    await this.ensureQaTesterAccount(username);
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
