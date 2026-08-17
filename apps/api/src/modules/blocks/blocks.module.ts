import { forwardRef, Module } from '@nestjs/common';

import { JwtAuthGuard } from '@/common/guards/jwt-auth.guard';
import { FollowsModule } from '@/modules/follows/follows.module';
import { UsersModule } from '@/modules/users/users.module';

import { BlocksController } from './blocks.controller';
import { BlocksRepository } from './blocks.repository';
import { BlocksService } from './blocks.service';

@Module({
  imports: [UsersModule, forwardRef(() => FollowsModule)],
  controllers: [BlocksController],
  providers: [BlocksService, BlocksRepository, JwtAuthGuard],
  exports: [BlocksService],
})
export class BlocksModule {}
