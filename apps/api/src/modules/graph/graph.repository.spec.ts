import { Neo4jService } from '@/infrastructure/neo4j/neo4j.service';

import { GraphRepository } from './graph.repository';

describe('GraphRepository', () => {
  let graphRepository: GraphRepository;
  let neo4j: jest.Mocked<Neo4jService>;

  beforeEach(() => {
    neo4j = { run: jest.fn().mockResolvedValue([]) } as unknown as jest.Mocked<Neo4jService>;
    graphRepository = new GraphRepository(neo4j);
  });

  describe('findMutuals', () => {
    it('queries users following both the given users', async () => {
      neo4j.run.mockResolvedValue([{ id: 'user-3', username: 'carol' }]);

      const result = await graphRepository.findMutuals('user-1', 'user-2');

      expect(neo4j.run).toHaveBeenCalledWith(expect.stringContaining('FOLLOWS'), {
        userId: 'user-1',
        targetUserId: 'user-2',
      });
      expect(result).toEqual([{ id: 'user-3', username: 'carol' }]);
    });
  });

  describe('findSecondDegree', () => {
    it('excludes the user themself and their direct follows', async () => {
      await graphRepository.findSecondDegree('user-1');

      expect(neo4j.run).toHaveBeenCalledWith(
        expect.stringContaining('secondDegree.id <> $userId'),
        { userId: 'user-1' },
      );
    });
  });

  describe('findShortestPath', () => {
    it('returns the path and length when one exists', async () => {
      neo4j.run.mockResolvedValue([
        {
          path: [
            { id: 'user-1', username: 'alice' },
            { id: 'user-2', username: 'bob' },
          ],
          length: 1,
        },
      ]);

      const result = await graphRepository.findShortestPath('user-1', 'user-2');

      expect(result).toEqual({
        path: [
          { id: 'user-1', username: 'alice' },
          { id: 'user-2', username: 'bob' },
        ],
        length: 1,
      });
    });

    it('returns null when no path exists', async () => {
      neo4j.run.mockResolvedValue([]);

      const result = await graphRepository.findShortestPath('user-1', 'user-2');

      expect(result).toBeNull();
    });
  });

  describe('getReach', () => {
    it('returns the 2-hop reachable count', async () => {
      neo4j.run.mockResolvedValue([{ reach: 42 }]);

      const result = await graphRepository.getReach('user-1');

      expect(neo4j.run).toHaveBeenCalledWith(expect.stringContaining('*1..2'), {
        userId: 'user-1',
      });
      expect(result).toBe(42);
    });

    it('defaults to 0 when no row comes back', async () => {
      neo4j.run.mockResolvedValue([]);

      const result = await graphRepository.getReach('user-1');

      expect(result).toBe(0);
    });
  });

  describe('getNeighborhood', () => {
    it('returns the center user plus their following/followers lists', async () => {
      neo4j.run.mockResolvedValue([
        {
          centerId: 'user-1',
          centerUsername: 'alice',
          following: [{ id: 'user-2', username: 'bob' }],
          followers: [{ id: 'user-3', username: 'carol' }],
        },
      ]);

      const result = await graphRepository.getNeighborhood('user-1');

      expect(result).toEqual({
        centerId: 'user-1',
        centerUsername: 'alice',
        following: [{ id: 'user-2', username: 'bob' }],
        followers: [{ id: 'user-3', username: 'carol' }],
      });
    });

    it('falls back to an empty neighborhood when the center user has no Neo4j node', async () => {
      neo4j.run.mockResolvedValue([
        { centerId: null, centerUsername: null, following: [], followers: [] },
      ]);

      const result = await graphRepository.getNeighborhood('user-1');

      expect(result).toEqual({
        centerId: 'user-1',
        centerUsername: '',
        following: [],
        followers: [],
      });
    });
  });

  describe('findEdgesAmong', () => {
    it('returns an empty array without querying for an empty id list', async () => {
      const result = await graphRepository.findEdgesAmong([]);

      expect(neo4j.run).not.toHaveBeenCalled();
      expect(result).toEqual([]);
    });

    it('queries edges where both endpoints are in the given id list', async () => {
      neo4j.run.mockResolvedValue([{ source: 'user-1', target: 'user-2' }]);

      const result = await graphRepository.findEdgesAmong(['user-1', 'user-2']);

      expect(neo4j.run).toHaveBeenCalledWith(expect.stringContaining('IN $nodeIds'), {
        nodeIds: ['user-1', 'user-2'],
      });
      expect(result).toEqual([{ source: 'user-1', target: 'user-2' }]);
    });
  });
});
