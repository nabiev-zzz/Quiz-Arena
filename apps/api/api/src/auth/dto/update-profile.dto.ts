import {
  IsOptional,
  IsString,
  IsIn,
  Matches,
  MaxLength,
  MinLength,
} from 'class-validator';

export class UpdateProfileDto {
  @IsOptional()
  @IsString()
  @MinLength(2)
  @MaxLength(100)
  displayName?: string;

  @IsOptional()
  @IsString()
  @MinLength(3)
  @MaxLength(30)
  @Matches(/^[a-zA-Z0-9_]+$/, {
    message: 'Username faqat lotin harflari, raqamlar va _ belgisidan iborat bo‘lishi kerak',
  })
  username?: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  bio?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(900_000)
  @Matches(/^(https:\/\/\S+|data:image\/(?:jpeg|png|webp);base64,[A-Za-z0-9+/]+={0,2})$/, {
    message: 'Avatar manzili yoki rasm formati noto‘g‘ri',
  })
  avatarUrl?: string | null;

  @IsOptional()
  @IsString()
  @IsIn(['sparkle', 'crown', 'laurel', 'star'])
  avatarDecoration?: string | null;

  @IsOptional()
  @IsString()
  @IsIn(['aurora', 'royal', 'ocean', 'neon3d', 'inferno3d', 'frost3d', 'galaxy3d'])
  profileFrame?: string | null;

  @IsOptional()
  @IsString()
  @IsIn(['legend', 'champion', 'scholar', 'streak'])
  profileBadge?: string | null;
}