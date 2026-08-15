-- AlterTable
ALTER TABLE "posts" ADD COLUMN "reply_count" INTEGER NOT NULL DEFAULT 0;

-- CreateIndex
CREATE INDEX "posts_parent_id_created_at_idx" ON "posts"("parent_id", "created_at");
