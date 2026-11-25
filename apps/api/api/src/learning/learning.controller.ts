import {
  Body,
  Controller,
  Get,
  Post,
  Patch,
  Param,
  Request,
  UseGuards,
  UploadedFile,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { LearningService } from './learning.service';
import type { CreateLearningAttemptInput } from './learning.service';
import { GetTopicQuestionsDto } from './dto/get-topic-questions.dto';
import { SubmitWebLearningAttemptDto } from './dto/submit-web-learning-attempt.dto';
import { AiGenerationQueueService } from '../ai/queue/ai-generation-queue.service';

interface AuthenticatedRequest {
  user: { id: string };
}

@Controller('api/learning')
@UseGuards(JwtAuthGuard)
export class LearningController {
  constructor(
    private readonly learningService: LearningService,
    private readonly aiQueue: AiGenerationQueueService,
  ) {}

  @Get('catalog')
  getCatalog() {
    return this.learningService.getCatalog();
  }

  @Post('smart-practice')
  createSmartPractice(
    @Request() request: AuthenticatedRequest,
    @Body() body: { count?: string; language?: string },
  ) {
    return this.learningService.createSmartPractice(request.user.id, body);
  }

  @Post('document-quiz')
  @UseInterceptors(FileInterceptor('file', { limits: { fileSize: 15 * 1024 * 1024 } }))
  createDocumentQuiz(
    @Request() request: AuthenticatedRequest,
    @UploadedFile() file: { buffer: Buffer; originalname: string; mimetype: string; size: number },
    @Body() body: { count?: string; difficulty?: string; language?: string },
  ) {
    return this.learningService.createDocumentQuiz(request.user.id, file, body);
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
  getTopicQuestions(@Request() request: AuthenticatedRequest, @Body() body: GetTopicQuestionsDto) {
    return this.learningService.getTopicQuestions(body, false, request.user.id);
  }

  @Get('jobs/:jobId')
  getAiJobStatus(@Request() request: AuthenticatedRequest, @Param('jobId') jobId: string) {
    return this.aiQueue.getStatus(request.user.id, jobId);
  }

  @Get('attempts')
  getHistory(@Request() request: AuthenticatedRequest) {
    return this.learningService.getHistory(request.user.id);
  }

  @Get('attempts/:attemptId')
  getHistoryItem(
    @Request() request: AuthenticatedRequest,
    @Param('attemptId') attemptId: string,
  ) {
    return this.learningService.getHistoryItem(request.user.id, attemptId);
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
