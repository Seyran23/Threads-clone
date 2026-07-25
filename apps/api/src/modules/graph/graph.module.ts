import { Module } from '@nestjs/common';

import { JwtAuthGuard } from '@/common/guards/jwt-auth.guard';

import { GraphController } from './graph.controller';
import { GraphRepository } from './graph.repository';
import { GraphService } from './graph.service';

@Module({
  controllers: [GraphController],
  providers: [GraphRepository, GraphService, JwtAuthGuard],
})
export class GraphModule {}
