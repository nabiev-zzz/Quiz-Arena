import { Controller, Get, Param, Post, Request, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { FeatureUsageService } from './feature-usage.service';
import { SubscriptionsService } from './subscriptions.service';

interface AuthRequest { user: { id: string } }

@Controller('api/subscriptions')
export class SubscriptionsController {
  constructor(
    private readonly subscriptionsService: SubscriptionsService,
    private readonly featureUsageService: FeatureUsageService,
  ) {}

  @Get('plans')
  plans() {
    return this.subscriptionsService.plans();
  }

  @UseGuards(JwtAuthGuard)
  @Get('me')
  current(@Request() request: AuthRequest) {
    return this.subscriptionsService.current(request.user.id);
  }

  @UseGuards(JwtAuthGuard)
  @Post('usage/:featureKey')
  consumeFeature(@Request() request: AuthRequest, @Param('featureKey') featureKey: string) {
    return this.featureUsageService.consume(request.user.id, featureKey);
  }
}
