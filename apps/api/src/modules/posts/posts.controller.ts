import {
  Body,
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

import { CurrentUser } from '@/common/decorators/current-user.decorator';
import { JwtAuthGuard } from '@/common/guards/jwt-auth.guard';

import { CreatePostDto } from './dto/create-post.dto';
import { PostsService } from './posts.service';
import { LikeResponse } from './response/like.response';
import { PostResponse } from './response/post.response';

@ApiTags('posts')
@ApiCookieAuth()
@Controller('posts')
@UseGuards(JwtAuthGuard)
export class PostsController {
  constructor(private readonly postsService: PostsService) {}

  @Post()
  @HttpCode(HttpStatus.CREATED)
  createPost(
    @CurrentUser() user: { id: string },
    @Body() dto: CreatePostDto,
  ): Promise<PostResponse> {
    return this.postsService.createPost(user.id, dto);
  }

  @Get(':id')
  getPost(@Param('id') id: string): Promise<PostResponse> {
    return this.postsService.getPost(id);
  }

  @Post(':id/replies')
  @HttpCode(HttpStatus.CREATED)
  createReply(
    @CurrentUser() user: { id: string },
    @Param('id') parentId: string,
    @Body() dto: CreatePostDto,
  ): Promise<PostResponse> {
    return this.postsService.createReply(user.id, parentId, dto);
  }

  @Post(':id/like')
  @HttpCode(HttpStatus.OK)
  likePost(@CurrentUser() user: { id: string }, @Param('id') id: string): Promise<LikeResponse> {
    return this.postsService.likePost(user.id, id);
  }

  @Delete(':id/like')
  @HttpCode(HttpStatus.OK)
  unlikePost(@CurrentUser() user: { id: string }, @Param('id') id: string): Promise<LikeResponse> {
    return this.postsService.unlikePost(user.id, id);
  }
}
