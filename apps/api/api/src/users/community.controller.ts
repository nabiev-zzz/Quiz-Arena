import { Body, Controller, Delete, Get, Headers, Param, Post, Put, Query, Request, UseGuards } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CommunityService } from './community.service';
interface AuthRequest { user: { id: string }; body?: Buffer }

@Controller('api/community')
@UseGuards(JwtAuthGuard)
export class CommunityController {
  constructor(private readonly community: CommunityService, private readonly jwt: JwtService) {}
  @Post('media/upload-key')
  uploadKey(@Request() request: AuthRequest, @Body() body: { contentType?: string }) { return this.community.createUploadFileName(request.user.id, body?.contentType ?? ''); }
  @Post('media/verify')
  verifyMedia(@Request() request: AuthRequest, @Body() body: { mediaKey?: string; contentType?: string; expectedSize?: number }) {
    return this.community.verifyMedia(request.user.id, body?.mediaKey ?? '', body?.contentType ?? '', Number(body?.expectedSize));
  }
  @Put('media/upload/:fileName')
  uploadMedia(@Request() request: AuthRequest, @Param('fileName') fileName: string, @Headers('content-type') contentType: string) {
    return this.community.uploadMedia(request.user.id, fileName, contentType, request.body as Buffer);
  }
  @Get('clips')
  clips(@Request() request: AuthRequest, @Query('limit') limit?: string, @Query('offset') offset?: string) { return this.community.clips(request.user.id, Number(limit) || 30, Number(offset) || 0); }
  @Get('clips/:id/playback')
  async clipPlayback(@Param('id') id: string) {
    const asset = await this.community.getClipPlaybackAsset(id);
    const token = await this.jwt.signAsync({ purpose: 'community-clip-playback', postId: id, mediaKey: asset.mediaKey, sub: asset.userId }, { expiresIn: 600 });
    return { url: `/api/community/media/playback/${token}`, mediaType: 'video/mp4' };
  }
  @Post('clips')
  createClip(@Request() request: AuthRequest, @Body() body: { content?: string; mediaKey?: string; mediaType?: string; subject?: string }) {
    return this.community.createClip(request.user.id, body?.content ?? '', body?.mediaKey ?? '', body?.mediaType ?? '', body?.subject);
  }
  @Post('clips/:id/save')
  saveClip(@Request() request: AuthRequest, @Param('id') id: string) { return this.community.saveClip(request.user.id, id); }
  @Delete('clips/:id/save')
  unsaveClip(@Request() request: AuthRequest, @Param('id') id: string) { return this.community.unsaveClip(request.user.id, id); }
  @Get('clips/:id/quiz')
  getClipQuiz(@Request() request: AuthRequest, @Param('id') id: string) { return this.community.getClipQuiz(request.user.id,id); }
  @Post('clips/:id/quiz')
  createClipQuiz(@Request() request: AuthRequest, @Param('id') id: string, @Body() body: { question?: string; options?: string[]; correctOption?: number }) { return this.community.createClipQuiz(request.user.id,id,body); }
  @Post('clips/:id/quiz/answer')
  answerClipQuiz(@Request() request: AuthRequest, @Param('id') id: string, @Body() body: { selectedOption?: number }) { return this.community.answerClipQuiz(request.user.id,id,body?.selectedOption); }
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
  addComment(@Request() request: AuthRequest, @Param('id') id: string, @Body() body: { content?: string; parentId?: string }) {
    return this.community.addComment(request.user.id, id, body?.content ?? '', body?.parentId);
  }
}
