-- CreateEnum
CREATE TYPE "FanoutStatus" AS ENUM ('PENDING', 'COMPLETED');

-- CreateEnum
CREATE TYPE "GraphSyncEventType" AS ENUM ('FOLLOW_CREATED', 'FOLLOW_DELETED');

-- CreateEnum
CREATE TYPE "GraphSyncStatus" AS ENUM ('PENDING', 'COMPLETED', 'FAILED');

-- AlterTable
ALTER TABLE "posts" ADD COLUMN     "fanout_status" "FanoutStatus" NOT NULL DEFAULT 'PENDING';

-- CreateTable
CREATE TABLE "follows" (
    "id" TEXT NOT NULL,
    "follower_id" TEXT NOT NULL,
    "followee_id" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "follows_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "graph_sync_outbox" (
    "id" TEXT NOT NULL,
    "event_type" "GraphSyncEventType" NOT NULL,
    "payload" JSONB NOT NULL,
    "status" "GraphSyncStatus" NOT NULL DEFAULT 'PENDING',
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "graph_sync_outbox_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "follows_followee_id_idx" ON "follows"("followee_id");

-- CreateIndex
CREATE UNIQUE INDEX "follows_follower_id_followee_id_key" ON "follows"("follower_id", "followee_id");

-- CreateIndex
CREATE INDEX "graph_sync_outbox_status_updated_at_idx" ON "graph_sync_outbox"("status", "updated_at");

-- CreateIndex
CREATE INDEX "posts_fanout_status_created_at_idx" ON "posts"("fanout_status", "created_at");

-- AddForeignKey
ALTER TABLE "follows" ADD CONSTRAINT "follows_follower_id_fkey" FOREIGN KEY ("follower_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "follows" ADD CONSTRAINT "follows_followee_id_fkey" FOREIGN KEY ("followee_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
