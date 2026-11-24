import { IsIn, IsInt, IsString, Max, MaxLength, Min, MinLength } from 'class-validator';

export class GetTopicQuestionsDto {
  @IsString()
  @MinLength(1)
  @MaxLength(80)
  subjectId: string;

  @IsString()
  @MinLength(1)
  @MaxLength(100)
  topicId: string;

  @IsInt()
  @Min(1)
  @Max(20)
  count: number;

  @IsIn(['easy', 'medium', 'hard', 'expert'])
  difficulty: 'easy' | 'medium' | 'hard' | 'expert';

  @IsIn(['uz', 'ru', 'en'])
  language: 'uz' | 'ru' | 'en';
}
