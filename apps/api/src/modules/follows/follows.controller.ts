import { Controller, Delete, HttpCode, HttpStatus, Param, Post, UseGuards } from '@nestjs/common';
import { ApiCookieAuth, ApiTags } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';

import { CurrentUser } from '@/common/decorators/current-user.decorator';
import { JwtAuthGuard } from '@/common/guards/jwt-auth.guard';
import { AppThrottlerGuard } from '@/common/throttler/app-throttler.guard';
import { FOLLOW_THROTTLE } from '@/common/throttler/throttler.constants';

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
  @UseGuards(AppThrottlerGuard)
  @Throttle(FOLLOW_THROTTLE)
  followUser(
    @CurrentUser() user: { id: string },
    @Param('userId') userId: string,
  ): Promise<FollowResponse> {
    return this.followsService.followUser(user.id, userId);
  }

  @Delete(':userId')
  @HttpCode(HttpStatus.OK)
  @UseGuards(AppThrottlerGuard)
  @Throttle(FOLLOW_THROTTLE)
  unfollowUser(
    @CurrentUser() user: { id: string },
    @Param('userId') userId: string,
  ): Promise<FollowResponse> {
    return this.followsService.unfollowUser(user.id, userId);
  }
}
