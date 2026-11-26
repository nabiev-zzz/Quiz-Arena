import { Body, Controller, Get, Param, Post, Query, Request, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { DirectMessagesService } from './direct-messages.service';
import { DirectMessagesGateway } from './direct-messages.gateway';

interface AuthRequest { user: { id: string } }

@Controller('api/direct')
@UseGuards(JwtAuthGuard)
export class DirectMessagesController {
  constructor(private readonly direct: DirectMessagesService, private readonly gateway: DirectMessagesGateway) {}

  @Get('conversations')
  conversations(@Request() req: AuthRequest) { return this.direct.listConversations(req.user.id); }

  @Post('conversations/:userId')
  start(@Request() req: AuthRequest, @Param('userId') userId: string) { return this.direct.startConversation(req.user.id, userId); }

  @Get('conversations/:id/messages')
  messages(@Request() req: AuthRequest, @Param('id') id: string, @Query('before') before?: string) {
    return this.direct.listMessages(req.user.id, id, before);
  }

  @Post('conversations/:id/messages')
  async send(@Request() req: AuthRequest, @Param('id') id: string, @Body() body: { content?: string }) {
    const result = await this.direct.sendMessage(req.user.id, id, body?.content ?? '');
    this.gateway.notifyMessage(req.user.id, result.recipientId, result.message);
    return result.message;
  }

  @Post('conversations/:id/read')
  async read(@Request() req: AuthRequest, @Param('id') id: string) {
    const result = await this.direct.markRead(req.user.id, id);
    this.gateway.notifyRead(result.otherUserId, id);
    return { updated: result.updated };
  }
}
