import { TrendingRepository } from './trending.repository';
import { TrendingService } from './trending.service';

describe('TrendingService', () => {
  let trendingService: TrendingService;
  let trendingRepository: jest.Mocked<TrendingRepository>;

  beforeEach(() => {
    trendingRepository = {
      recordUsage: jest.fn(),
      getTop: jest.fn().mockResolvedValue([]),
    } as unknown as jest.Mocked<TrendingRepository>;

    trendingService = new TrendingService(trendingRepository);
  });

  describe('recordUsage', () => {
    it('records usage for every tag given', async () => {
      await trendingService.recordUsage(['foo', 'bar']);

      expect(trendingRepository.recordUsage).toHaveBeenCalledWith('foo');
      expect(trendingRepository.recordUsage).toHaveBeenCalledWith('bar');
      expect(trendingRepository.recordUsage).toHaveBeenCalledTimes(2);
    });

    it('does nothing for an empty tag list', async () => {
      await trendingService.recordUsage([]);

      expect(trendingRepository.recordUsage).not.toHaveBeenCalled();
    });
  });

  describe('getTopHashtags', () => {
    it('maps repository entries to response objects', async () => {
      trendingRepository.getTop.mockResolvedValue([{ tag: 'nestjs', score: 2.5 }]);

      const result = await trendingService.getTopHashtags(10);

      expect(trendingRepository.getTop).toHaveBeenCalledWith(10);
      expect(result).toEqual([{ tag: 'nestjs', score: 2.5 }]);
    });
  });
});
