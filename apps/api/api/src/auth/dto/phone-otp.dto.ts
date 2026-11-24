import {
  IsEmail,
  IsOptional,
  IsString,
  Matches,
  MaxLength,
  MinLength,
} from 'class-validator';

export class PhoneOtpRequestDto {
  @IsString()
  @Matches(/^\+?998\d{9}$/, { message: 'Telefon raqam +998XXXXXXXXX formatida bo‘lishi kerak' })
  phoneNumber: string;
}

export class PhoneOtpVerifyDto extends PhoneOtpRequestDto {
  @IsString()
  @Matches(/^\d{6}$/, { message: 'Tasdiqlash kodi 6 ta raqamdan iborat bo‘lishi kerak' })
  code: string;
}

export class PhoneRegisterDto extends PhoneOtpVerifyDto {
  @IsString()
  @MinLength(2)
  @MaxLength(100)
  displayName: string;

  @IsString()
  @Matches(/^[a-zA-Z0-9_]{3,30}$/)
  username: string;

  @IsString()
  @MinLength(8)
  @MaxLength(72)
  password: string;

  @IsOptional()
  @IsEmail()
  @MaxLength(255)
  email?: string;
}

export class PasswordResetDto extends PhoneOtpVerifyDto {
  @IsString()
  @MinLength(8)
  @MaxLength(72)
  newPassword: string;
}

export class GoogleAuthDto {
  @IsString()
  @MinLength(20)
  idToken: string;
}
