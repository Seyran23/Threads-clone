import { Module } from '@nestjs/common';

import { JwtAuthGuard } from '@/common/guards/jwt-auth.guard';

import { HashtagsRepository } from './hashtags.repository';
import { LikesRepository } from './likes.repository';
import { PostsController } from './posts.controller';
import { PostsRepository } from './posts.repository';
import { PostsService } from './posts.service';

@Module({
  controllers: [PostsController],
  providers: [PostsService, PostsRepository, HashtagsRepository, LikesRepository, JwtAuthGuard],
})
export class PostsModule {}
