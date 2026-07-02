import { Module } from '@nestjs/common';

import { Neo4jModule } from '@/infrastructure/neo4j/neo4j.module';
import { PrismaModule } from '@/infrastructure/prisma/prisma.module';
import { RedisModule } from '@/infrastructure/redis/redis.module';

import { AppController } from './app.controller';
import { AppService } from './app.service';

@Module({
  imports: [PrismaModule, RedisModule, Neo4jModule],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
