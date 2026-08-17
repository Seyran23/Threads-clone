import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
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
  LIKE_THROTTLE,
  POST_CREATE_THROTTLE,
  REPORT_THROTTLE,
} from '@/common/throttler/throttler.constants';

import { CreatePostDto } from './dto/create-post.dto';
import { GetRepliesQueryDto } from './dto/get-replies-query.dto';
import { ReportPostDto } from './dto/report-post.dto';
import { PostsService } from './posts.service';
import { LikeResponse } from './response/like.response';
import { PostResponse } from './response/post.response';
import { RepliesResponse } from './response/replies.response';

@ApiTags('posts')
@ApiCookieAuth()
@Controller('posts')
@UseGuards(JwtAuthGuard)
export class PostsController {
  constructor(private readonly postsService: PostsService) {}

  @Post()
  @HttpCode(HttpStatus.CREATED)
  @UseGuards(AppThrottlerGuard)
  @Throttle(POST_CREATE_THROTTLE)
  createPost(
    @CurrentUser() user: { id: string },
    @Body() dto: CreatePostDto,
  ): Promise<PostResponse> {
    return this.postsService.createPost(user.id, dto);
  }

  @Get(':id')
  getPost(@CurrentUser() user: { id: string }, @Param('id') id: string): Promise<PostResponse> {
    return this.postsService.getPost(user.id, id);
  }

  @Get(':id/replies')
  getReplies(
    @CurrentUser() user: { id: string },
    @Param('id') id: string,
    @Query() query: GetRepliesQueryDto,
  ): Promise<RepliesResponse> {
    return this.postsService.getReplies(user.id, id, query.cursor, query.limit);
  }

  @Post(':id/replies')
  @HttpCode(HttpStatus.CREATED)
  @UseGuards(AppThrottlerGuard)
  @Throttle(POST_CREATE_THROTTLE)
  createReply(
    @CurrentUser() user: { id: string },
    @Param('id') parentId: string,
    @Body() dto: CreatePostDto,
  ): Promise<PostResponse> {
    return this.postsService.createReply(user.id, parentId, dto);
  }

  @Post(':id/like')
  @HttpCode(HttpStatus.OK)
  @UseGuards(AppThrottlerGuard)
  @Throttle(LIKE_THROTTLE)
  likePost(@CurrentUser() user: { id: string }, @Param('id') id: string): Promise<LikeResponse> {
    return this.postsService.likePost(user.id, id);
  }

  @Delete(':id/like')
  @HttpCode(HttpStatus.OK)
  @UseGuards(AppThrottlerGuard)
  @Throttle(LIKE_THROTTLE)
  unlikePost(@CurrentUser() user: { id: string }, @Param('id') id: string): Promise<LikeResponse> {
    return this.postsService.unlikePost(user.id, id);
  }

  @Post(':id/save')
  @HttpCode(HttpStatus.OK)
  @UseGuards(AppThrottlerGuard)
  @Throttle(LIKE_THROTTLE)
  savePost(@CurrentUser() user: { id: string }, @Param('id') id: string): Promise<void> {
    return this.postsService.savePost(user.id, id);
  }

  @Delete(':id/save')
  @HttpCode(HttpStatus.OK)
  @UseGuards(AppThrottlerGuard)
  @Throttle(LIKE_THROTTLE)
  unsavePost(@CurrentUser() user: { id: string }, @Param('id') id: string): Promise<void> {
    return this.postsService.unsavePost(user.id, id);
  }

  @Post(':id/report')
  @HttpCode(HttpStatus.CREATED)
  @UseGuards(AppThrottlerGuard)
  @Throttle(REPORT_THROTTLE)
  reportPost(
    @CurrentUser() user: { id: string },
    @Param('id') id: string,
    @Body() dto: ReportPostDto,
  ): Promise<void> {
    return this.postsService.reportPost(user.id, id, dto);
  }
}
