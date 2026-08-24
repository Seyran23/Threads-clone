import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ApiCookieAuth, ApiTags } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';

import { CurrentUser } from '@/common/decorators/current-user.decorator';
import { JwtAuthGuard } from '@/common/guards/jwt-auth.guard';
import { AppThrottlerGuard } from '@/common/throttler/app-throttler.guard';
import {
  MEDIA_UPLOAD_THROTTLE,
  PROFILE_UPDATE_THROTTLE,
} from '@/common/throttler/throttler.constants';
import { PresignUploadDto } from '@/modules/media/dto/presign-upload.dto';
import { PresignedUploadResponse } from '@/modules/media/response/presigned-upload.response';

import { GetSavedPostsQueryDto } from './dto/get-saved-posts-query.dto';
import { GetUserPostsQueryDto } from './dto/get-user-posts-query.dto';
import { UpdateProfileDto } from './dto/update-profile.dto';
import { UserPostsResponse } from './response/user-posts.response';
import { UserProfileResponse } from './response/user-profile.response';
import { UsersService } from './users.service';

@ApiTags('users')
@ApiCookieAuth()
@Controller('users')
@UseGuards(JwtAuthGuard)
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @Patch('me')
  @UseGuards(AppThrottlerGuard)
  @Throttle(PROFILE_UPDATE_THROTTLE)
  updateProfile(
    @CurrentUser() user: { id: string },
    @Body() dto: UpdateProfileDto,
  ): Promise<UserProfileResponse> {
    return this.usersService.updateProfile(user.id, dto);
  }

  @Post('me/avatar/presign-upload')
  @HttpCode(HttpStatus.CREATED)
  @UseGuards(AppThrottlerGuard)
  @Throttle(MEDIA_UPLOAD_THROTTLE)
  presignAvatarUpload(
    @CurrentUser() user: { id: string },
    @Body() dto: PresignUploadDto,
  ): Promise<PresignedUploadResponse> {
    return this.usersService.presignAvatarUpload(user.id, dto);
  }

  @Get('me/saved-posts')
  getSavedPosts(
    @CurrentUser() user: { id: string },
    @Query() query: GetSavedPostsQueryDto,
  ): Promise<UserPostsResponse> {
    return this.usersService.getSavedPosts(user.id, query.cursor, query.limit);
  }

  @Get('me/likes')
  getMyLikedPosts(
    @CurrentUser() user: { id: string },
    @Query() query: GetSavedPostsQueryDto,
  ): Promise<UserPostsResponse> {
    return this.usersService.getMyLikedPosts(user.id, query.cursor, query.limit);
  }

  @Get(':username')
  getProfile(
    @CurrentUser() user: { id: string },
    @Param('username') username: string,
  ): Promise<UserProfileResponse> {
    return this.usersService.getProfile(username, user.id);
  }

  @Get(':username/posts')
  getUserPosts(
    @CurrentUser() user: { id: string },
    @Param('username') username: string,
    @Query() query: GetUserPostsQueryDto,
  ): Promise<UserPostsResponse> {
    return this.usersService.getUserPosts(username, user.id, query.cursor, query.limit);
  }

  @Get(':username/replies')
  getUserReplies(
    @CurrentUser() user: { id: string },
    @Param('username') username: string,
    @Query() query: GetUserPostsQueryDto,
  ): Promise<UserPostsResponse> {
    return this.usersService.getUserReplies(username, user.id, query.cursor, query.limit);
  }
}
