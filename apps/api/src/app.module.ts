import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { APP_FILTER } from '@nestjs/core';

import { validate } from '@/common/config/env.schema';
import jwtConfig from '@/common/config/jwt.config';
import s3Config from '@/common/config/s3.config';
import { AllExceptionsFilter } from '@/common/filters/all-exceptions.filter';
import { LoggerModule } from '@/common/logger/logger.module';
import { TokenModule } from '@/common/token/token.module';
import { Neo4jModule } from '@/infrastructure/neo4j/neo4j.module';
import { PrismaModule } from '@/infrastructure/prisma/prisma.module';
import { RedisModule } from '@/infrastructure/redis/redis.module';
import { S3Module } from '@/infrastructure/s3/s3.module';
import { AuthModule } from '@/modules/auth/auth.module';
import { MediaModule } from '@/modules/media/media.module';
import { PostsModule } from '@/modules/posts/posts.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true, validate, load: [jwtConfig, s3Config] }),
    LoggerModule,
    TokenModule,
    PrismaModule,
    RedisModule,
    Neo4jModule,
    S3Module,
    AuthModule,
    MediaModule,
    PostsModule,
  ],
  controllers: [],
  providers: [{ provide: APP_FILTER, useClass: AllExceptionsFilter }],
})
export class AppModule {}
