import {
  BadRequestException,
  HttpException,
  HttpStatus,
  Injectable,
  ServiceUnavailableException,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { createHmac, randomInt, timingSafeEqual } from 'node:crypto';
import { MoreThan, Repository } from 'typeorm';
import { AuthOtp, AuthOtpPurpose } from './entities/auth-otp.entity';

@Injectable()
export class AuthOtpService {
  private eskizToken: string | null = null;
  private eskizTokenExpiresAt = 0;

  constructor(
    @InjectRepository(AuthOtp)
    private readonly otpRepository: Repository<AuthOtp>,
    private readonly config: ConfigService,
  ) {}

  normalizePhone(phone: string): string {
    const digits = phone.replace(/\D/g, '');
    const normalized = digits.length === 9 ? `998${digits}` : digits;
    if (!/^998\d{9}$/.test(normalized)) {
      throw new BadRequestException('Telefon raqam +998XXXXXXXXX formatida bo‘lishi kerak');
    }
    return normalized;
  }

  private hashCode(phone: string, purpose: AuthOtpPurpose, code: string): string {
    const secret = this.config.get<string>('JWT_SECRET');
    if (!secret) throw new ServiceUnavailableException('OTP xizmati sozlanmagan');
    return createHmac('sha256', secret).update(`${phone}:${purpose}:${code}`).digest('hex');
  }

  private async getEskizToken(): Promise<string> {
    if (this.eskizToken && Date.now() < this.eskizTokenExpiresAt) return this.eskizToken;

    const email = this.config.get<string>('ESKIZ_EMAIL');
    const password = this.config.get<string>('ESKIZ_PASSWORD');
    if (!email || !password) {
      throw new ServiceUnavailableException('SMS xizmati hozircha sozlanmagan');
    }

    const body = new FormData();
    body.set('email', email);
    body.set('password', password);
    const response = await fetch('https://notify.eskiz.uz/api/auth/login', {
      method: 'POST',
      body,
    });
    const payload = await response.json().catch(() => null) as
      | { data?: { token?: string }; message?: string }
      | null;
    if (!response.ok || !payload?.data?.token) {
      throw new ServiceUnavailableException('SMS provayderiga ulanish amalga oshmadi');
    }

    this.eskizToken = payload.data.token;
    this.eskizTokenExpiresAt = Date.now() + 29 * 24 * 60 * 60 * 1000;
    return this.eskizToken;
  }

  private async sendSms(phone: string, code: string): Promise<void> {
    const token = await this.getEskizToken();
    const body = new FormData();
    body.set('mobile_phone', phone);
    body.set('message', `QUIZ ARENA tasdiqlash kodi: ${code}. Kod 5 daqiqa amal qiladi. Uni hech kimga bermang.`);
    const sender = this.config.get<string>('ESKIZ_FROM');
    if (sender) body.set('from', sender);

    const response = await fetch('https://notify.eskiz.uz/api/message/sms/send', {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}` },
      body,
    });
    if (!response.ok) {
      this.eskizToken = null;
      throw new ServiceUnavailableException('SMS yuborilmadi. Birozdan keyin qayta urinib ko‘ring');
    }
  }

  async issue(phoneInput: string, purpose: AuthOtpPurpose): Promise<void> {
    const phone = this.normalizePhone(phoneInput);
    const now = new Date();
    const recent = await this.otpRepository.find({
      where: {
        phoneNumber: phone,
        purpose,
        createdAt: MoreThan(new Date(now.getTime() - 60 * 60 * 1000)),
      },
      order: { createdAt: 'DESC' },
      take: 4,
    });

    if (recent.length >= 3) {
      throw new HttpException('Juda ko‘p kod so‘raldi. Bir soatdan keyin urinib ko‘ring.', HttpStatus.TOO_MANY_REQUESTS);
    }
    if (recent[0] && now.getTime() - recent[0].createdAt.getTime() < 60_000) {
      throw new HttpException('Yangi kodni 60 soniyadan keyin so‘rashingiz mumkin.', HttpStatus.TOO_MANY_REQUESTS);
    }

    const code = String(randomInt(100000, 1_000_000));
    const otp = this.otpRepository.create({
      phoneNumber: phone,
      purpose,
      codeHash: this.hashCode(phone, purpose, code),
      expiresAt: new Date(now.getTime() + 5 * 60 * 1000),
      attempts: 0,
      consumedAt: null,
    });

    // Persist the challenge before sending; the code itself is never stored or logged.
    await this.otpRepository.save(otp);
    await this.sendSms(phone, code);
  }

  async verify(phoneInput: string, purpose: AuthOtpPurpose, code: string): Promise<string> {
    const phone = this.normalizePhone(phoneInput);
    const otp = await this.otpRepository
      .createQueryBuilder('otp')
      .addSelect('otp.codeHash')
      .where('otp.phoneNumber = :phone', { phone })
      .andWhere('otp.purpose = :purpose', { purpose })
      .andWhere('otp.consumedAt IS NULL')
      .orderBy('otp.createdAt', 'DESC')
      .getOne();

    if (!otp || otp.expiresAt.getTime() <= Date.now() || otp.attempts >= 5) {
      throw new UnauthorizedException('Kod noto‘g‘ri yoki muddati tugagan');
    }

    const expected = Buffer.from(otp.codeHash, 'hex');
    const actual = Buffer.from(this.hashCode(phone, purpose, code), 'hex');
    const valid = expected.length === actual.length && timingSafeEqual(expected, actual);

    if (!valid) {
      await this.otpRepository
        .createQueryBuilder()
        .update(AuthOtp)
        .set({ attempts: () => '"attempts" + 1' })
        .where('id = :id', { id: otp.id })
        .andWhere('"consumedAt" IS NULL')
        .andWhere('attempts < 5')
        .execute();
      throw new UnauthorizedException('Kod noto‘g‘ri yoki muddati tugagan');
    }

    const consumed = await this.otpRepository
      .createQueryBuilder()
      .update(AuthOtp)
      .set({ consumedAt: new Date() })
      .where('id = :id', { id: otp.id })
      .andWhere('"consumedAt" IS NULL')
      .andWhere('"expiresAt" > :now', { now: new Date() })
      .andWhere('attempts < 5')
      .execute();
    if (consumed.affected !== 1) {
      throw new UnauthorizedException('Kod noto‘g‘ri yoki muddati tugagan');
    }
    return phone;
  }
}
