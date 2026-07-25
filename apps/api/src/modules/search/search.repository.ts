import { Injectable } from '@nestjs/common';

import { PrismaClientOrTx } from '@/infrastructure/prisma/prisma.types';

interface PostSearchRow {
  id: string;
  content: string;
  authorId: string;
  authorUsername: string;
  createdAt: Date;
}

interface UserSearchRow {
  id: string;
  email: string;
  username: string;
  createdAt: Date;
}

@Injectable()
export class SearchRepository {
  searchPosts(
    tx: PrismaClientOrTx,
    tsQuery: string,
    limit: number,
    offset: number,
  ): Promise<PostSearchRow[]> {
    return tx.$queryRaw<PostSearchRow[]>`
      SELECT
        p.id,
        p.content,
        p.author_id AS "authorId",
        u.username AS "authorUsername",
        p.created_at AS "createdAt"
      FROM posts p
      JOIN users u ON u.id = p.author_id
      WHERE p.search_vector @@ to_tsquery('english', ${tsQuery})
      ORDER BY ts_rank(p.search_vector, to_tsquery('english', ${tsQuery})) DESC
      LIMIT ${limit} OFFSET ${offset}
    `;
  }

  searchUsers(
    tx: PrismaClientOrTx,
    tsQuery: string,
    limit: number,
    offset: number,
  ): Promise<UserSearchRow[]> {
    return tx.$queryRaw<UserSearchRow[]>`
      SELECT id, email, username, created_at AS "createdAt"
      FROM users
      WHERE search_vector @@ to_tsquery('english', ${tsQuery})
      ORDER BY ts_rank(search_vector, to_tsquery('english', ${tsQuery})) DESC
      LIMIT ${limit} OFFSET ${offset}
    `;
  }
}
