import { IsEmail, IsString, Matches, MaxLength, MinLength } from 'class-validator';

export class EmailCodeDto {
  @IsEmail()
  @MaxLength(255)
  email: string;

  @IsString()
  @Matches(/^\d{6}$/, { message: 'Kod 6 ta raqamdan iborat bo‘lishi kerak' })
  code: string;
}

export class EmailPasswordResetDto extends EmailCodeDto {
  @IsString()
  @MinLength(8)
  @MaxLength(72)
  newPassword: string;
}

export class EmailRequestDto {
  @IsEmail()
  @MaxLength(255)
  email: string;
}
