import { Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtModule } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import { TypeOrmModule } from '@nestjs/typeorm';

import { User } from '../users/entities/user.entity';
import { AuthOtp } from './entities/auth-otp.entity';
import { AuthOAuthCode } from './entities/auth-oauth-code.entity';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { AuthOtpService } from './auth-otp.service';
import { JwtStrategy } from './strategies/jwt.strategy';

@Module({
  imports: [
    TypeOrmModule.forFeature([User, AuthOtp, AuthOAuthCode]),
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
  providers: [AuthService, AuthOtpService, JwtStrategy],
  exports: [AuthService, JwtModule, PassportModule],
})
export class AuthModule {}
