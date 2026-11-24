import { Type } from 'class-transformer';
import { ArrayMaxSize, ArrayMinSize, IsArray, IsInt, IsString, Max, MaxLength, Min, MinLength, ValidateNested } from 'class-validator';

export class WebLearningAnswerDto {
  @IsString()
  @MinLength(1)
  @MaxLength(80)
  questionId: string;

  @IsInt()
  @Min(0)
  @Max(3)
  selectedAnswer: number;
}

export class SubmitWebLearningAttemptDto {
  @IsString()
  @MinLength(1)
  @MaxLength(80)
  subjectId: string;

  @IsString()
  @MinLength(1)
  @MaxLength(100)
  topicId: string;

  @IsString()
  @MinLength(2)
  @MaxLength(5)
  language: 'uz' | 'ru' | 'en';

  @IsString()
  @MinLength(3)
  @MaxLength(20)
  difficulty: 'easy' | 'medium' | 'hard' | 'expert';

  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(20)
  @ValidateNested({ each: true })
  @Type(() => WebLearningAnswerDto)
  answers: WebLearningAnswerDto[];
}
