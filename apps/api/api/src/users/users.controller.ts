import { Controller, Delete, Get, Param, Post, Query, Request, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { UsersService } from './users.service';

interface AuthRequest { user: { id: string } }

@Controller('api/users')
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @UseGuards(JwtAuthGuard)
  @Get('friends')
  friends(@Request() request: AuthRequest) {
    return this.usersService.friends(request.user.id);
  }

  @UseGuards(JwtAuthGuard)
  @Get('suggestions')
  suggestions(@Request() request: AuthRequest, @Query('limit') limit?: string) {
    return this.usersService.suggestions(request.user.id, Number(limit) || 12);
  }

  @UseGuards(JwtAuthGuard)
  @Get('profile/:username')
  publicProfile(@Param('username') username: string, @Request() request: AuthRequest) {
    return this.usersService.publicProfile(username, request.user.id);
  }

  @Get(':id/followers')
  followers(@Param('id') id: string) {
    return this.usersService.followers(id);
  }

  @Get(':id/following')
  following(@Param('id') id: string) {
    return this.usersService.following(id);
  }

  @UseGuards(JwtAuthGuard)
  @Post(':id/follow')
  follow(@Request() request: AuthRequest, @Param('id') id: string) {
    return this.usersService.follow(request.user.id, id);
  }

  @UseGuards(JwtAuthGuard)
  @Delete(':id/follow')
  unfollow(@Request() request: AuthRequest, @Param('id') id: string) {
    return this.usersService.unfollow(request.user.id, id);
  }
}
