-- Activities move from a single ownerId/status to one-or-more independent
-- ActivityAssignment rows, so the same activity can be assigned to several
-- users at once, each reassigned/cancelled without touching the others.
--
-- Hand-written: this backfills every existing owned activity into exactly
-- one ActivityAssignment (carrying its current status), and repoints every
-- existing follow-up at that assignment, before the old columns are
-- dropped — nothing is lost.

-- 1. Activity gets a name. No name existed before; backfill a readable
--    placeholder from what the row already has so NOT NULL can be enforced.
ALTER TABLE "activities" ADD COLUMN "name" TEXT;
UPDATE "activities" SET "name" = "type" || ' - ' || to_char("date", 'YYYY-MM-DD');
ALTER TABLE "activities" ALTER COLUMN "name" SET NOT NULL;

-- 2. The new per-assignment status type and table.
CREATE TYPE "ActivityAssignmentStatus" AS ENUM ('PLANNED', 'DONE', 'CANCELLED');

CREATE TABLE "activity_assignments" (
    "id" TEXT NOT NULL,
    "status" "ActivityAssignmentStatus" NOT NULL DEFAULT 'PLANNED',
    "activityId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "createdBy" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedBy" TEXT,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "activity_assignments_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "activity_assignments_activityId_idx" ON "activity_assignments"("activityId");
CREATE INDEX "activity_assignments_userId_idx" ON "activity_assignments"("userId");

ALTER TABLE "activity_assignments" ADD CONSTRAINT "activity_assignments_activityId_fkey" FOREIGN KEY ("activityId") REFERENCES "activities"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "activity_assignments" ADD CONSTRAINT "activity_assignments_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- 3. Backfill: one assignment per currently-owned activity, carrying its
--    existing status and audit fields forward.
INSERT INTO "activity_assignments" ("id", "status", "activityId", "userId", "createdBy", "createdAt", "updatedBy", "updatedAt")
SELECT gen_random_uuid()::text, "status"::text::"ActivityAssignmentStatus", "id", "ownerId", "updatedBy", "updatedAt", "updatedBy", "updatedAt"
FROM "activities"
WHERE "ownerId" IS NOT NULL;

-- 4. Follow-ups move from (activityId, ownerId) to the one assignment that
--    pair now maps to — exact and unique, since step 3 created exactly one
--    assignment per (activityId, ownerId) that existed.
ALTER TABLE "follow_ups" ADD COLUMN "assignmentId" TEXT;
UPDATE "follow_ups" f
SET "assignmentId" = aa."id"
FROM "activity_assignments" aa
WHERE aa."activityId" = f."activityId" AND aa."userId" = f."ownerId";
ALTER TABLE "follow_ups" ALTER COLUMN "assignmentId" SET NOT NULL;

ALTER TABLE "follow_ups" DROP CONSTRAINT "follow_ups_ownerId_fkey";
DROP INDEX "follow_ups_ownerId_idx";
ALTER TABLE "follow_ups" DROP COLUMN "activityId";
ALTER TABLE "follow_ups" DROP COLUMN "ownerId";

CREATE INDEX "follow_ups_assignmentId_idx" ON "follow_ups"("assignmentId");
ALTER TABLE "follow_ups" ADD CONSTRAINT "follow_ups_assignmentId_fkey" FOREIGN KEY ("assignmentId") REFERENCES "activity_assignments"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- 5. Drop the old single-owner columns and status type from Activity.
ALTER TABLE "activities" DROP CONSTRAINT "activities_ownerId_fkey";
DROP INDEX "activities_ownerId_idx";
ALTER TABLE "activities" DROP COLUMN "ownerId";
ALTER TABLE "activities" DROP COLUMN "status";
DROP TYPE "ActivityStatus";
