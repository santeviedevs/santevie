-- Rename Plan -> Route (and permissions plans:* -> routes:*/visits:*) in place.
--
-- Hand-written on purpose: Prisma's generated diff for a rename is
-- DROP + CREATE, which would destroy the data. Everything below is a pure
-- rename, so rows, ids and relationships are untouched. Index and
-- constraint names are renamed too so they match what Prisma expects for
-- the new model/column names (no schema drift afterwards).

-- Tables
ALTER TABLE "plans" RENAME TO "routes";
ALTER TABLE "plan_items" RENAME TO "route_items";

-- Column (planId -> routeId)
ALTER TABLE "route_items" RENAME COLUMN "planId" TO "routeId";

-- Primary keys
ALTER TABLE "routes" RENAME CONSTRAINT "plans_pkey" TO "routes_pkey";
ALTER TABLE "route_items" RENAME CONSTRAINT "plan_items_pkey" TO "route_items_pkey";

-- Foreign keys
ALTER TABLE "routes" RENAME CONSTRAINT "plans_userId_fkey" TO "routes_userId_fkey";
ALTER TABLE "route_items" RENAME CONSTRAINT "plan_items_planId_fkey" TO "route_items_routeId_fkey";
ALTER TABLE "route_items" RENAME CONSTRAINT "plan_items_centerId_fkey" TO "route_items_centerId_fkey";

-- Indexes
ALTER INDEX "plans_userId_date_idx" RENAME TO "routes_userId_date_idx";
ALTER INDEX "plan_items_planId_centerId_key" RENAME TO "route_items_routeId_centerId_key";
ALTER INDEX "plan_items_planId_idx" RENAME TO "route_items_routeId_idx";

-- Enum type
ALTER TYPE "PlanItemStatus" RENAME TO "RouteItemStatus";

-- Permission catalogue: existing role grants keep pointing at the same row.
UPDATE "permissions" SET "key" = 'routes:assign-team' WHERE "key" = 'plans:assign-team';
UPDATE "permissions" SET "key" = 'visits:respond-own' WHERE "key" = 'plans:respond-own';
