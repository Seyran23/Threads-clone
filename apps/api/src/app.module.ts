import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { APP_FILTER } from '@nestjs/core';

import { validate } from '@/common/config/env.schema';
import jwtConfig from '@/common/config/jwt.config';
import { AllExceptionsFilter } from '@/common/filters/all-exceptions.filter';
import { LoggerModule } from '@/common/logger/logger.module';
import { Neo4jModule } from '@/infrastructure/neo4j/neo4j.module';
import { PrismaModule } from '@/infrastructure/prisma/prisma.module';
import { RedisModule } from '@/infrastructure/redis/redis.module';

import { AppController } from './app.controller';
import { AppService } from './app.service';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true, validate, load: [jwtConfig] }),
    LoggerModule,
    PrismaModule,
    RedisModule,
    Neo4jModule,
  ],
  controllers: [AppController],
  providers: [AppService, { provide: APP_FILTER, useClass: AllExceptionsFilter }],
})
export class AppModule {}
