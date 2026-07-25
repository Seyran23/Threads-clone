import { SearchRepository } from './search.repository';

describe('SearchRepository', () => {
  let searchRepository: SearchRepository;
  let tx: { $queryRaw: jest.Mock };

  beforeEach(() => {
    tx = { $queryRaw: jest.fn().mockResolvedValue([]) };
    searchRepository = new SearchRepository();
  });

  describe('searchPosts', () => {
    it('queries with the tsQuery, limit, and offset as parameters', async () => {
      await searchRepository.searchPosts(tx as never, 'seyran:*', 20, 0);

      const [, ...params] = tx.$queryRaw.mock.calls[0];
      expect(params).toEqual(expect.arrayContaining(['seyran:*', 20, 0]));
    });
  });

  describe('searchUsers', () => {
    it('queries with the tsQuery, limit, and offset as parameters', async () => {
      await searchRepository.searchUsers(tx as never, 'seyran:*', 20, 0);

      const [, ...params] = tx.$queryRaw.mock.calls[0];
      expect(params).toEqual(expect.arrayContaining(['seyran:*', 20, 0]));
    });
  });
});
