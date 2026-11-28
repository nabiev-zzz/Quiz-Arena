import { Body, Controller, Get, Param, Post, Query, Request, UseGuards } from '@nestjs/common';
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
  @Get('admin/users')
  adminSearchUsers(@Request() request: AuthRequest, @Query('q') query = '') { return this.subscriptionsService.adminSearchUsers(request.user.id, query); }

  @UseGuards(JwtAuthGuard)
  @Post('admin/grant')
  adminGrant(@Request() request: AuthRequest, @Body() body: { username: string; zcAmount?: number; planKey?: string; durationDays?: number }) { return this.subscriptionsService.adminGrant(request.user.id, body); }

  @UseGuards(JwtAuthGuard)
  @Post('admin/revoke')
  adminRevoke(@Request() request: AuthRequest, @Body() body: { username: string; zcAmount?: number; premium?: boolean }) { return this.subscriptionsService.adminRevoke(request.user.id, body); }

  @UseGuards(JwtAuthGuard)
  @Post('admin/qa-tester/grant')
  grantQaTester(@Request() request: AuthRequest) {
    return this.subscriptionsService.grantQaTester(request.user.id);
  }

  @UseGuards(JwtAuthGuard)
  @Get('usage/:featureKey')
  featureUsage(@Request() request: AuthRequest, @Param('featureKey') featureKey: string) {
    return this.featureUsageService.usage(request.user.id, featureKey);
  }

  @UseGuards(JwtAuthGuard)
  @Post('usage/:featureKey')
  consumeFeature(@Request() request: AuthRequest, @Param('featureKey') featureKey: string) {
    return this.featureUsageService.consume(request.user.id, featureKey);
  }
}
