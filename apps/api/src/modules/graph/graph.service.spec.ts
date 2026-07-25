import { GraphRepository } from './graph.repository';
import { GraphService } from './graph.service';

describe('GraphService', () => {
  let graphService: GraphService;
  let graphRepository: jest.Mocked<GraphRepository>;

  beforeEach(() => {
    graphRepository = {
      findMutuals: jest.fn().mockResolvedValue([]),
      findSecondDegree: jest.fn().mockResolvedValue([]),
      findShortestPath: jest.fn().mockResolvedValue(null),
      getReach: jest.fn().mockResolvedValue(0),
      getNeighborhood: jest.fn().mockResolvedValue({
        centerId: 'user-1',
        centerUsername: 'alice',
        following: [],
        followers: [],
      }),
      findEdgesAmong: jest.fn().mockResolvedValue([]),
    } as unknown as jest.Mocked<GraphRepository>;

    graphService = new GraphService(graphRepository);
  });

  describe('getShortestPath', () => {
    it('returns null path/length when no path exists', async () => {
      graphRepository.findShortestPath.mockResolvedValue(null);

      const result = await graphService.getShortestPath('user-1', 'user-2');

      expect(result).toEqual({ path: null, length: null });
    });

    it('passes through the path and length when one exists', async () => {
      graphRepository.findShortestPath.mockResolvedValue({
        path: [{ id: 'user-1', username: 'alice' }],
        length: 1,
      });

      const result = await graphService.getShortestPath('user-1', 'user-2');

      expect(result).toEqual({ path: [{ id: 'user-1', username: 'alice' }], length: 1 });
    });
  });

  describe('getInfluence', () => {
    it('wraps the reach count with the userId', async () => {
      graphRepository.getReach.mockResolvedValue(42);

      const result = await graphService.getInfluence('user-1');

      expect(result).toEqual({ userId: 'user-1', reach: 42 });
    });
  });

  describe('getGraphView', () => {
    it('includes the center user plus following/followers as deduped nodes', async () => {
      graphRepository.getNeighborhood.mockResolvedValue({
        centerId: 'user-1',
        centerUsername: 'alice',
        following: [{ id: 'user-2', username: 'bob' }],
        followers: [{ id: 'user-2', username: 'bob' }],
      });
      graphRepository.findEdgesAmong.mockResolvedValue([{ source: 'user-1', target: 'user-2' }]);

      const result = await graphService.getGraphView('user-1');

      expect(result.nodes).toEqual(
        expect.arrayContaining([
          { id: 'user-1', username: 'alice' },
          { id: 'user-2', username: 'bob' },
        ]),
      );
      expect(result.nodes).toHaveLength(2);
      expect(graphRepository.findEdgesAmong).toHaveBeenCalledWith(['user-1', 'user-2']);
      expect(result.edges).toEqual([{ source: 'user-1', target: 'user-2' }]);
    });

    it('returns just the center node when they have no connections', async () => {
      const result = await graphService.getGraphView('user-1');

      expect(result.nodes).toEqual([{ id: 'user-1', username: 'alice' }]);
      expect(result.edges).toEqual([]);
    });
  });
});
