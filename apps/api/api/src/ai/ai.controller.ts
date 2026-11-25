
import {
  Body,
  Controller,
  Get,
  Post,
  Param,
  Request,
  UseGuards,
} from '@nestjs/common';

import { AiService } from './ai.service';
import { AiTutorService } from './ai-tutor.service';
import { GenerateQuestionsDto } from './dto/generate-questions.dto';
import { AiTutorMessageDto } from './dto/ai-tutor-message.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { AiGenerationQueueService } from './queue/ai-generation-queue.service';

interface AuthenticatedRequest {
  user: {
    id: string;
  };
}

@Controller('api/ai')
export class AiController {
  constructor(
    private readonly aiService: AiService,
    private readonly aiTutorService: AiTutorService,
    private readonly aiQueue: AiGenerationQueueService,
  ) {}

  @UseGuards(JwtAuthGuard)
  @Post('generate')
  async generateQuestions(@Request() request: AuthenticatedRequest, @Body() body: GenerateQuestionsDto) {
    return this.aiQueue.enqueue({
      userId: request.user.id,
      jobType: 'ai_generate',
      payload: body as unknown as Record<string, unknown>,
      idempotencyKey: `generate:${JSON.stringify(body)}`,
    });
  }

  @UseGuards(JwtAuthGuard)
  @Get('jobs/:jobId')
  getAiJobStatus(@Request() request: AuthenticatedRequest, @Param('jobId') jobId: string) {
    return this.aiQueue.getStatus(request.user.id, jobId);
  }

  @UseGuards(JwtAuthGuard)
  @Get('tutor/progress')
  async getTutorProgress(@Request() request: AuthenticatedRequest) {
    return this.aiTutorService.getStudentProgress(request.user.id);
  }

  @UseGuards(JwtAuthGuard)
  @Post('tutor/chat')
  async sendTutorMessage(
    @Request() request: AuthenticatedRequest,
    @Body() body: AiTutorMessageDto,
  ) {
    return this.aiTutorService.enqueueMessage(
      request.user.id,
      body.message,
      body.language ?? 'uz',
    );
  }

  @UseGuards(JwtAuthGuard)
  @Get('tutor/history')
  async getTutorHistory(
    @Request() request: AuthenticatedRequest,
  ) {
    return this.aiTutorService.getHistory(request.user.id);
  }
}
