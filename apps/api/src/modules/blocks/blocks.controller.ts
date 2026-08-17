import {
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Post,
  UseGuards,
} from '@nestjs/common';
import { ApiCookieAuth, ApiTags } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';

import { CurrentUser } from '@/common/decorators/current-user.decorator';
import { JwtAuthGuard } from '@/common/guards/jwt-auth.guard';
import { AppThrottlerGuard } from '@/common/throttler/app-throttler.guard';
import { FOLLOW_THROTTLE } from '@/common/throttler/throttler.constants';

import { BlocksService } from './blocks.service';
import { BlockResponse } from './response/block.response';
import { BlockedUserResponse } from './response/blocked-user.response';

@ApiTags('blocks')
@ApiCookieAuth()
@Controller('blocks')
@UseGuards(JwtAuthGuard)
export class BlocksController {
  constructor(private readonly blocksService: BlocksService) {}

  @Get()
  getBlockedUsers(@CurrentUser() user: { id: string }): Promise<BlockedUserResponse[]> {
    return this.blocksService.getBlockedUsers(user.id);
  }

  @Post(':userId')
  @HttpCode(HttpStatus.CREATED)
  @UseGuards(AppThrottlerGuard)
  @Throttle(FOLLOW_THROTTLE)
  blockUser(
    @CurrentUser() user: { id: string },
    @Param('userId') userId: string,
  ): Promise<BlockResponse> {
    return this.blocksService.blockUser(user.id, userId);
  }

  @Delete(':userId')
  @HttpCode(HttpStatus.OK)
  @UseGuards(AppThrottlerGuard)
  @Throttle(FOLLOW_THROTTLE)
  unblockUser(
    @CurrentUser() user: { id: string },
    @Param('userId') userId: string,
  ): Promise<BlockResponse> {
    return this.blocksService.unblockUser(user.id, userId);
  }
}
