import { Body, Controller, Get, Headers, Param, Post, Put, Query, Request, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CommunityService } from './community.service';
interface AuthRequest { user: { id: string }; body?: Buffer }

@Controller('api/community')
@UseGuards(JwtAuthGuard)
export class CommunityController {
  constructor(private readonly community: CommunityService) {}
  @Post('media/upload-key')
  uploadKey(@Body() body: { contentType?: string }) { return this.community.createUploadFileName(body?.contentType ?? ''); }
  @Put('media/upload/:fileName')
  uploadMedia(@Request() request: AuthRequest, @Param('fileName') fileName: string, @Headers('content-type') contentType: string) {
    return this.community.uploadMedia(request.user.id, fileName, contentType, request.body as Buffer);
  }
  @Get('clips')
  clips(@Request() request: AuthRequest, @Query('limit') limit?: string) { return this.community.clips(request.user.id, Number(limit) || 30); }
  @Post('clips')
  createClip(@Request() request: AuthRequest, @Body() body: { content?: string; mediaKey?: string; mediaType?: string }) {
    return this.community.createClip(request.user.id, body?.content ?? '', body?.mediaKey ?? '', body?.mediaType ?? '');
  }
  @Get('posts')
  feed(@Request() request: AuthRequest, @Query('limit') limit?: string) { return this.community.feed(request.user.id, Number(limit) || 30); }
  @Post('posts')
  createPost(@Request() request: AuthRequest, @Body() body: { content?: string; mediaKey?: string; mediaType?: string }) {
    return this.community.createPost(request.user.id, body?.content ?? '', body?.mediaKey, body?.mediaType);
  }
  @Get('stories')
  stories(@Request() request: AuthRequest) { return this.community.listStories(request.user.id); }
  @Post('stories')
  createStory(@Request() request: AuthRequest, @Body() body: { mediaKey?: string; mediaType?: string; caption?: string }) {
    return this.community.createStory(request.user.id, body?.mediaKey ?? '', body?.mediaType ?? '', body?.caption);
  }
  @Post('stories/:id/view')
  viewStory(@Request() request: AuthRequest, @Param('id') id: string) { return this.community.markStoryViewed(request.user.id, id); }
  @Post('posts/:id/like')
  like(@Request() request: AuthRequest, @Param('id') id: string) { return this.community.toggleLike(request.user.id, id, true); }
  @Post('posts/:id/unlike')
  unlike(@Request() request: AuthRequest, @Param('id') id: string) { return this.community.toggleLike(request.user.id, id, false); }
  @Get('posts/:id/comments')
  comments(@Param('id') id: string) { return this.community.listComments(id); }
  @Post('posts/:id/comments')
  addComment(@Request() request: AuthRequest, @Param('id') id: string, @Body() body: { content?: string }) {
    return this.community.addComment(request.user.id, id, body?.content ?? '');
  }
}
