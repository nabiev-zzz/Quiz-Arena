import {
  Body,
  Controller,
  Delete,
  Catch,
  ExceptionFilter,
  ArgumentsHost,
  UseFilters,
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

@Catch()
class DocumentUploadExceptionFilter implements ExceptionFilter {
  catch(error: unknown, host: ArgumentsHost) {
    const response = host.switchToHttp().getResponse();
    const candidate = error as { code?: string; getStatus?: () => number; getResponse?: () => unknown; message?: string };
    const tooLarge = candidate?.code === 'LIMIT_FILE_SIZE';
    const status = tooLarge ? 413 : typeof candidate?.getStatus === 'function' ? candidate.getStatus() : candidate?.code ? 400 : 500;
    const body = typeof candidate?.getResponse === 'function' ? candidate.getResponse() : undefined;
    const bodyMessage = body && typeof body === 'object' && 'message' in body ? (body as { message?: unknown }).message : body;
    const message = tooLarge ? 'Fayl hajmi 20 MB dan oshmasligi kerak.'
      : typeof bodyMessage === 'string' ? bodyMessage
      : Array.isArray(bodyMessage) ? bodyMessage.join('; ')
      : status >= 500 ? 'Serverda xatolik yuz berdi. Keyinroq qayta urinib ko‘ring.'
      : 'Faylni yuklashda xatolik yuz berdi. Qayta urinib ko‘ring.';
    response.status(status).json({ statusCode: status, message });
  }
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
  @UseFilters(new DocumentUploadExceptionFilter())
  @UseInterceptors(FileInterceptor('file', { limits: { fileSize: 20 * 1024 * 1024 } }))
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

  @Delete('jobs/:jobId')
  cancelAiJob(@Request() request: AuthenticatedRequest, @Param('jobId') jobId: string) {
    return this.aiQueue.cancelJob(request.user.id, jobId);
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
