-- RenameColumn: requiresLocationOnCheckIn now gates both check-in and
-- check-out (S3-03), so the flag is renamed to drop the check-in-only
-- implication. Explicit RENAME COLUMN to preserve existing data rather than
-- drop-and-recreate.
ALTER TABLE "roles" RENAME COLUMN "requiresLocationOnCheckIn" TO "requiresLocation";
ALTER TABLE "users" RENAME COLUMN "requiresLocationOnCheckIn" TO "requiresLocation";
