import { Controller, Get, Param, UseGuards } from '@nestjs/common';
import { ApiCookieAuth, ApiTags } from '@nestjs/swagger';

import { CurrentUser } from '@/common/decorators/current-user.decorator';
import { JwtAuthGuard } from '@/common/guards/jwt-auth.guard';

import { GraphService } from './graph.service';
import { GraphUserResponse } from './response/graph-user.response';
import { GraphViewResponse } from './response/graph-view.response';
import { InfluenceResponse } from './response/influence.response';
import { ShortestPathResponse } from './response/shortest-path.response';

@ApiTags('graph')
@ApiCookieAuth()
@Controller('graph')
@UseGuards(JwtAuthGuard)
export class GraphController {
  constructor(private readonly graphService: GraphService) {}

  @Get('mutuals/:userId')
  getMutuals(
    @CurrentUser() user: { id: string },
    @Param('userId') targetUserId: string,
  ): Promise<GraphUserResponse[]> {
    return this.graphService.getMutuals(user.id, targetUserId);
  }

  @Get('second-degree/:userId')
  getSecondDegree(@Param('userId') userId: string): Promise<GraphUserResponse[]> {
    return this.graphService.getSecondDegree(userId);
  }

  @Get('shortest-path/:userId')
  getShortestPath(
    @CurrentUser() user: { id: string },
    @Param('userId') targetUserId: string,
  ): Promise<ShortestPathResponse> {
    return this.graphService.getShortestPath(user.id, targetUserId);
  }

  @Get('influence/:userId')
  getInfluence(@Param('userId') userId: string): Promise<InfluenceResponse> {
    return this.graphService.getInfluence(userId);
  }

  @Get('view/:userId')
  getGraphView(@Param('userId') userId: string): Promise<GraphViewResponse> {
    return this.graphService.getGraphView(userId);
  }
}
