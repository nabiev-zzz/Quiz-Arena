import {
  Body,
  Controller,
  Get,
  Post,
  Patch,
  Param,
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
  getWebTopicQuestions(
    @Request() request: AuthenticatedRequest,
    @Body() body: GetTopicQuestionsDto,
  ) {
    return this.learningService.getWebTopicQuestions(request.user.id, body);
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

  @Get('attempts')
  getHistory(@Request() request: AuthenticatedRequest) {
    return this.learningService.getHistory(request.user.id);
  }

  @Patch('attempts/:attemptId/review')
  updateAttemptReview(
    @Request() request: AuthenticatedRequest,
    @Param('attemptId') attemptId: string,
    @Body() body: { review: unknown[] },
  ) {
    return this.learningService.updateAttemptReview(request.user.id, attemptId, body.review);
  }

  @Post('attempts')
  createAttempt(
    @Request() request: AuthenticatedRequest,
    @Body() body: CreateLearningAttemptInput,
  ) {
    return this.learningService.createAttempt(request.user.id, body);
  }

  @Get('progress')
  getTopicProgress(@Request() request: AuthenticatedRequest) {
    return this.learningService.getTopicProgress(request.user.id);
  }

  @Get('stats')
  getStats(@Request() request: AuthenticatedRequest) {
    return this.learningService.getStats(request.user.id);
  }
}
