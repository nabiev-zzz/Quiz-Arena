import {
  ConflictException,
  HttpException,
  HttpStatus,
  Injectable,
  ServiceUnavailableException,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { JwtService } from '@nestjs/jwt';
import { MoreThan, Repository } from 'typeorm';
import * as bcrypt from 'bcryptjs';
import { createHash, randomInt } from 'node:crypto';

import { User } from '../users/entities/user.entity';
import { RegisterDto } from './dto/register.dto';
import { AuthEmailCode } from './entities/auth-email-code.entity';

@Injectable()
export class EmailAuthService {
  constructor(
    @InjectRepository(User) private readonly users: Repository<User>,
    @InjectRepository(AuthEmailCode) private readonly codes: Repository<AuthEmailCode>,
    private readonly jwt: JwtService,
    private readonly config: ConfigService,
  ) {}

  private hash(code: string): string {
    return createHash('sha256').update(code).digest('hex');
  }

  private async sendEmail(to: string, subject: string, code: string, purpose: 'verify_email' | 'password_reset' | 'delete_account') {
    const apiKey = this.config.get<string>('RESEND_API_KEY');
    const from = this.config.get<string>('EMAIL_FROM');
    if (!apiKey || !from) {
      throw new ServiceUnavailableException('Email xizmati hali sozlanmagan');
    }

    const heading = purpose === 'verify_email' ? 'Email manzilingizni tasdiqlang' : purpose === 'delete_account' ? 'QUIZ ARENA hisobini o‘chirish' : 'QUIZ ARENA parolini tiklash';
    const explanation = purpose === 'verify_email'
      ? 'Ro‘yxatdan o‘tishni yakunlash uchun quyidagi kodni ilovaga kiriting.'
      : purpose === 'delete_account'
        ? 'Hisobni o‘chirishni tasdiqlash uchun quyidagi kodni hisob o‘chirish sahifasiga kiriting. Agar bu so‘rovni siz yubormagan bo‘lsangiz, xatni e’tiborsiz qoldiring.'
        : 'Parolingizni yangilash uchun quyidagi kodni ilovaga kiriting.';
    const response = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from,
        to: [to],
        subject,
        html: `<div style="font-family:Arial,sans-serif;max-width:520px;margin:auto;padding:28px;color:#17152b"><h2>${heading}</h2><p>${explanation}</p><div style="font-size:32px;font-weight:700;letter-spacing:9px;padding:18px 0;color:#7657e8">${code}</div><p>Kod 10 daqiqa amal qiladi. Uni hech kimga bermang.</p><p style="color:#777">Agar bu so‘rovni siz yubormagan bo‘lsangiz, xatni e’tiborsiz qoldiring.</p><strong>QUIZ ARENA</strong></div>`,
      }),
      signal: AbortSignal.timeout(10_000),
    });
    if (!response.ok) {
      // Do not log provider response bodies or credentials.
      throw new ServiceUnavailableException('Email yuborilmadi. Keyinroq qayta urinib ko‘ring.');
    }
  }

  private async issueCode(email: string, purpose: 'verify_email' | 'password_reset' | 'delete_account') {
    const now = new Date();
    const recent = await this.codes.find({
      where: { email, purpose, createdAt: MoreThan(new Date(now.getTime() - 60 * 60 * 1000)) },
      order: { createdAt: 'DESC' },
    });
    if (recent.length > 0 && now.getTime() - recent[0].createdAt.getTime() < 60_000) {
      throw new HttpException('Yangi kodni 60 soniyadan keyin so‘rang.', HttpStatus.TOO_MANY_REQUESTS);
    }
    if (recent.length >= 3) {
      throw new HttpException('Bir soat ichida ko‘pi bilan 3 ta kod so‘rash mumkin.', HttpStatus.TOO_MANY_REQUESTS);
    }

    const code = randomInt(0, 1_000_000).toString().padStart(6, '0');
    await this.sendEmail(
      email,
      purpose === 'verify_email' ? 'QUIZ ARENA — email tasdiqlash kodi' : purpose === 'delete_account' ? 'QUIZ ARENA — hisobni o‘chirish kodi' : 'QUIZ ARENA — parolni tiklash kodi',
      code,
      purpose,
    );
    await this.codes.save(this.codes.create({
      email,
      purpose,
      codeHash: this.hash(code),
      expiresAt: new Date(now.getTime() + 10 * 60 * 1000),
      attempts: 0,
      consumedAt: null,
    }));
  }

  private async consumeCode(emailInput: string, purpose: 'verify_email' | 'password_reset' | 'delete_account', code: string) {
    const email = emailInput.trim().toLowerCase();
    const record = await this.codes.createQueryBuilder('item')
      .addSelect('item.codeHash')
      .where('item.email = :email', { email })
      .andWhere('item.purpose = :purpose', { purpose })
      .andWhere('item.consumedAt IS NULL')
      .andWhere('item.expiresAt > :now', { now: new Date() })
      .orderBy('item.createdAt', 'DESC')
      .getOne();

    if (!record || record.attempts >= 5) {
      throw new UnauthorizedException('Kod noto‘g‘ri yoki muddati tugagan');
    }
    record.attempts += 1;
    const matches = record.codeHash === this.hash(code);
    if (!matches) {
      await this.codes.save(record);
      throw new UnauthorizedException('Kod noto‘g‘ri yoki muddati tugagan');
    }

    const consumed = await this.codes.createQueryBuilder()
      .update(AuthEmailCode)
      .set({ consumedAt: new Date() })
      .where('id = :id', { id: record.id })
      .andWhere('"consumedAt" IS NULL')
      .andWhere('"expiresAt" > :now', { now: new Date() })
      .execute();
    if (consumed.affected !== 1) {
      throw new UnauthorizedException('Kod noto‘g‘ri yoki muddati tugagan');
    }
    return email;
  }

  private async createSession(user: User) {
    const accessToken = await this.jwt.signAsync({ sub: user.id, username: user.username });
    return {
      accessToken,
      user: {
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
        rankPoints: user.rankPoints,
        rankTier: user.rankPoints >= 1400 ? 'Grandmaster' : user.rankPoints >= 1100 ? 'Master' : user.rankPoints >= 800 ? 'Diamond' : user.rankPoints >= 600 ? 'Platinum' : user.rankPoints >= 400 ? 'Gold' : user.rankPoints >= 200 ? 'Silver' : 'Bronze',
        level: user.level,
        avatarUrl: user.avatarUrl,
        bio: user.bio,
        profileFrame: user.profileFrame,
        avatarDecoration: user.avatarDecoration,
        createdAt: user.createdAt,
      },
    };
  }

  async register(dto: RegisterDto) {
    const email = dto.email?.trim().toLowerCase();
    if (!email) throw new ConflictException('Ro‘yxatdan o‘tish uchun email manzili majburiy');
    const username = dto.username.trim().toLowerCase();
    if (await this.users.findOne({ where: [{ username }, { email }] })) {
      throw new ConflictException('Username yoki email allaqachon ro‘yxatdan o‘tgan');
    }
    const user = this.users.create({
      displayName: dto.displayName.trim(),
      username,
      email,
      emailVerifiedAt: null,
      passwordHash: await bcrypt.hash(dto.password, 12),
      role: 'user',
      status: 'active',
    });
    await this.users.save(user);
    try {
      await this.issueCode(email, 'verify_email');
      return { message: 'Tasdiqlash kodi emailingizga yuborildi.', email, emailSent: true };
    } catch {
      return { message: 'Hisob yaratildi. Email yuborishni qayta urinib ko‘rishingiz mumkin.', email, emailSent: false };
    }
  }

  async requestVerification(emailInput: string) {
    const email = emailInput.trim().toLowerCase();
    const user = await this.users.findOne({ where: { email } });
    if (user && !user.emailVerifiedAt && user.status === 'active') {
      try {
        await this.issueCode(email, 'verify_email');
      } catch {
        // Keep verification resend responses generic to avoid account enumeration.
      }
    }
    return { message: 'Agar email tasdiqlashni kutayotgan QUIZ ARENA hisobi mavjud bo‘lsa, kod yuborildi.' };
  }

  async verifyEmail(emailInput: string, code: string) {
    const email = await this.consumeCode(emailInput, 'verify_email', code);
    const user = await this.users.findOne({ where: { email } });
    if (!user || user.status !== 'active') throw new UnauthorizedException('Hisob topilmadi yoki bloklangan');
    user.emailVerifiedAt = new Date();
    const saved = await this.users.save(user);
    return this.createSession(saved);
  }

  async requestAccountDeletion(emailInput: string) {
    const email = emailInput.trim().toLowerCase();
    const user = await this.users.findOne({ where: { email } });
    if (user?.emailVerifiedAt && user.status === 'active') {
      try {
        await this.issueCode(email, 'delete_account');
      } catch {
        // Keep the public response generic to prevent account enumeration.
      }
    }
    return { message: 'Agar tasdiqlangan email QUIZ ARENA hisobiga bog‘langan bo‘lsa, o‘chirish kodi yuboriladi.' };
  }

  async confirmAccountDeletion(emailInput: string, code: string): Promise<{ userId: string }> {
    const email = await this.consumeCode(emailInput, 'delete_account', code);
    const user = await this.users.findOne({ where: { email } });
    if (!user || !user.emailVerifiedAt || user.status !== 'active') {
      throw new UnauthorizedException('Kod noto‘g‘ri yoki muddati tugagan');
    }
    return { userId: user.id };
  }

  async requestPasswordReset(emailInput: string) {
    const email = emailInput.trim().toLowerCase();
    const user = await this.users.findOne({ where: { email } });
    if (user?.emailVerifiedAt && user.status === 'active') {
      try {
        await this.issueCode(email, 'password_reset');
      } catch {
        // Keep password-reset responses generic to prevent account enumeration.
      }
    }
    return { message: 'Agar tasdiqlangan email QUIZ ARENA hisobiga bog‘langan bo‘lsa, tiklash kodi yuboriladi.' };
  }

  async resetPassword(emailInput: string, code: string, newPassword: string) {
    const email = await this.consumeCode(emailInput, 'password_reset', code);
    const user = await this.users.findOne({ where: { email } });
    if (!user || !user.emailVerifiedAt || user.status !== 'active') {
      throw new UnauthorizedException('Kod noto‘g‘ri yoki muddati tugagan');
    }
    user.passwordHash = await bcrypt.hash(newPassword, 12);
    await this.users.save(user);
    return { message: 'Parol muvaffaqiyatli yangilandi. Yangi parol bilan kiring.' };
  }
}
