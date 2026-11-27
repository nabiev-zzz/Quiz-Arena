import { IsString, Length, Matches } from 'class-validator';

export class TelegramBotVerifyDto {
  @IsString()
  @Length(30, 40)
  sessionId: string;

  @IsString()
  @Matches(/^\d{6}$/)
  code: string;
}
