/*
  Warnings:

  - You are about to drop the column `action` on the `route_assignments` table. All the data in the column will be lost.
  - You are about to drop the column `status` on the `route_item_contacts` table. All the data in the column will be lost.
  - You are about to drop the column `status` on the `route_items` table. All the data in the column will be lost.
  - You are about to drop the column `endDate` on the `routes` table. All the data in the column will be lost.
  - You are about to drop the column `startDate` on the `routes` table. All the data in the column will be lost.
  - You are about to drop the column `userId` on the `routes` table. All the data in the column will be lost.

  Data preserved by the backfill below, run before any of the drops: every
  route's current single holder (routes.userId/startDate/endDate) becomes
  one ACTIVE route_assignments row, and that route's route_items /
  route_item_contacts status values become route_item_executions /
  route_item_contact_executions rows against that new assignment. A route
  that currently has no holder (userId IS NULL) has nothing to backfill —
  there is no assignment left to attribute its items' history to.
*/

-- CreateEnum
CREATE TYPE "RouteAssignmentStatus" AS ENUM ('ACTIVE', 'CANCELLED');

-- AlterTable: add the new column before backfilling into it (old `action`
-- column stays in place until the backfill below has run).
ALTER TABLE "route_assignments" ADD COLUMN     "status" "RouteAssignmentStatus" NOT NULL DEFAULT 'ACTIVE';

-- CreateTable
CREATE TABLE "route_item_executions" (
    "id" TEXT NOT NULL,
    "routeItemId" TEXT NOT NULL,
    "routeAssignmentId" TEXT NOT NULL,
    "status" "RouteItemStatus" NOT NULL DEFAULT 'PENDING',
    "createdBy" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedBy" TEXT,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "route_item_executions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "route_item_contact_executions" (
    "id" TEXT NOT NULL,
    "routeItemContactId" TEXT NOT NULL,
    "routeAssignmentId" TEXT NOT NULL,
    "status" "RouteItemStatus" NOT NULL DEFAULT 'PENDING',
    "createdBy" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedBy" TEXT,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "route_item_contact_executions_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "route_item_executions_routeAssignmentId_idx" ON "route_item_executions"("routeAssignmentId");

-- CreateIndex
CREATE UNIQUE INDEX "route_item_executions_routeItemId_routeAssignmentId_key" ON "route_item_executions"("routeItemId", "routeAssignmentId");

-- CreateIndex
CREATE INDEX "route_item_contact_executions_routeAssignmentId_idx" ON "route_item_contact_executions"("routeAssignmentId");

-- CreateIndex
CREATE UNIQUE INDEX "route_item_contact_executions_routeItemContactId_routeAssig_key" ON "route_item_contact_executions"("routeItemContactId", "routeAssignmentId");

-- AddForeignKey
ALTER TABLE "route_item_executions" ADD CONSTRAINT "route_item_executions_routeItemId_fkey" FOREIGN KEY ("routeItemId") REFERENCES "route_items"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "route_item_executions" ADD CONSTRAINT "route_item_executions_routeAssignmentId_fkey" FOREIGN KEY ("routeAssignmentId") REFERENCES "route_assignments"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "route_item_contact_executions" ADD CONSTRAINT "route_item_contact_executions_routeItemContactId_fkey" FOREIGN KEY ("routeItemContactId") REFERENCES "route_item_contacts"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "route_item_contact_executions" ADD CONSTRAINT "route_item_contact_executions_routeAssignmentId_fkey" FOREIGN KEY ("routeAssignmentId") REFERENCES "route_assignments"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- Backfill: one ACTIVE route_assignments row per currently-assigned route.
WITH backfilled_assignment AS (
    INSERT INTO "route_assignments" ("id", "routeId", "userId", "status", "startDate", "endDate", "createdBy", "createdAt", "updatedBy", "updatedAt")
    SELECT gen_random_uuid()::text, "id", "userId", 'ACTIVE', "startDate", "endDate", "createdBy", COALESCE("createdAt", now()), "updatedBy", now()
    FROM "routes"
    WHERE "userId" IS NOT NULL
    RETURNING "id" AS "assignmentId", "routeId"
)
-- Backfill: that route's route_items.status becomes route_item_executions
-- against the assignment just created.
INSERT INTO "route_item_executions" ("id", "routeItemId", "routeAssignmentId", "status", "createdBy", "createdAt", "updatedBy", "updatedAt")
SELECT gen_random_uuid()::text, "ri"."id", "ba"."assignmentId", "ri"."status", "ri"."createdBy", "ri"."createdAt", "ri"."updatedBy", now()
FROM "route_items" "ri"
JOIN "backfilled_assignment" "ba" ON "ba"."routeId" = "ri"."routeId";

-- Backfill: that route's route_item_contacts.status becomes
-- route_item_contact_executions against the same assignment, found again by
-- routeId/userId since the CTE above cannot be reused across statements.
INSERT INTO "route_item_contact_executions" ("id", "routeItemContactId", "routeAssignmentId", "status", "createdBy", "createdAt", "updatedBy", "updatedAt")
SELECT gen_random_uuid()::text, "ric"."id", "ra"."id", "ric"."status", "ric"."createdBy", "ric"."createdAt", "ric"."updatedBy", now()
FROM "route_item_contacts" "ric"
JOIN "route_items" "ri" ON "ri"."id" = "ric"."routeItemId"
JOIN "routes" "r" ON "r"."id" = "ri"."routeId"
JOIN "route_assignments" "ra" ON "ra"."routeId" = "r"."id" AND "ra"."userId" = "r"."userId" AND "ra"."status" = 'ACTIVE'
WHERE "r"."userId" IS NOT NULL;

-- DropForeignKey
ALTER TABLE "routes" DROP CONSTRAINT "routes_userId_fkey";

-- DropIndex
DROP INDEX "route_assignments_routeId_createdAt_idx";

-- DropIndex
DROP INDEX "route_assignments_userId_idx";

-- DropIndex
DROP INDEX "routes_userId_startDate_idx";

-- AlterTable
ALTER TABLE "route_assignments" DROP COLUMN "action";

-- AlterTable
ALTER TABLE "route_item_contacts" DROP COLUMN "status";

-- AlterTable
ALTER TABLE "route_items" DROP COLUMN "status";

-- AlterTable
ALTER TABLE "routes" DROP COLUMN "endDate",
DROP COLUMN "startDate",
DROP COLUMN "userId";

-- DropEnum
DROP TYPE "RouteAssignmentAction";

-- CreateIndex
CREATE INDEX "route_assignments_routeId_status_idx" ON "route_assignments"("routeId", "status");

-- CreateIndex
CREATE INDEX "route_assignments_userId_status_idx" ON "route_assignments"("userId", "status");

-- CreateIndex
CREATE INDEX "route_assignments_userId_startDate_idx" ON "route_assignments"("userId", "startDate");
