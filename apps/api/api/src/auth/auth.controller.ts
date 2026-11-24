import {
  Body,
  Controller,
  Get,
  Patch,
  Post,
  Request,
  UseGuards,
} from '@nestjs/common';

import { AuthService } from './auth.service';
import { RegisterDto } from './dto/register.dto';
import { LoginDto } from './dto/login.dto';
import { UpdateProfileDto } from './dto/update-profile.dto';
import {
  GoogleAuthDto,
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
  constructor(private readonly authService: AuthService) {}

  @Post('register')
  register(@Body() dto: RegisterDto) {
    return this.authService.register(dto);
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

  @Post('phone/login/request-otp')
  requestPhoneLogin(@Body() dto: PhoneOtpRequestDto) {
    return this.authService.requestPhoneLogin(dto.phoneNumber);
  }

  @Post('phone/login')
  loginWithPhone(@Body() dto: PhoneOtpVerifyDto) {
    return this.authService.loginWithPhone(dto.phoneNumber, dto.code);
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
