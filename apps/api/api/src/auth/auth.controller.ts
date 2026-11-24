import {
  Body,
  Controller,
  Get,
  Patch,
  Post,
  Query,
  Request,
  Res,
  UseGuards,
} from '@nestjs/common';
import type { Response } from 'express';

import { AuthService } from './auth.service';
import { EmailAuthService } from './email-auth.service';
import { EmailCodeDto, EmailPasswordResetDto, EmailRequestDto } from './dto/email-auth.dto';
import { RegisterDto } from './dto/register.dto';
import { LoginDto } from './dto/login.dto';
import { UpdateProfileDto } from './dto/update-profile.dto';
import {
  GoogleAuthDto,
  GoogleCodeExchangeDto,
  PasswordResetDto,
  PhoneOtpRequestDto,
  PhoneOtpVerifyDto,
  PhoneRegisterDto,
} from './dto/phone-otp.dto';
import { JwtAuthGuard } from './guards/jwt-auth.guard';

interface AuthenticatedRequest {
  user: { id: string };
}

@Controller('api/auth')
export class AuthController {
  constructor(
    private readonly authService: AuthService,
    private readonly emailAuthService: EmailAuthService,
  ) {}

  @Post('register')
  register(@Body() dto: RegisterDto) {
    return this.authService.register(dto);
  }

  @Post('email/verification/request')
  requestEmailVerification(@Body() dto: EmailRequestDto) {
    return this.emailAuthService.requestVerification(dto.email);
  }

  @Post('email/verify')
  verifyEmail(@Body() dto: EmailCodeDto) {
    return this.emailAuthService.verifyEmail(dto.email, dto.code);
  }

  @Post('email/password-reset/request')
  requestEmailPasswordReset(@Body() dto: EmailRequestDto) {
    return this.emailAuthService.requestPasswordReset(dto.email);
  }

  @Post('email/password-reset')
  resetEmailPassword(@Body() dto: EmailPasswordResetDto) {
    return this.emailAuthService.resetPassword(dto.email, dto.code, dto.newPassword);
  }

  @Post('login')
  login(@Body() dto: LoginDto) {
    return this.authService.login(dto);
  }

  @Post('phone/register/request-otp')
  requestRegistrationOtp(@Body() dto: PhoneOtpRequestDto) {
    return this.authService.requestRegistrationOtp(dto.phoneNumber);
  }

  @Post('phone/register')
  registerWithPhone(@Body() dto: PhoneRegisterDto) {
    return this.authService.registerWithPhone(dto);
  }

  @Post('phone/password-reset/request-otp')
  requestPasswordReset(@Body() dto: PhoneOtpRequestDto) {
    return this.authService.requestPasswordReset(dto.phoneNumber);
  }

  @Post('phone/password-reset')
  resetPassword(@Body() dto: PasswordResetDto) {
    return this.authService.resetPassword(dto);
  }

  @UseGuards(JwtAuthGuard)
  @Post('phone/link/request-otp')
  requestPhoneLink(
    @Request() request: AuthenticatedRequest,
    @Body() dto: PhoneOtpRequestDto,
  ) {
    return this.authService.requestPhoneLink(request.user.id, dto.phoneNumber);
  }

  @UseGuards(JwtAuthGuard)
  @Post('phone/link')
  linkPhone(
    @Request() request: AuthenticatedRequest,
    @Body() dto: PhoneOtpVerifyDto,
  ) {
    return this.authService.linkPhone(request.user.id, dto.phoneNumber, dto.code);
  }

  @Post('phone/login/request-otp')
  requestPhoneLogin(@Body() dto: PhoneOtpRequestDto) {
    return this.authService.requestPhoneLogin(dto.phoneNumber);
  }

  @Post('phone/login')
  loginWithPhone(@Body() dto: PhoneOtpVerifyDto) {
    return this.authService.loginWithPhone(dto.phoneNumber, dto.code);
  }

  @Get('telegram/start')
  async telegramStart(@Res() response: Response) {
    response.redirect(302, await this.authService.getTelegramAuthorizationUrl());
  }

  @Get('telegram/callback')
  async telegramCallback(
    @Query('code') code: string,
    @Query('state') state: string,
    @Res() response: Response,
  ) {
    try {
      const appUrl = await this.authService.handleTelegramCallback(code, state);
      response.redirect(302, appUrl);
    } catch {
      response.redirect(302, 'quizarena://auth?error=telegram_sign_in_failed');
    }
  }

  @Post('telegram/exchange')
  exchangeTelegramCode(@Body() dto: GoogleCodeExchangeDto) {
    return this.authService.exchangeTelegramCode(dto.code);
  }

  @Get('google/start')
  async googleStart(@Res() response: Response) {
    response.redirect(302, await this.authService.getGoogleAuthorizationUrl());
  }

  @Get('google/callback')
  async googleCallback(
    @Query('code') code: string,
    @Query('state') state: string,
    @Res() response: Response,
  ) {
    try {
      const appUrl = await this.authService.handleGoogleCallback(code, state);
      response.redirect(302, appUrl);
    } catch {
      response.redirect(302, 'quizarena://auth?error=google_sign_in_failed');
    }
  }

  @Post('google/exchange')
  exchangeGoogleCode(@Body() dto: GoogleCodeExchangeDto) {
    return this.authService.exchangeGoogleCode(dto.code);
  }

  @Post('google')
  loginWithGoogle(@Body() dto: GoogleAuthDto) {
    return this.authService.loginWithGoogle(dto.idToken);
  }

  @UseGuards(JwtAuthGuard)
  @Get('me')
  getProfile(@Request() request: AuthenticatedRequest) {
    return this.authService.getProfile(request.user.id);
  }

  @UseGuards(JwtAuthGuard)
  @Patch('profile')
  updateProfile(
    @Request() request: AuthenticatedRequest,
    @Body() dto: UpdateProfileDto,
  ) {
    return this.authService.updateProfile(request.user.id, dto);
  }
}
