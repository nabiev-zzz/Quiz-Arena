import {
  Body,
  Controller,
  Get,
  Post,
  Request,
  UseGuards,
} from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { LearningService } from './learning.service';
import type { CreateLearningAttemptInput } from './learning.service';
import { GetTopicQuestionsDto } from './dto/get-topic-questions.dto';
import { SubmitWebLearningAttemptDto } from './dto/submit-web-learning-attempt.dto';

interface AuthenticatedRequest {
  user: { id: string };
}

@Controller('api/learning')
@UseGuards(JwtAuthGuard)
export class LearningController {
  constructor(private readonly learningService: LearningService) {}

  @Get('catalog')
  getCatalog() {
    return this.learningService.getCatalog();
  }

  @Post('web/questions')
  getWebTopicQuestions(@Body() body: GetTopicQuestionsDto) {
    return this.learningService.getWebTopicQuestions(body);
  }

  @Post('web/attempts')
  submitWebAttempt(
    @Request() request: AuthenticatedRequest,
    @Body() body: SubmitWebLearningAttemptDto,
  ) {
    return this.learningService.submitWebAttempt(request.user.id, body);
  }

  @Post('questions')
  getTopicQuestions(@Body() body: GetTopicQuestionsDto) {
    return this.learningService.getTopicQuestions(body);
  }

  @Post('attempts')
  createAttempt(
    @Request() request: AuthenticatedRequest,
    @Body() body: CreateLearningAttemptInput,
  ) {
    return this.learningService.createAttempt(request.user.id, body);
  }

  @Get('stats')
  getStats(@Request() request: AuthenticatedRequest) {
    return this.learningService.getStats(request.user.id);
  }
}
