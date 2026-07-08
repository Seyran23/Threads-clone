import { Controller, Delete, HttpCode, HttpStatus, Param, Post, UseGuards } from '@nestjs/common';
import { ApiCookieAuth, ApiTags } from '@nestjs/swagger';

import { CurrentUser } from '@/common/decorators/current-user.decorator';
import { JwtAuthGuard } from '@/common/guards/jwt-auth.guard';

import { FollowsService } from './follows.service';
import { FollowResponse } from './response/follow.response';

@ApiTags('follows')
@ApiCookieAuth()
@Controller('follows')
@UseGuards(JwtAuthGuard)
export class FollowsController {
  constructor(private readonly followsService: FollowsService) {}

  @Post(':userId')
  @HttpCode(HttpStatus.CREATED)
  followUser(
    @CurrentUser() user: { id: string },
    @Param('userId') userId: string,
  ): Promise<FollowResponse> {
    return this.followsService.followUser(user.id, userId);
  }

  @Delete(':userId')
  @HttpCode(HttpStatus.OK)
  unfollowUser(
    @CurrentUser() user: { id: string },
    @Param('userId') userId: string,
  ): Promise<FollowResponse> {
    return this.followsService.unfollowUser(user.id, userId);
  }
}
