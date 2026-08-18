-- AlterEnum
ALTER TYPE "NotificationType" ADD VALUE 'FOLLOW_REQUEST';

-- AlterTable
ALTER TABLE "users" ADD COLUMN "is_private" BOOLEAN NOT NULL DEFAULT false;

-- CreateTable
CREATE TABLE "follow_requests" (
    "id" TEXT NOT NULL,
    "requester_id" TEXT NOT NULL,
    "target_id" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "follow_requests_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "follow_requests_target_id_idx" ON "follow_requests"("target_id");

-- CreateIndex
CREATE UNIQUE INDEX "follow_requests_requester_id_target_id_key" ON "follow_requests"("requester_id", "target_id");

-- AddForeignKey
ALTER TABLE "follow_requests" ADD CONSTRAINT "follow_requests_requester_id_fkey" FOREIGN KEY ("requester_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "follow_requests" ADD CONSTRAINT "follow_requests_target_id_fkey" FOREIGN KEY ("target_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
