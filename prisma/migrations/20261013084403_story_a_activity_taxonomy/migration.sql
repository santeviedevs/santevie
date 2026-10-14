-- Story A: activity type taxonomy + type-aware execution fields.
--
-- `Activity.type` (the ActivityType enum: CAMPAIGN / EVENT / OTHER) is
-- replaced by a seeded `activity_type_defs` lookup table. The three legacy
-- enum values are preserved as their own rows below and every existing
-- Activity row is backfilled onto the matching row *before* the old column
-- is dropped — no reclassification, no data loss, safe to run against a
-- database that already has Activity rows.

-- CreateEnum
CREATE TYPE "ActivityCategory" AS ENUM ('STANDARD_EVENT', 'PRESCRIPTION_TRACKING', 'EMBALLAGE');

-- CreateTable
CREATE TABLE "activity_type_defs" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "category" "ActivityCategory" NOT NULL,
    "status" "Status" NOT NULL DEFAULT 'ACTIVE',
    "defaultFollowUpInitialOffsetDays" INTEGER,
    "defaultFollowUpRecurrenceIntervalDays" INTEGER,
    "defaultFollowUpSeriesDurationDays" INTEGER,
    "createdBy" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedBy" TEXT,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "activity_type_defs_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "activity_type_defs_code_key" ON "activity_type_defs"("code");

