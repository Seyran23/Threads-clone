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
  avatarUrl: string | null;
  createdAt: Date;
}

@Injectable()
export class SearchRepository {
  searchPosts(
    tx: PrismaClientOrTx,
    viewerId: string,
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
        AND NOT EXISTS (
          SELECT 1 FROM blocks b
          WHERE (b.blocker_id = ${viewerId} AND b.blocked_id = p.author_id)
             OR (b.blocked_id = ${viewerId} AND b.blocker_id = p.author_id)
        )
        AND (
          u.is_private = false
          OR p.author_id = ${viewerId}
          OR EXISTS (
            SELECT 1 FROM follows f
            WHERE f.follower_id = ${viewerId} AND f.followee_id = p.author_id
          )
        )
      ORDER BY ts_rank(p.search_vector, to_tsquery('english', ${tsQuery})) DESC
      LIMIT ${limit} OFFSET ${offset}
    `;
  }

  searchUsers(
    tx: PrismaClientOrTx,
    viewerId: string,
    tsQuery: string,
    limit: number,
    offset: number,
  ): Promise<UserSearchRow[]> {
    return tx.$queryRaw<UserSearchRow[]>`
      SELECT id, email, username, avatar_url AS "avatarUrl", created_at AS "createdAt"
      FROM users
      WHERE search_vector @@ to_tsquery('english', ${tsQuery})
        AND NOT EXISTS (
          SELECT 1 FROM blocks b
          WHERE (b.blocker_id = ${viewerId} AND b.blocked_id = users.id)
             OR (b.blocked_id = ${viewerId} AND b.blocker_id = users.id)
        )
      ORDER BY ts_rank(search_vector, to_tsquery('english', ${tsQuery})) DESC
      LIMIT ${limit} OFFSET ${offset}
    `;
  }
}
