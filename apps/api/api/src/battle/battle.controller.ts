
import {
  Controller,
  Get,
  Param,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';

import { BattleService } from './battle.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';

interface AuthenticatedRequest {
  user: {
    id: string;
  };
}

@Controller('api/battle')
@UseGuards(JwtAuthGuard)
export class BattleController {
  constructor(private readonly battleService: BattleService) {}

  @Get('status')
  getStatus() {
    return this.battleService.getStatus();
  }

  @Get('history/:matchId')
  getHistoryDetail(
    @Req() request: AuthenticatedRequest,
    @Param('matchId') matchId: string,
  ) {
    return this.battleService.getHistoryDetail(request.user.id, matchId);
  }

  @Get('history')
  getHistory(
    @Req() request: AuthenticatedRequest,
    @Query('limit') limit?: string,
  ) {
    return this.battleService.getHistory(
      request.user.id,
      Number(limit) || 20,
    );
  }

  @Get('stats')
  getStats(@Req() request: AuthenticatedRequest) {
    return this.battleService.getStats(request.user.id);
  }

  @Get('leaderboard')
  getLeaderboard(@Query('limit') limit?: string) {
    return this.battleService.getLeaderboard(Number(limit) || 50);
  }
}
