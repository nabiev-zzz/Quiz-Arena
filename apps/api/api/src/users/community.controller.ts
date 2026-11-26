import { Body, Controller, Get, Param, Post, Query, Request, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CommunityService } from './community.service';

interface AuthRequest { user: { id: string } }

@Controller('api/community')
@UseGuards(JwtAuthGuard)
export class CommunityController {
  constructor(private readonly community: CommunityService) {}

  @Get('posts')
  feed(@Request() request: AuthRequest, @Query('limit') limit?: string) {
    return this.community.feed(request.user.id, Number(limit) || 30);
  }

  @Post('posts')
  createPost(@Request() request: AuthRequest, @Body() body: { content?: string }) {
    return this.community.createPost(request.user.id, body?.content ?? '');
  }

  @Post('posts/:id/like')
  like(@Request() request: AuthRequest, @Param('id') id: string) {
    return this.community.toggleLike(request.user.id, id, true);
  }

  @Post('posts/:id/unlike')
  unlike(@Request() request: AuthRequest, @Param('id') id: string) {
    return this.community.toggleLike(request.user.id, id, false);
  }

  @Get('posts/:id/comments')
  comments(@Param('id') id: string) {
    return this.community.listComments(id);
  }

  @Post('posts/:id/comments')
  addComment(@Request() request: AuthRequest, @Param('id') id: string, @Body() body: { content?: string }) {
    return this.community.addComment(request.user.id, id, body?.content ?? '');
  }
}
