import { Controller, Get, Request, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { SubscriptionsService } from './subscriptions.service';

interface AuthRequest { user: { id: string } }

@Controller('api/subscriptions')
export class SubscriptionsController {
  constructor(private readonly subscriptionsService: SubscriptionsService) {}

  @Get('plans')
  plans() {
    return this.subscriptionsService.plans();
  }

  @UseGuards(JwtAuthGuard)
  @Get('me')
  current(@Request() request: AuthRequest) {
    return this.subscriptionsService.current(request.user.id);
  }
}
