import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { APP_FILTER } from '@nestjs/core';
import { ScheduleModule } from '@nestjs/schedule';

import { validate } from '@/common/config/env.schema';
import jwtConfig from '@/common/config/jwt.config';
import s3Config from '@/common/config/s3.config';
import { AllExceptionsFilter } from '@/common/filters/all-exceptions.filter';
import { LoggerModule } from '@/common/logger/logger.module';
import { TokenModule } from '@/common/token/token.module';
import { Neo4jModule } from '@/infrastructure/neo4j/neo4j.module';
import { PrismaModule } from '@/infrastructure/prisma/prisma.module';
import { BullMqModule } from '@/infrastructure/queue/bullmq.module';
import { RedisModule } from '@/infrastructure/redis/redis.module';
import { S3Module } from '@/infrastructure/s3/s3.module';
import { SocketModule } from '@/infrastructure/socket/socket.module';
import { AuthModule } from '@/modules/auth/auth.module';
import { FeedModule } from '@/modules/feed/feed.module';
import { FollowsModule } from '@/modules/follows/follows.module';
import { MediaModule } from '@/modules/media/media.module';
import { NotificationsModule } from '@/modules/notifications/notifications.module';
import { PostsModule } from '@/modules/posts/posts.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true, validate, load: [jwtConfig, s3Config] }),
    ScheduleModule.forRoot(),
    LoggerModule,
    TokenModule,
    PrismaModule,
    RedisModule,
    Neo4jModule,
    S3Module,
    BullMqModule,
    SocketModule,
    AuthModule,
    MediaModule,
    FeedModule,
    NotificationsModule,
    PostsModule,
    FollowsModule,
  ],
  controllers: [],
  providers: [{ provide: APP_FILTER, useClass: AllExceptionsFilter }],
})
export class AppModule {}
