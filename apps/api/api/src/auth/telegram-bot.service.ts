import {
  Injectable,
  Logger,
  OnModuleInit,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createHash, timingSafeEqual } from 'node:crypto';
import { AuthService } from './auth.service';

interface TelegramUser {
  id: number;
  first_name?: string;
  last_name?: string;
  username?: string;
}

interface TelegramMessage {
  message_id: number;
  text?: string;
  from?: TelegramUser;
  chat: { id: number };
  contact?: {
    phone_number: string;
    user_id?: number;
    first_name?: string;
    last_name?: string;
  };
}

interface TelegramUpdate {
  update_id: number;
  message?: TelegramMessage;
}

@Injectable()
export class TelegramBotService implements OnModuleInit {
  private readonly logger = new Logger(TelegramBotService.name);

  constructor(
    private readonly config: ConfigService,
    private readonly authService: AuthService,
  ) {}

  private get botToken(): string | undefined {
    return this.config.get<string>('BOT_TOKEN')?.trim() || undefined;
  }

  private get webhookSecret(): string | undefined {
    return this.botToken
      ? createHash('sha256').update(this.botToken).digest('hex')
      : undefined;
  }

  async onModuleInit(): Promise<void> {
    const token = this.botToken;
    if (!token) {
      this.logger.warn('BOT_TOKEN sozlanmagan; Telegram bot webhook ishga tushirilmadi.');
      return;
    }

    const explicitUrl = this.config.get<string>('TELEGRAM_WEBHOOK_URL')?.trim();
    const railwayDomain = this.config.get<string>('RAILWAY_PUBLIC_DOMAIN')?.trim();
    const webhookUrl = explicitUrl
      || (railwayDomain ? `https://${railwayDomain.replace(/^https?:\/\//, '')}/api/auth/telegram/webhook` : '');
    if (!webhookUrl || !webhookUrl.startsWith('https://')) {
      this.logger.warn('TELEGRAM_WEBHOOK_URL yoki RAILWAY_PUBLIC_DOMAIN sozlanmagan.');
      return;
    }

    try {
      const response = await fetch(`https://api.telegram.org/bot${token}/setWebhook`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          url: webhookUrl,
          secret_token: this.webhookSecret,
          allowed_updates: ['message'],
          drop_pending_updates: false,
        }),
        signal: AbortSignal.timeout(10_000),
      });
      const result = await response.json().catch(() => null) as
        | { ok?: boolean; description?: string }
        | null;
      if (!response.ok || !result?.ok) {
        this.logger.error(`Telegram webhook sozlanmadi: ${result?.description || response.status}`);
        return;
      }
      this.logger.log('Telegram bot webhook muvaffaqiyatli sozlandi.');
    } catch (error) {
      this.logger.error('Telegram webhook sozlashda tarmoq xatosi.', error instanceof Error ? error.stack : undefined);
    }
  }

  private async sendMessage(
    chatId: number,
    text: string,
    replyMarkup?: Record<string, unknown>,
  ): Promise<void> {
    const token = this.botToken;
    if (!token) return;
    const response = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        chat_id: chatId,
        text,
        ...(replyMarkup ? { reply_markup: replyMarkup } : {}),
      }),
      signal: AbortSignal.timeout(10_000),
    });
    if (!response.ok) {
      this.logger.warn(`Telegram sendMessage HTTP ${response.status}`);
    }
  }

  async handleUpdate(secret: string | undefined, payload: unknown): Promise<void> {
    const expected = this.webhookSecret;
    if (!expected || !secret || secret.length !== expected.length
      || !timingSafeEqual(Buffer.from(secret), Buffer.from(expected))) {
      throw new UnauthorizedException('Telegram webhook tasdig‘i noto‘g‘ri');
    }

    const update = payload as TelegramUpdate;
    const message = update?.message;
    const sender = message?.from;
    if (!message || !sender || !Number.isSafeInteger(sender.id)) return;

    if (message.text?.trim().split(/\s+/, 1)[0] === '/start') {
      await this.sendMessage(
        message.chat.id,
        'QUIZ ARENA ro‘yxatdan o‘tish xizmatiga xush kelibsiz! Davom etish uchun o‘z telefon raqamingizni yuboring.',
        {
          keyboard: [[{ text: '📱 Telefon raqamimni yuborish', request_contact: true }]],
          resize_keyboard: true,
          one_time_keyboard: true,
        },
      );
      return;
    }

    if (!message.contact) {
      await this.sendMessage(message.chat.id, 'Ro‘yxatdan o‘tish uchun /start buyrug‘ini yuboring.');
      return;
    }

    if (message.contact.user_id !== sender.id) {
      await this.sendMessage(message.chat.id, 'Xavfsizlik uchun faqat o‘zingizning Telegram kontakt tugmangiz orqali telefon raqamingizni yuboring.');
      return;
    }

    try {
      const result = await this.authService.completeTelegramBotLogin({
        telegramUserId: sender.id,
        phoneNumber: message.contact.phone_number,
        firstName: message.contact.first_name || sender.first_name,
        lastName: message.contact.last_name || sender.last_name,
        username: sender.username,
      });
      await this.sendMessage(
        message.chat.id,
        'Telefon raqamingiz tasdiqlandi. QUIZ ARENA akkauntingiz tayyor. Ilovani ochish uchun quyidagi tugmani bosing. Havola 90 soniya amal qiladi.',
        {
          inline_keyboard: [[{ text: '🚀 QUIZ ARENA ilovasini ochish', url: result.deepLink }]],
        },
      );
    } catch (error) {
      const messageText = error instanceof Error
        ? error.message
        : 'Ro‘yxatdan o‘tishni yakunlab bo‘lmadi. Qayta urinib ko‘ring.';
      await this.sendMessage(message.chat.id, messageText);
    }
  }
}
