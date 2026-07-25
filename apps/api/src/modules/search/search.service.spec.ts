import { PrismaService } from '@/infrastructure/prisma/prisma.service';

import { SearchRepository } from './search.repository';
import { SearchService } from './search.service';

describe('SearchService', () => {
  let searchService: SearchService;
  let prisma: PrismaService;
  let searchRepository: jest.Mocked<SearchRepository>;

  beforeEach(() => {
    prisma = {} as PrismaService;

    searchRepository = {
      searchPosts: jest.fn().mockResolvedValue([]),
      searchUsers: jest.fn().mockResolvedValue([]),
    } as unknown as jest.Mocked<SearchRepository>;

    searchService = new SearchService(prisma, searchRepository);
  });

  it('returns empty results without querying when there are no usable search words', async () => {
    const result = await searchService.search('&|!()', 1, 20);

    expect(searchRepository.searchPosts).not.toHaveBeenCalled();
    expect(searchRepository.searchUsers).not.toHaveBeenCalled();
    expect(result).toEqual({ posts: [], users: [] });
  });

  it('converts page/limit into a zero-based offset', async () => {
    await searchService.search('seyran', 3, 20);

    expect(searchRepository.searchPosts).toHaveBeenCalledWith(prisma, 'seyran:*', 20, 40);
    expect(searchRepository.searchUsers).toHaveBeenCalledWith(prisma, 'seyran:*', 20, 40);
  });

  it('maps post rows into the lightweight search-result shape', async () => {
    const createdAt = new Date('2026-07-19T10:00:00.000Z');
    searchRepository.searchPosts.mockResolvedValue([
      {
        id: 'post-1',
        content: 'hello #nestjs',
        authorId: 'author-1',
        authorUsername: 'alice',
        createdAt,
      },
    ]);

    const result = await searchService.search('nestjs', 1, 20);

    expect(result.posts).toEqual([
      {
        id: 'post-1',
        content: 'hello #nestjs',
        authorId: 'author-1',
        authorUsername: 'alice',
        createdAt,
      },
    ]);
  });

  it('maps user rows into the user response shape', async () => {
    const createdAt = new Date('2026-07-19T10:00:00.000Z');
    searchRepository.searchUsers.mockResolvedValue([
      { id: 'user-1', email: 'alice@example.com', username: 'alice', createdAt },
    ]);

    const result = await searchService.search('alice', 1, 20);

    expect(result.users).toEqual([
      { id: 'user-1', email: 'alice@example.com', username: 'alice', createdAt },
    ]);
  });
});
