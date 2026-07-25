import { Injectable } from '@nestjs/common';

import { Neo4jService } from '@/infrastructure/neo4j/neo4j.service';

import { GraphEdge } from './interface/graph-edge.interface';
import { GraphUser } from './interface/graph-user.interface';
import { Neighborhood } from './interface/neighborhood.interface';

const SHORTEST_PATH_MAX_HOPS = 6;

@Injectable()
export class GraphRepository {
  constructor(private readonly neo4j: Neo4jService) {}

  async findMutuals(userId: string, targetUserId: string): Promise<GraphUser[]> {
    const rows = await this.neo4j.run<{ id: string; username: string }>(
      `MATCH (a:User {id: $userId})<-[:FOLLOWS]-(mutual:User)-[:FOLLOWS]->(b:User {id: $targetUserId})
       RETURN DISTINCT mutual.id AS id, mutual.username AS username`,
      { userId, targetUserId },
    );
    return rows;
  }

  async findSecondDegree(userId: string): Promise<GraphUser[]> {
    const rows = await this.neo4j.run<{ id: string; username: string }>(
      `MATCH (a:User {id: $userId})-[:FOLLOWS]->(:User)-[:FOLLOWS]->(secondDegree:User)
       WHERE secondDegree.id <> $userId AND NOT (a)-[:FOLLOWS]->(secondDegree)
       RETURN DISTINCT secondDegree.id AS id, secondDegree.username AS username`,
      { userId },
    );
    return rows;
  }

  async findShortestPath(
    userId: string,
    targetUserId: string,
  ): Promise<{ path: GraphUser[]; length: number } | null> {
    const rows = await this.neo4j.run<{ path: GraphUser[]; length: number }>(
      `MATCH (a:User {id: $userId}), (b:User {id: $targetUserId})
       MATCH p = shortestPath((a)-[:FOLLOWS*..${SHORTEST_PATH_MAX_HOPS}]-(b))
       RETURN [n IN nodes(p) | {id: n.id, username: n.username}] AS path, length(p) AS length`,
      { userId, targetUserId },
    );

    if (rows.length === 0) {
      return null;
    }
    return rows[0];
  }

  // "Reach" within 2 hops of the follow graph: direct followers plus
  // followers-of-followers. This is the metric that actually needs a
  // graph traversal — a plain follower count wouldn't need Neo4j at all.
  async getReach(userId: string): Promise<number> {
    const rows = await this.neo4j.run<{ reach: number }>(
      `MATCH (a:User {id: $userId})<-[:FOLLOWS*1..2]-(reachable:User)
       RETURN count(DISTINCT reachable) AS reach`,
      { userId },
    );
    return rows[0]?.reach ?? 0;
  }

  async getNeighborhood(userId: string): Promise<Neighborhood> {
    const rows = await this.neo4j.run<{
      centerId: string | null;
      centerUsername: string | null;
      following: GraphUser[];
      followers: GraphUser[];
    }>(
      `MATCH (center:User {id: $userId})
       CALL {
         WITH center
         MATCH (center)-[:FOLLOWS]->(following:User)
         RETURN collect({id: following.id, username: following.username}) AS following
       }
       CALL {
         WITH center
         MATCH (center)<-[:FOLLOWS]-(follower:User)
         RETURN collect({id: follower.id, username: follower.username}) AS followers
       }
       RETURN center.id AS centerId, center.username AS centerUsername, following, followers`,
      { userId },
    );

    const row = rows[0];
    if (!row?.centerId) {
      return { centerId: userId, centerUsername: '', following: [], followers: [] };
    }
    return {
      centerId: row.centerId,
      centerUsername: row.centerUsername ?? '',
      following: row.following,
      followers: row.followers,
    };
  }

  findEdgesAmong(nodeIds: string[]): Promise<GraphEdge[]> {
    if (nodeIds.length === 0) {
      return Promise.resolve([]);
    }

    return this.neo4j.run<GraphEdge>(
      `MATCH (a:User)-[:FOLLOWS]->(b:User)
       WHERE a.id IN $nodeIds AND b.id IN $nodeIds
       RETURN a.id AS source, b.id AS target`,
      { nodeIds },
    );
  }
}
