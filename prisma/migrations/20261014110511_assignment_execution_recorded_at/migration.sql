/*
  Tracks whether a delegate has ever saved the execution form for an
  assignment, independent of whether any individual field ended up
  non-null (a sparse type like Necessity-Driven can legitimately have
  nothing to fill in). The My Activities "Mark done" button reads this to
  warn/disable before an assignment is marked DONE with execution never
  recorded.
*/

-- AlterTable
ALTER TABLE "activity_assignments" ADD COLUMN     "executionRecordedAt" TIMESTAMP(3);

-- Backfill: any existing assignment that already carries execution data
-- (a participant/product result, or any non-null execution-time scalar)
-- is treated as already recorded, so a delegate who filled this in before
-- the field existed isn't newly blocked on re-saving. Dated to the
-- assignment's own updatedAt, the closest available proxy for "when".
UPDATE "activity_assignments" aa
SET "executionRecordedAt" = aa."updatedAt"
WHERE "executionRecordedAt" IS NULL
  AND (
    EXISTS (SELECT 1 FROM "assignment_participant_results" r WHERE r."assignmentId" = aa.id)
    OR EXISTS (SELECT 1 FROM "assignment_product_results" r WHERE r."assignmentId" = aa.id)
    OR aa."outcomeNotes" IS NOT NULL
    OR aa."hcpFeedback" IS NOT NULL
    OR aa."beneficiaryFeedback" IS NOT NULL
    OR aa."commitments" IS NOT NULL
    OR aa."pregnantWomenReached" IS NOT NULL
    OR aa."childrenConsulted" IS NOT NULL
    OR aa."actualParticipants" IS NOT NULL
    OR aa."nightShiftTiming" IS NOT NULL
    OR aa."requirementValue" IS NOT NULL
    OR aa."supportProvidedDescription" IS NOT NULL
    OR aa."recipientContactId" IS NOT NULL
    OR aa."foodExpense" IS NOT NULL
    OR aa."transportExpense" IS NOT NULL
  );
