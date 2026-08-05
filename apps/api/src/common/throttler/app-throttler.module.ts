import { Global, Module } from '@nestjs/common';
import { ThrottlerModule } from '@nestjs/throttler';

import { RedisService } from '@/infrastructure/redis/redis.service';

import { AppThrottlerGuard } from './app-throttler.guard';
import { RedisThrottlerStorage } from './redis-throttler-storage.service';

@Global()
@Module({
  imports: [
    ThrottlerModule.forRootAsync({
      useFactory: (redis: RedisService) => ({
        throttlers: [{ name: 'default', ttl: 60_000, limit: 20 }],
        storage: new RedisThrottlerStorage(redis),
      }),
      inject: [RedisService],
    }),
  ],
  providers: [AppThrottlerGuard],
  exports: [AppThrottlerGuard],
})
export class AppThrottlerModule {}
