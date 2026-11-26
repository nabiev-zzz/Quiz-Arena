import { Body, Controller, Get, Post, Request, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { DailyTasksService } from './daily-tasks.service';

interface AuthRequest { user: { id: string } }

@Controller('api/daily-tasks')
@UseGuards(JwtAuthGuard)
export class DailyTasksController {
  constructor(private readonly dailyTasks: DailyTasksService) {}

  @Get()
  getToday(@Request() request: AuthRequest) {
    return this.dailyTasks.getToday(request.user.id);
  }

  @Post('claim')
  claim(@Request() request: AuthRequest, @Body() body: { taskId?: string }) {
    return this.dailyTasks.claim(request.user.id, String(body?.taskId ?? ''));
  }
}
