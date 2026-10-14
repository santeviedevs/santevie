/*
  Warnings:

  - You are about to drop the column `expectedParticipants` on the `activity_assignments` table. All the data in the column will be lost.
  - You are about to drop the column `prescriberCount` on the `activity_assignments` table. All the data in the column will be lost.
  - You are about to drop the column `requirementCategoryId` on the `activity_assignments` table. All the data in the column will be lost.

*/
-- DropForeignKey
ALTER TABLE "activity_assignments" DROP CONSTRAINT "activity_assignments_requirementCategoryId_fkey";

-- DropIndex
DROP INDEX "activity_assignments_requirementCategoryId_idx";

-- AlterTable
ALTER TABLE "activities" ADD COLUMN     "expectedParticipants" INTEGER,
ADD COLUMN     "prescriberCount" INTEGER,
ADD COLUMN     "requirementCategoryId" TEXT;

-- Backfill: these three fields move from per-assignment (execution-time) to
-- per-activity (creation-time). An activity can have several assignments;
-- where more than one carries a non-null value, the earliest-created
-- assignment's value wins (DISTINCT ON ... ORDER BY "createdAt") — in
-- practice these fields were only ever set by one assignee at a time, so
-- this is a safe, deterministic choice rather than an arbitrary one.
UPDATE "activities" a
SET "prescriberCount" = sub."prescriberCount"
FROM (
  SELECT DISTINCT ON ("activityId") "activityId", "prescriberCount"
  FROM "activity_assignments"
  WHERE "prescriberCount" IS NOT NULL
  ORDER BY "activityId", "createdAt" ASC
) sub
WHERE a.id = sub."activityId";

UPDATE "activities" a
SET "expectedParticipants" = sub."expectedParticipants"
FROM (
  SELECT DISTINCT ON ("activityId") "activityId", "expectedParticipants"
  FROM "activity_assignments"
  WHERE "expectedParticipants" IS NOT NULL
  ORDER BY "activityId", "createdAt" ASC
) sub
WHERE a.id = sub."activityId";

UPDATE "activities" a
SET "requirementCategoryId" = sub."requirementCategoryId"
FROM (
  SELECT DISTINCT ON ("activityId") "activityId", "requirementCategoryId"
  FROM "activity_assignments"
  WHERE "requirementCategoryId" IS NOT NULL
  ORDER BY "activityId", "createdAt" ASC
) sub
WHERE a.id = sub."activityId";

-- AlterTable
ALTER TABLE "activity_assignments" DROP COLUMN "expectedParticipants",
DROP COLUMN "prescriberCount",
DROP COLUMN "requirementCategoryId";

-- CreateIndex
CREATE INDEX "activities_requirementCategoryId_idx" ON "activities"("requirementCategoryId");

-- AddForeignKey
ALTER TABLE "activities" ADD CONSTRAINT "activities_requirementCategoryId_fkey" FOREIGN KEY ("requirementCategoryId") REFERENCES "requirement_category_defs"("id") ON DELETE SET NULL ON UPDATE CASCADE;
