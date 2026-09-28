-- CreateEnum
CREATE TYPE "ImportEntity" AS ENUM ('TERRITORY', 'CLIENT', 'PRODUCT');

-- AddColumn (nullable first — existing rows are backfilled below, since
-- `code` can't be added as NOT NULL in one step against a table that
-- already has data)
ALTER TABLE "provinces" ADD COLUMN "code" TEXT;
ALTER TABLE "villes" ADD COLUMN "code" TEXT;
ALTER TABLE "communes" ADD COLUMN "code" TEXT;
ALTER TABLE "quartiers" ADD COLUMN "code" TEXT;

-- Backfill: derive a readable code from the existing name, suffixed with
-- a slice of the row's own id to guarantee global uniqueness even where
-- two rows under different parents share a name (e.g. two "Centre"
-- communes in different villes). Admins can rename these to something
-- tidier later via the edit form, which now supports editing `code`.
UPDATE "provinces" SET "code" = UPPER(REGEXP_REPLACE(TRIM("name"), '[^A-Za-z0-9]+', '-', 'g')) || '-' || SUBSTRING("id", 1, 6);
UPDATE "villes" SET "code" = UPPER(REGEXP_REPLACE(TRIM("name"), '[^A-Za-z0-9]+', '-', 'g')) || '-' || SUBSTRING("id", 1, 6);
UPDATE "communes" SET "code" = UPPER(REGEXP_REPLACE(TRIM("name"), '[^A-Za-z0-9]+', '-', 'g')) || '-' || SUBSTRING("id", 1, 6);
UPDATE "quartiers" SET "code" = UPPER(REGEXP_REPLACE(TRIM("name"), '[^A-Za-z0-9]+', '-', 'g')) || '-' || SUBSTRING("id", 1, 6);

-- AlterColumn: now safe to enforce NOT NULL
ALTER TABLE "provinces" ALTER COLUMN "code" SET NOT NULL;
ALTER TABLE "villes" ALTER COLUMN "code" SET NOT NULL;
ALTER TABLE "communes" ALTER COLUMN "code" SET NOT NULL;
ALTER TABLE "quartiers" ALTER COLUMN "code" SET NOT NULL;

-- CreateIndex
CREATE UNIQUE INDEX "provinces_code_key" ON "provinces"("code");
CREATE UNIQUE INDEX "villes_code_key" ON "villes"("code");
CREATE UNIQUE INDEX "communes_code_key" ON "communes"("code");
CREATE UNIQUE INDEX "quartiers_code_key" ON "quartiers"("code");

-- CreateTable
CREATE TABLE "import_batches" (
    "id" TEXT NOT NULL,
    "entity" "ImportEntity" NOT NULL,
    "fileName" TEXT NOT NULL,
    "totalRows" INTEGER NOT NULL,
    "createdCount" INTEGER NOT NULL,
    "updatedCount" INTEGER NOT NULL,
    "rejectedCount" INTEGER NOT NULL,
    "createdBy" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedBy" TEXT,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "import_batches_pkey" PRIMARY KEY ("id")
);
