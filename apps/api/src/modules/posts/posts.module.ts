import { Module } from '@nestjs/common';

import { JwtAuthGuard } from '@/common/guards/jwt-auth.guard';
import { MediaModule } from '@/modules/media/media.module';

import { HashtagsRepository } from './hashtags.repository';
import { LikesRepository } from './likes.repository';
import { PostsController } from './posts.controller';
import { PostsRepository } from './posts.repository';
import { PostsService } from './posts.service';

@Module({
  imports: [MediaModule],
  controllers: [PostsController],
  providers: [PostsService, PostsRepository, HashtagsRepository, LikesRepository, JwtAuthGuard],
})
export class PostsModule {}
