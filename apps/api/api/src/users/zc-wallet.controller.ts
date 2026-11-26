import { Controller, Get, Query, Request, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { ZcWalletService } from './zc-wallet.service';

interface AuthRequest { user: { id: string } }

@Controller('api/wallet')
@UseGuards(JwtAuthGuard)
export class ZcWalletController {
  constructor(private readonly wallet: ZcWalletService) {}

  @Get('zc/history')
  history(
    @Request() request: AuthRequest,
    @Query('limit') limit?: string,
    @Query('offset') offset?: string,
  ) {
    return this.wallet.history(request.user.id, Number(limit) || 30, Number(offset) || 0);
  }
}
