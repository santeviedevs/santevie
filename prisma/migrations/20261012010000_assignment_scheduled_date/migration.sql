-- Scheduling moves from the activity (one shared date) to the assignment
-- (each assignee's own date), since different assignees of the same
-- activity can now be scheduled on different dates.
--
-- Hand-written: backfills every assignment's scheduledDate from its
-- activity's date before dropping that column, so no existing schedule is
-- lost.

ALTER TABLE "activity_assignments" ADD COLUMN "scheduledDate" TIMESTAMP(3);

UPDATE "activity_assignments" aa
SET "scheduledDate" = a."date"
FROM "activities" a
WHERE a."id" = aa."activityId";

ALTER TABLE "activity_assignments" ALTER COLUMN "scheduledDate" SET NOT NULL;
CREATE INDEX "activity_assignments_scheduledDate_idx" ON "activity_assignments"("scheduledDate");

DROP INDEX "activities_date_idx";
ALTER TABLE "activities" DROP COLUMN "date";
