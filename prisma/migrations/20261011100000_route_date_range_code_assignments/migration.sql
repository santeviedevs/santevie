-- Route date range, human-readable code and assignment history.
--
-- Hand-written on purpose: Prisma's generated diff for the date -> startDate
-- rename is DROP + ADD, which would destroy the assigned dates. Everything
-- below preserves rows, ids and relationships.

-- 1. date -> startDate, plus endDate. Existing assigned routes keep their one
--    day as a one-day range (endDate = startDate); unassigned routes stay null.
ALTER TABLE "routes" RENAME COLUMN "date" TO "startDate";
ALTER TABLE "routes" ADD COLUMN "endDate" TIMESTAMP(3);
UPDATE "routes" SET "endDate" = "startDate";
ALTER INDEX "routes_userId_date_idx" RENAME TO "routes_userId_startDate_idx";

-- 2. Route code (RT-00001): sequence, backfill in creation order, then lock in.
CREATE SEQUENCE "route_code_seq";
ALTER TABLE "routes" ADD COLUMN "code" TEXT;
WITH ordered AS (
  SELECT "id", row_number() OVER (ORDER BY "createdAt", "id") AS n FROM "routes"
)
UPDATE "routes" r
SET "code" = 'RT-' || lpad(ordered.n::text, 5, '0')
FROM ordered
WHERE r."id" = ordered."id";
SELECT setval('"route_code_seq"', (SELECT count(*) FROM "routes") + 1, false);
ALTER TABLE "routes" ALTER COLUMN "code" SET NOT NULL;
CREATE UNIQUE INDEX "routes_code_key" ON "routes"("code");

-- 3. Assignment history (append-only).
CREATE TYPE "RouteAssignmentAction" AS ENUM ('ASSIGNED', 'REASSIGNED', 'CANCELLED');

CREATE TABLE "route_assignments" (
    "id" TEXT NOT NULL,
    "routeId" TEXT NOT NULL,
    "action" "RouteAssignmentAction" NOT NULL,
    "userId" TEXT NOT NULL,
    "startDate" TIMESTAMP(3),
    "endDate" TIMESTAMP(3),
    "createdBy" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedBy" TEXT,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "route_assignments_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "route_assignments_routeId_createdAt_idx" ON "route_assignments"("routeId", "createdAt");
CREATE INDEX "route_assignments_userId_idx" ON "route_assignments"("userId");

ALTER TABLE "route_assignments" ADD CONSTRAINT "route_assignments_routeId_fkey" FOREIGN KEY ("routeId") REFERENCES "routes"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "route_assignments" ADD CONSTRAINT "route_assignments_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- 4. Backfill history for routes that are already assigned, so the record
--    starts complete rather than empty.
INSERT INTO "route_assignments" ("id", "routeId", "action", "userId", "startDate", "endDate", "createdBy", "createdAt", "updatedBy", "updatedAt")
SELECT 'ra_' || "id", "id", 'ASSIGNED', "userId", "startDate", "endDate", "updatedBy", "updatedAt", "updatedBy", "updatedAt"
FROM "routes"
WHERE "userId" IS NOT NULL;
