import {
  Body,
  Controller,
  Get,
  Post,
  Request,
  UseGuards,
} from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import {
  CreateLearningAttemptInput,
  LearningService,
} from './learning.service';

interface AuthenticatedRequest {
  user: { id: string };
}

@Controller('api/learning')
@UseGuards(JwtAuthGuard)
export class LearningController {
  constructor(private readonly learningService: LearningService) {}

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
