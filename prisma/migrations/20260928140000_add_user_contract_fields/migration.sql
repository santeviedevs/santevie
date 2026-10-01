-- CreateEnum
CREATE TYPE "ContractDurationUnit" AS ENUM ('DAYS', 'MONTHS', 'YEARS');

-- Nullable: contract data going forward is entered by an admin per user,
-- not required at the database level.
ALTER TABLE "users" ADD COLUMN     "contractStartDate" DATE,
ADD COLUMN     "contractDurationValue" INTEGER,
ADD COLUMN     "contractDurationUnit" "ContractDurationUnit",
ADD COLUMN     "contractExpiryDate" DATE;

-- Backfill: no real contract data exists for users created before this
-- feature, so existing rows get a placeholder — start date taken from when
-- the account was created, a 12-month default duration, and expiry computed
-- from those two. An admin should review and correct these via the edit
-- form once real contract dates are known.
UPDATE "users"
SET
  "contractStartDate" = "createdAt"::date,
  "contractDurationValue" = 12,
  "contractDurationUnit" = 'MONTHS',
  "contractExpiryDate" = ("createdAt"::date + INTERVAL '12 months')::date
WHERE "contractStartDate" IS NULL;
