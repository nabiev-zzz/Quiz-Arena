import { Controller, Get, Headers, Param, Res, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { Readable } from 'node:stream';
import type { Response } from 'express';
import { CommunityService } from './community.service';

interface PlaybackClaims { purpose: string; postId: string; mediaKey: string; sub: string }

// Video elements cannot attach the app's Bearer token. A short-lived signed URL
// authorizes this narrowly scoped, byte-range-aware stream endpoint instead.
@Controller('api/community/media')
export class CommunityPlaybackController {
  constructor(private readonly jwt: JwtService, private readonly community: CommunityService) {}

  @Get('playback/:token')
  async stream(@Param('token') token: string, @Headers('range') range: string | undefined, @Res() response: Response) {
    let claims: PlaybackClaims;
    try {
      claims = await this.jwt.verifyAsync<PlaybackClaims>(token);
    } catch {
      throw new UnauthorizedException('Video havolasi muddati tugagan. Qayta oching.');
    }
    if (claims.purpose !== 'community-clip-playback' || !claims.postId || !claims.mediaKey || !claims.sub) {
      throw new UnauthorizedException('Video havolasi yaroqsiz');
    }
    const stream = await this.community.getClipPlaybackStream(claims.sub, claims.postId, claims.mediaKey, range);
    response.status(stream.status);
    response.setHeader('Content-Type', stream.contentType);
    response.setHeader('Accept-Ranges', stream.acceptRanges);
    response.setHeader('Cache-Control', 'private, max-age=300');
    if (stream.contentLength) response.setHeader('Content-Length', stream.contentLength);
    if (stream.contentRange) response.setHeader('Content-Range', stream.contentRange);
    if (!stream.body) return response.end();
    Readable.fromWeb(stream.body as import('node:stream/web').ReadableStream).pipe(response);
  }
}
