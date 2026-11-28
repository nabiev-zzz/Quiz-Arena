import { BadRequestException, Body, Controller, Delete, Get, Param, Patch, Post, Query, Request, UseGuards } from '@nestjs/common';
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
  async send(@Request() req: AuthRequest, @Param('id') id: string, @Body() body: { content?: string; mediaKey?: string; mediaType?: string; mediaSize?: number; durationSeconds?: number; clientMessageId?: string }) {
    const result = await this.direct.sendMessage(req.user.id, id, body?.content ?? '', body);
    if (result.created) this.gateway.notifyMessage(req.user.id, result.recipientId, result.message);
    return result.message;
  }

  @Patch('conversations/:id/messages/:messageId')
  async edit(@Request() req: AuthRequest, @Param('id') id: string, @Param('messageId') messageId: string, @Body() body: { content?: string }) {
    const message = await this.direct.editMessage(req.user.id, id, messageId, body?.content ?? '');
    const conversation = await this.direct.getConversationParticipants(req.user.id, id);
    this.gateway.notifyMessageUpdated(req.user.id, conversation.otherUserId, message);
    return message;
  }

  @Delete('conversations/:id/messages/:messageId')
  async remove(@Request() req: AuthRequest, @Param('id') id: string, @Param('messageId') messageId: string, @Query('scope') scope = 'me') {
    if (scope !== 'me' && scope !== 'everyone') throw new BadRequestException('O‘chirish turi noto‘g‘ri');
    const message = await this.direct.deleteMessage(req.user.id, id, messageId, scope);
    if (scope === 'everyone') {
      const conversation = await this.direct.getConversationParticipants(req.user.id, id);
      this.gateway.notifyMessageDeleted([req.user.id, conversation.otherUserId], id, message);
    } else {
      this.gateway.notifyMessageDeleted([req.user.id], id, message);
    }
    return message;
  }

  @Get('conversations/:id/messages/:messageId/history')
  history(@Request() req: AuthRequest, @Param('id') id: string, @Param('messageId') messageId: string) {
    return this.direct.getMessageHistory(req.user.id, id, messageId);
  }

  // Keep the original route for already-installed clients that only know voice messages.
  @Get('conversations/:id/messages/:messageId/audio')
  audio(@Request() req: AuthRequest, @Param('id') id: string, @Param('messageId') messageId: string) {
    return this.direct.getAttachmentPlaybackUrl(req.user.id, id, messageId);
  }

  @Get('conversations/:id/messages/:messageId/attachment')
  attachment(@Request() req: AuthRequest, @Param('id') id: string, @Param('messageId') messageId: string) {
    return this.direct.getAttachmentPlaybackUrl(req.user.id, id, messageId);
  }

  @Post('conversations/:id/read')
  async read(@Request() req: AuthRequest, @Param('id') id: string) {
    const result = await this.direct.markRead(req.user.id, id);
    this.gateway.notifyRead(result.otherUserId, id);
    return { updated: result.updated };
  }
}
