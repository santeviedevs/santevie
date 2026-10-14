/*
  Story B — extends FollowUp with the chain-engine columns (owner, outcome
  capture, series config, parent/child link) and adds FollowUpReassignment.
  ownerId is backfilled from each follow-up's own assignment.userId before
  being made NOT NULL, since every existing row predates the concept of an
  owner distinct from the assignee.
*/

-- AlterTable: add every new column nullable first (ownerId included,
-- tightened to NOT NULL below once backfilled).
ALTER TABLE "follow_ups"
  ADD COLUMN     "businessValueGenerated" DECIMAL(14,2),
  ADD COLUMN     "outcome" TEXT,
  ADD COLUMN     "ownerId" TEXT,
  ADD COLUMN     "parentFollowUpId" TEXT,
  ADD COLUMN     "participantResultId" TEXT,
  ADD COLUMN     "prescriptionsGenerated" INTEGER,
  ADD COLUMN     "productAvailable" BOOLEAN,
  ADD COLUMN     "seriesEndDate" TIMESTAMP(3),
  ADD COLUMN     "seriesIntervalDays" INTEGER;

-- Backfill: ownerId starts out as whoever the follow-up's own assignment is
-- assigned to — the only reasonable default for every pre-existing row,
-- since FollowUp.ownerId didn't exist before this migration.
UPDATE "follow_ups" f
SET "ownerId" = a."userId"
FROM "activity_assignments" a
WHERE a.id = f."assignmentId";

ALTER TABLE "follow_ups" ALTER COLUMN "ownerId" SET NOT NULL;

-- CreateTable
CREATE TABLE "follow_up_reassignments" (
    "id" TEXT NOT NULL,
    "followUpId" TEXT NOT NULL,
    "previousOwnerId" TEXT NOT NULL,
    "newOwnerId" TEXT NOT NULL,
    "reassignedBy" TEXT NOT NULL,
    "reassignedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "follow_up_reassignments_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "follow_up_reassignments_followUpId_idx" ON "follow_up_reassignments"("followUpId");

-- CreateIndex
CREATE UNIQUE INDEX "follow_ups_parentFollowUpId_key" ON "follow_ups"("parentFollowUpId");

-- CreateIndex
CREATE INDEX "follow_ups_participantResultId_idx" ON "follow_ups"("participantResultId");

-- CreateIndex
CREATE INDEX "follow_ups_ownerId_idx" ON "follow_ups"("ownerId");

-- AddForeignKey
ALTER TABLE "follow_ups" ADD CONSTRAINT "follow_ups_participantResultId_fkey" FOREIGN KEY ("participantResultId") REFERENCES "assignment_participant_results"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "follow_ups" ADD CONSTRAINT "follow_ups_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "follow_ups" ADD CONSTRAINT "follow_ups_parentFollowUpId_fkey" FOREIGN KEY ("parentFollowUpId") REFERENCES "follow_ups"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "follow_up_reassignments" ADD CONSTRAINT "follow_up_reassignments_followUpId_fkey" FOREIGN KEY ("followUpId") REFERENCES "follow_ups"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "follow_up_reassignments" ADD CONSTRAINT "follow_up_reassignments_previousOwnerId_fkey" FOREIGN KEY ("previousOwnerId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "follow_up_reassignments" ADD CONSTRAINT "follow_up_reassignments_newOwnerId_fkey" FOREIGN KEY ("newOwnerId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "follow_up_reassignments" ADD CONSTRAINT "follow_up_reassignments_reassignedBy_fkey" FOREIGN KEY ("reassignedBy") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
