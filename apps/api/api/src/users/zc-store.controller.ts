import { Body, Controller, Get, Post, Request, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { ZcStoreService } from './zc-store.service';

interface AuthRequest { user: { id: string } }

@Controller('api/store/zc')
@UseGuards(JwtAuthGuard)
export class ZcStoreController {
  constructor(private readonly store: ZcStoreService) {}

  @Get('catalog')
  catalog(@Request() request: AuthRequest) {
    return this.store.catalog(request.user.id);
  }

  @Get('inventory')
  inventory(@Request() request: AuthRequest) {
    return this.store.inventory(request.user.id);
  }

  @Post('purchase')
  purchase(@Request() request: AuthRequest, @Body() body: { itemId?: string }) {
    return this.store.purchase(request.user.id, String(body?.itemId ?? ''));
  }
}
