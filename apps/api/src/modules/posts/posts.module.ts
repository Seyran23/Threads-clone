import { Module } from '@nestjs/common';

import { JwtAuthGuard } from '@/common/guards/jwt-auth.guard';
import { FeedModule } from '@/modules/feed/feed.module';
import { MediaModule } from '@/modules/media/media.module';
import { NotificationsModule } from '@/modules/notifications/notifications.module';
import { TrendingModule } from '@/modules/trending/trending.module';

import { HashtagsRepository } from './hashtags.repository';
import { LikesRepository } from './likes.repository';
import { PostsController } from './posts.controller';
import { PostsRepository } from './posts.repository';
import { PostsService } from './posts.service';
import { SavedPostsRepository } from './saved-posts.repository';

@Module({
  imports: [MediaModule, FeedModule, NotificationsModule, TrendingModule],
  controllers: [PostsController],
  providers: [
    PostsService,
    PostsRepository,
    HashtagsRepository,
    LikesRepository,
    SavedPostsRepository,
    JwtAuthGuard,
  ],
  exports: [PostsRepository, LikesRepository, SavedPostsRepository],
})
export class PostsModule {}
