
import {
  Body,
  Controller,
  Get,
  Post,
  Request,
  UseGuards,
} from '@nestjs/common';

import { AiService } from './ai.service';
import { AiTutorService } from './ai-tutor.service';
import { GenerateQuestionsDto } from './dto/generate-questions.dto';
import { AiTutorMessageDto } from './dto/ai-tutor-message.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';

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
  ) {}

  @Post('generate')
  async generateQuestions(@Body() body: GenerateQuestionsDto) {
    return {
      questions: await this.aiService.generateQuestions(body),
    };
  }

  @UseGuards(JwtAuthGuard)
  @Post('tutor/chat')
  async sendTutorMessage(
    @Request() request: AuthenticatedRequest,
    @Body() body: AiTutorMessageDto,
  ) {
    return this.aiTutorService.sendMessage(
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
