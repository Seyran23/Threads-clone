import { Injectable } from '@nestjs/common';

import { PrismaService } from '@/infrastructure/prisma/prisma.service';
import { UserResponse } from '@/modules/users/response/user.response';

import { PostSearchResultResponse } from './response/post-search-result.response';
import { SearchResultsResponse } from './response/search-results.response';
import { SearchRepository } from './search.repository';
import { buildPrefixTsQuery } from './utils/build-prefix-ts-query.util';

@Injectable()
export class SearchService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly searchRepository: SearchRepository,
  ) {}

  async search(
    viewerId: string,
    query: string,
    page: number,
    limit: number,
  ): Promise<SearchResultsResponse> {
    const tsQuery = buildPrefixTsQuery(query);
    if (!tsQuery) {
      return { posts: [], users: [] };
    }

    const offset = (page - 1) * limit;

    const [postRows, userRows] = await Promise.all([
      this.searchRepository.searchPosts(this.prisma, viewerId, tsQuery, limit, offset),
      this.searchRepository.searchUsers(this.prisma, viewerId, tsQuery, limit, offset),
    ]);

    const posts: PostSearchResultResponse[] = postRows.map((row) => ({
      id: row.id,
      content: row.content,
      authorId: row.authorId,
      authorUsername: row.authorUsername,
      createdAt: row.createdAt,
    }));
    const users: UserResponse[] = userRows.map((row) => ({
      id: row.id,
      email: row.email,
      username: row.username,
      avatarUrl: row.avatarUrl,
      createdAt: row.createdAt,
    }));

    return { posts, users };
  }
}
