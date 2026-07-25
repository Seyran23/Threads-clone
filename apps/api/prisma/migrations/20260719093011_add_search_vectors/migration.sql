-- AlterTable
-- Generated column: Postgres keeps this in sync automatically on every
-- INSERT/UPDATE, no application code or trigger needed to maintain it.
ALTER TABLE "posts" ADD COLUMN "search_vector" tsvector
  GENERATED ALWAYS AS (to_tsvector('english', "content")) STORED;

CREATE INDEX "posts_search_vector_idx" ON "posts" USING GIN ("search_vector");

-- AlterTable
ALTER TABLE "users" ADD COLUMN "search_vector" tsvector
  GENERATED ALWAYS AS (to_tsvector('english', "username")) STORED;

CREATE INDEX "users_search_vector_idx" ON "users" USING GIN ("search_vector");
