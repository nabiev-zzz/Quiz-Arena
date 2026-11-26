import { Controller, Get, Param, Patch, Request, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { NotificationsService } from './notifications.service';

interface AuthRequest { user: { id: string } }
@Controller('api/notifications')
@UseGuards(JwtAuthGuard)
export class NotificationsController {
  constructor(private readonly notifications: NotificationsService) {}
  @Get() list(@Request() req: AuthRequest) { return this.notifications.list(req.user.id); }
  @Patch(':id/read') markRead(@Request() req: AuthRequest, @Param('id') id: string) { return this.notifications.markRead(req.user.id, id); }
  @Patch('read-all') markAllRead(@Request() req: AuthRequest) { return this.notifications.markAllRead(req.user.id); }
}
