-- Rename Client -> Center everywhere in the database, in place.
--
-- Hand-written on purpose: Prisma's generated diff for a rename is
-- DROP + CREATE, which would destroy the data. Everything below is a pure
-- rename, so rows, ids and relationships are untouched. Index and
-- constraint names are renamed too so they match what Prisma expects for
-- the new model/column names (no schema drift afterwards).

-- Tables
ALTER TABLE "clients" RENAME TO "centers";
ALTER TABLE "client_types" RENAME TO "center_types";

-- Columns (clientId -> centerId)
ALTER TABLE "hospitals" RENAME COLUMN "clientId" TO "centerId";
ALTER TABLE "visits" RENAME COLUMN "clientId" TO "centerId";
ALTER TABLE "orders" RENAME COLUMN "clientId" TO "centerId";
ALTER TABLE "plan_items" RENAME COLUMN "clientId" TO "centerId";
ALTER TABLE "activities" RENAME COLUMN "clientId" TO "centerId";
ALTER TABLE "person_centers" RENAME COLUMN "clientId" TO "centerId";

-- Primary keys
ALTER TABLE "centers" RENAME CONSTRAINT "clients_pkey" TO "centers_pkey";
ALTER TABLE "center_types" RENAME CONSTRAINT "client_types_pkey" TO "center_types_pkey";

-- Foreign keys
ALTER TABLE "centers" RENAME CONSTRAINT "clients_typeId_fkey" TO "centers_typeId_fkey";
ALTER TABLE "centers" RENAME CONSTRAINT "clients_territoryId_fkey" TO "centers_territoryId_fkey";
ALTER TABLE "hospitals" RENAME CONSTRAINT "hospitals_clientId_fkey" TO "hospitals_centerId_fkey";
ALTER TABLE "visits" RENAME CONSTRAINT "visits_clientId_fkey" TO "visits_centerId_fkey";
ALTER TABLE "orders" RENAME CONSTRAINT "orders_clientId_fkey" TO "orders_centerId_fkey";
ALTER TABLE "plan_items" RENAME CONSTRAINT "plan_items_clientId_fkey" TO "plan_items_centerId_fkey";
ALTER TABLE "activities" RENAME CONSTRAINT "activities_clientId_fkey" TO "activities_centerId_fkey";
ALTER TABLE "person_centers" RENAME CONSTRAINT "person_centers_clientId_fkey" TO "person_centers_centerId_fkey";

-- Indexes
ALTER INDEX "client_types_code_key" RENAME TO "center_types_code_key";
ALTER INDEX "clients_code_key" RENAME TO "centers_code_key";
ALTER INDEX "clients_territoryId_status_idx" RENAME TO "centers_territoryId_status_idx";
ALTER INDEX "clients_typeId_status_idx" RENAME TO "centers_typeId_status_idx";
ALTER INDEX "hospitals_clientId_key" RENAME TO "hospitals_centerId_key";
ALTER INDEX "plan_items_planId_clientId_key" RENAME TO "plan_items_planId_centerId_key";
ALTER INDEX "person_centers_clientId_idx" RENAME TO "person_centers_centerId_idx";
ALTER INDEX "person_centers_personId_clientId_key" RENAME TO "person_centers_personId_centerId_key";

-- Enum value (keeps existing import_batches rows)
ALTER TYPE "ImportEntity" RENAME VALUE 'CLIENT' TO 'CENTER';

-- Permission catalogue: existing role grants keep pointing at the same row.
UPDATE "permissions" SET "key" = 'centers:manage' WHERE "key" = 'clients:manage';
