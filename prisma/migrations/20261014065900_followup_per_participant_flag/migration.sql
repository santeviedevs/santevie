/*
  Story B — distinguishes RTM's per-participant follow-up fan-out from the
  single assignment-level chain every other configured type uses. See the
  schema comment on ActivityTypeDef.defaultFollowUpPerParticipant for why
  this is a separate flag rather than inferred from recurrenceIntervalDays.
*/

-- AlterTable
ALTER TABLE "activity_type_defs" ADD COLUMN     "defaultFollowUpPerParticipant" BOOLEAN NOT NULL DEFAULT false;

-- Data: RTM is the only type that fans out per participant.
UPDATE "activity_type_defs" SET "defaultFollowUpPerParticipant" = true WHERE "code" = 'RTM';