-- Preserve the legacy enum values as their own rows, category STANDARD_EVENT
-- (they behaved as plain event-style activities, no type-specific fields),
-- no auto-follow-up config. updatedAt has no column default in this schema
-- (matches every other model's convention), so it must be supplied explicitly
-- on insert.
INSERT INTO "activity_type_defs" ("id", "code", "name", "category", "status", "updatedAt") VALUES
  ('activity-type-campaign', 'CAMPAIGN', 'Campaign', 'STANDARD_EVENT', 'ACTIVE', CURRENT_TIMESTAMP),
  ('activity-type-event', 'EVENT', 'Event', 'STANDARD_EVENT', 'ACTIVE', CURRENT_TIMESTAMP),
  ('activity-type-other', 'OTHER', 'Other', 'STANDARD_EVENT', 'ACTIVE', CURRENT_TIMESTAMP);

-- AlterTable: add typeId nullable first so existing rows can be backfilled
-- before the NOT NULL constraint is applied.
ALTER TABLE "activities" ADD COLUMN "typeId" TEXT;

-- Backfill: every existing Activity row maps onto its corresponding legacy
-- ActivityTypeDef row, keyed by the old enum value's own text representation.
UPDATE "activities" SET "typeId" = 'activity-type-' || lower("type"::text);

-- Now safe to enforce NOT NULL and add the rest of the new columns.
ALTER TABLE "activities"
  ALTER COLUMN "typeId" SET NOT NULL,
  DROP COLUMN "type",
  ADD COLUMN "departmentName" TEXT,
  ADD COLUMN "foodExpense" DECIMAL(12,2),
  ADD COLUMN "location" TEXT,
  ADD COLUMN "speakerContactId" TEXT,
  ADD COLUMN "transportExpense" DECIMAL(12,2);

-- DropEnum
DROP TYPE "ActivityType";

-- AlterTable
ALTER TABLE "activity_assignments" ADD COLUMN     "actualParticipants" INTEGER,
ADD COLUMN     "beneficiaryFeedback" TEXT,
ADD COLUMN     "childrenConsulted" INTEGER,
ADD COLUMN     "commitments" TEXT,
ADD COLUMN     "expectedParticipants" INTEGER,
ADD COLUMN     "foodExpense" DECIMAL(12,2),
ADD COLUMN     "hcpFeedback" TEXT,
ADD COLUMN     "nightShiftTiming" TEXT,
ADD COLUMN     "outcomeNotes" TEXT,
ADD COLUMN     "pregnantWomenReached" INTEGER,
ADD COLUMN     "prescriberCount" INTEGER,
ADD COLUMN     "recipientContactId" TEXT,
ADD COLUMN     "requirementCategoryId" TEXT,
ADD COLUMN     "requirementValue" DECIMAL(14,2),
ADD COLUMN     "supportProvidedDescription" TEXT,
ADD COLUMN     "transportExpense" DECIMAL(12,2);

-- CreateTable
CREATE TABLE "requirement_category_defs" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "status" "Status" NOT NULL DEFAULT 'ACTIVE',
    "createdBy" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedBy" TEXT,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "requirement_category_defs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "activity_products" (
    "id" TEXT NOT NULL,
    "activityId" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "availability" TEXT,
    "createdBy" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedBy" TEXT,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "activity_products_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "activity_participants" (
    "id" TEXT NOT NULL,
    "activityId" TEXT NOT NULL,
    "contactId" TEXT NOT NULL,
    "invited" BOOLEAN NOT NULL DEFAULT true,
    "createdBy" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedBy" TEXT,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "activity_participants_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "assignment_participant_results" (
    "id" TEXT NOT NULL,
    "assignmentId" TEXT NOT NULL,
    "contactId" TEXT NOT NULL,
    "present" BOOLEAN NOT NULL DEFAULT false,
    "unplanned" BOOLEAN NOT NULL DEFAULT false,
    "feedback" TEXT,
    "prescriptionsGenerated" INTEGER,
    "createdBy" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedBy" TEXT,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "assignment_participant_results_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "assignment_product_results" (
    "id" TEXT NOT NULL,
    "assignmentId" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "unplanned" BOOLEAN NOT NULL DEFAULT false,
    "prescriptionsGenerated" INTEGER,
    "businessValueGenerated" DECIMAL(14,2),
    "samplesProvided" INTEGER,
    "createdBy" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedBy" TEXT,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "assignment_product_results_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "requirement_category_defs_code_key" ON "requirement_category_defs"("code");

-- CreateIndex
CREATE UNIQUE INDEX "activity_products_activityId_productId_key" ON "activity_products"("activityId", "productId");

-- CreateIndex
CREATE UNIQUE INDEX "activity_participants_activityId_contactId_key" ON "activity_participants"("activityId", "contactId");

-- CreateIndex
CREATE UNIQUE INDEX "assignment_participant_results_assignmentId_contactId_key" ON "assignment_participant_results"("assignmentId", "contactId");

-- CreateIndex
CREATE UNIQUE INDEX "assignment_product_results_assignmentId_productId_key" ON "assignment_product_results"("assignmentId", "productId");

-- CreateIndex
CREATE INDEX "activities_typeId_idx" ON "activities"("typeId");

-- CreateIndex
CREATE INDEX "activity_assignments_requirementCategoryId_idx" ON "activity_assignments"("requirementCategoryId");

-- CreateIndex
CREATE INDEX "activity_assignments_recipientContactId_idx" ON "activity_assignments"("recipientContactId");

-- AddForeignKey
ALTER TABLE "activities" ADD CONSTRAINT "activities_typeId_fkey" FOREIGN KEY ("typeId") REFERENCES "activity_type_defs"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "activities" ADD CONSTRAINT "activities_speakerContactId_fkey" FOREIGN KEY ("speakerContactId") REFERENCES "contacts"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "activity_products" ADD CONSTRAINT "activity_products_activityId_fkey" FOREIGN KEY ("activityId") REFERENCES "activities"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "activity_products" ADD CONSTRAINT "activity_products_productId_fkey" FOREIGN KEY ("productId") REFERENCES "products"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "activity_participants" ADD CONSTRAINT "activity_participants_activityId_fkey" FOREIGN KEY ("activityId") REFERENCES "activities"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "activity_participants" ADD CONSTRAINT "activity_participants_contactId_fkey" FOREIGN KEY ("contactId") REFERENCES "contacts"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "activity_assignments" ADD CONSTRAINT "activity_assignments_requirementCategoryId_fkey" FOREIGN KEY ("requirementCategoryId") REFERENCES "requirement_category_defs"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "activity_assignments" ADD CONSTRAINT "activity_assignments_recipientContactId_fkey" FOREIGN KEY ("recipientContactId") REFERENCES "contacts"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "assignment_participant_results" ADD CONSTRAINT "assignment_participant_results_assignmentId_fkey" FOREIGN KEY ("assignmentId") REFERENCES "activity_assignments"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "assignment_participant_results" ADD CONSTRAINT "assignment_participant_results_contactId_fkey" FOREIGN KEY ("contactId") REFERENCES "contacts"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "assignment_product_results" ADD CONSTRAINT "assignment_product_results_assignmentId_fkey" FOREIGN KEY ("assignmentId") REFERENCES "activity_assignments"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "assignment_product_results" ADD CONSTRAINT "assignment_product_results_productId_fkey" FOREIGN KEY ("productId") REFERENCES "products"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
