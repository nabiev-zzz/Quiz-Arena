import { Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtModule } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import { TypeOrmModule } from '@nestjs/typeorm';

import { User } from '../users/entities/user.entity';
import { ZcStoreItem } from '../users/entities/zc-store-item.entity';
import { AuthOtp } from './entities/auth-otp.entity';
import { AuthOAuthCode } from './entities/auth-oauth-code.entity';
import { AuthEmailCode } from './entities/auth-email-code.entity';
import { TelegramBotAuthSession } from './entities/telegram-bot-auth-session.entity';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { TelegramBotService } from './telegram-bot.service';
import { AuthOtpService } from './auth-otp.service';
import { EmailAuthService } from './email-auth.service';
import { JwtStrategy } from './strategies/jwt.strategy';

@Module({
  imports: [
    TypeOrmModule.forFeature([User, ZcStoreItem, AuthOtp, AuthOAuthCode, AuthEmailCode, TelegramBotAuthSession]),
    PassportModule.register({ defaultStrategy: 'jwt' }),
    JwtModule.registerAsync({
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => ({
        secret: configService.getOrThrow<string>('JWT_SECRET'),
        signOptions: { expiresIn: 604800 },
      }),
    }),
  ],
  controllers: [AuthController],
  providers: [AuthService, AuthOtpService, EmailAuthService, TelegramBotService, JwtStrategy],
  exports: [AuthService, JwtModule, PassportModule],
})
export class AuthModule {}
