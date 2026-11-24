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
