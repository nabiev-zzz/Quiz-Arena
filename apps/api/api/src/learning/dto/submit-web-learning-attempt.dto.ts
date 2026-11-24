import { Type } from 'class-transformer';
import { ArrayMaxSize, ArrayMinSize, IsArray, IsIn, IsInt, IsString, Max, MaxLength, Min, MinLength, IsUUID, ValidateNested } from 'class-validator';

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
  @IsUUID()
  sessionId: string;

  @IsString()
  @MinLength(1)
  @MaxLength(80)
  subjectId: string;

  @IsString()
  @MinLength(1)
  @MaxLength(100)
  topicId: string;

  @IsIn(['uz', 'ru', 'en'])
  language: 'uz' | 'ru' | 'en';

  @IsIn(['easy', 'medium', 'hard', 'expert'])
  difficulty: 'easy' | 'medium' | 'hard' | 'expert';

  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(20)
  @ValidateNested({ each: true })
  @Type(() => WebLearningAnswerDto)
  answers: WebLearningAnswerDto[];
}
