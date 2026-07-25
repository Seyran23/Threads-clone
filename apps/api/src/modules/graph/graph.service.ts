import { Injectable } from '@nestjs/common';

import { GraphRepository } from './graph.repository';
import { GraphUserResponse } from './response/graph-user.response';
import { GraphViewResponse } from './response/graph-view.response';
import { InfluenceResponse } from './response/influence.response';
import { ShortestPathResponse } from './response/shortest-path.response';

@Injectable()
export class GraphService {
  constructor(private readonly graphRepository: GraphRepository) {}

  getMutuals(userId: string, targetUserId: string): Promise<GraphUserResponse[]> {
    return this.graphRepository.findMutuals(userId, targetUserId);
  }

  getSecondDegree(userId: string): Promise<GraphUserResponse[]> {
    return this.graphRepository.findSecondDegree(userId);
  }

  async getShortestPath(userId: string, targetUserId: string): Promise<ShortestPathResponse> {
    const result = await this.graphRepository.findShortestPath(userId, targetUserId);
    if (!result) {
      return { path: null, length: null };
    }
    return { path: result.path, length: result.length };
  }

  async getInfluence(userId: string): Promise<InfluenceResponse> {
    const reach = await this.graphRepository.getReach(userId);
    return { userId, reach };
  }

  async getGraphView(userId: string): Promise<GraphViewResponse> {
    const neighborhood = await this.graphRepository.getNeighborhood(userId);

    const nodesById = new Map<string, GraphUserResponse>();
    nodesById.set(neighborhood.centerId, {
      id: neighborhood.centerId,
      username: neighborhood.centerUsername,
    });
    for (const user of [...neighborhood.following, ...neighborhood.followers]) {
      nodesById.set(user.id, user);
    }

    const nodeIds = [...nodesById.keys()];
    const edges = await this.graphRepository.findEdgesAmong(nodeIds);

    return { nodes: [...nodesById.values()], edges };
  }
}
