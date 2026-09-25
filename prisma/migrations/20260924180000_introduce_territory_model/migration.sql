-- Introduce Territory as its own entity (revises the previous migration's
-- approach): Province/Ville/Commune/Quartier become pure geography with no
-- code of their own; Territory is a specific selected path through that
-- geography and owns the one auto-generated code. User/Client/
-- UserTerritoryAssignment/Target switch from four independent
-- province/ville/commune/quartier FKs to a single territoryId.

-- === Part 1: revert the per-level codes added in the previous migration ===

DROP INDEX IF EXISTS "provinces_code_key";
DROP INDEX IF EXISTS "villes_code_key";
DROP INDEX IF EXISTS "communes_code_key";
DROP INDEX IF EXISTS "quartiers_code_key";

ALTER TABLE "provinces" DROP COLUMN "code";
ALTER TABLE "villes" DROP COLUMN "code";
ALTER TABLE "communes" DROP COLUMN "code";
ALTER TABLE "quartiers" DROP COLUMN "code";

-- === Part 2: create the Territory table ===

CREATE TABLE "territories" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "status" "Status" NOT NULL DEFAULT 'ACTIVE',
    "provinceId" TEXT NOT NULL,
    "villeId" TEXT,
    "communeId" TEXT,
    "quartierId" TEXT,
    "pathKey" TEXT NOT NULL,
    "createdBy" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedBy" TEXT,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "territories_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "territories_code_key" ON "territories"("code");
CREATE UNIQUE INDEX "territories_pathKey_key" ON "territories"("pathKey");

ALTER TABLE "territories" ADD CONSTRAINT "territories_provinceId_fkey" FOREIGN KEY ("provinceId") REFERENCES "provinces"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "territories" ADD CONSTRAINT "territories_villeId_fkey" FOREIGN KEY ("villeId") REFERENCES "villes"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "territories" ADD CONSTRAINT "territories_communeId_fkey" FOREIGN KEY ("communeId") REFERENCES "communes"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "territories" ADD CONSTRAINT "territories_quartierId_fkey" FOREIGN KEY ("quartierId") REFERENCES "quartiers"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- === Part 3: backfill one Territory per existing geography row ===
--
-- Every Province/Ville/Commune/Quartier row today is implicitly "a
-- territory" in the old model (whichever level an admin stopped at). This
-- mirrors that exactly: one Territory per existing row, carrying its full
-- ancestor path, numbered sequentially across all four levels together
-- (ordered by original createdAt) so codes read as one continuous series.

WITH all_paths AS (
    SELECT p."id" AS "provinceId", NULL::text AS "villeId", NULL::text AS "communeId", NULL::text AS "quartierId", p."createdAt" AS "sortAt"
    FROM "provinces" p

    UNION ALL

    SELECT v."provinceId", v."id", NULL::text, NULL::text, v."createdAt"
    FROM "villes" v

    UNION ALL

    SELECT v."provinceId", c."villeId", c."id", NULL::text, c."createdAt"
    FROM "communes" c
    JOIN "villes" v ON v."id" = c."villeId"

    UNION ALL

    SELECT v."provinceId", cm."villeId", q."communeId", q."id", q."createdAt"
    FROM "quartiers" q
    JOIN "communes" cm ON cm."id" = q."communeId"
    JOIN "villes" v ON v."id" = cm."villeId"
),
numbered AS (
    SELECT
        "provinceId", "villeId", "communeId", "quartierId",
        ROW_NUMBER() OVER (ORDER BY "sortAt") AS rn,
        gen_random_uuid()::text AS new_id
    FROM all_paths
)
INSERT INTO "territories" ("id", "code", "status", "provinceId", "villeId", "communeId", "quartierId", "pathKey", "createdAt", "updatedAt")
SELECT
    new_id,
    'TER-' || LPAD(rn::text, 5, '0'),
    'ACTIVE',
    "provinceId", "villeId", "communeId", "quartierId",
    "provinceId" || ':' || COALESCE("villeId", '-') || ':' || COALESCE("communeId", '-') || ':' || COALESCE("quartierId", '-'),
    now(), now()
FROM numbered;

-- === Part 4: User — collapse 4 FKs into territoryId ===

ALTER TABLE "users" ADD COLUMN "territoryId" TEXT;

UPDATE "users" u
SET "territoryId" = t."id"
FROM "territories" t
WHERE u."provinceId" IS NOT NULL
  AND t."pathKey" = u."provinceId" || ':' || COALESCE(u."villeId", '-') || ':' || COALESCE(u."communeId", '-') || ':' || COALESCE(u."quartierId", '-');

ALTER TABLE "users" DROP CONSTRAINT IF EXISTS "users_provinceId_fkey";
ALTER TABLE "users" DROP CONSTRAINT IF EXISTS "users_villeId_fkey";
ALTER TABLE "users" DROP CONSTRAINT IF EXISTS "users_communeId_fkey";
ALTER TABLE "users" DROP CONSTRAINT IF EXISTS "users_quartierId_fkey";
ALTER TABLE "users" DROP COLUMN "provinceId";
ALTER TABLE "users" DROP COLUMN "villeId";
ALTER TABLE "users" DROP COLUMN "communeId";
ALTER TABLE "users" DROP COLUMN "quartierId";

ALTER TABLE "users" ADD CONSTRAINT "users_territoryId_fkey" FOREIGN KEY ("territoryId") REFERENCES "territories"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- === Part 5: Client — collapse 4 FKs into territoryId ===

ALTER TABLE "clients" ADD COLUMN "territoryId" TEXT;

UPDATE "clients" c
SET "territoryId" = t."id"
FROM "territories" t
WHERE c."provinceId" IS NOT NULL
  AND t."pathKey" = c."provinceId" || ':' || COALESCE(c."villeId", '-') || ':' || COALESCE(c."communeId", '-') || ':' || COALESCE(c."quartierId", '-');

ALTER TABLE "clients" DROP CONSTRAINT IF EXISTS "clients_provinceId_fkey";
ALTER TABLE "clients" DROP CONSTRAINT IF EXISTS "clients_villeId_fkey";
ALTER TABLE "clients" DROP CONSTRAINT IF EXISTS "clients_communeId_fkey";
ALTER TABLE "clients" DROP CONSTRAINT IF EXISTS "clients_quartierId_fkey";
ALTER TABLE "clients" DROP COLUMN "provinceId";
ALTER TABLE "clients" DROP COLUMN "villeId";
ALTER TABLE "clients" DROP COLUMN "communeId";
ALTER TABLE "clients" DROP COLUMN "quartierId";

ALTER TABLE "clients" ADD CONSTRAINT "clients_territoryId_fkey" FOREIGN KEY ("territoryId") REFERENCES "territories"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- === Part 6: UserTerritoryAssignment — collapse 4 FKs into one required territoryId ===
--
-- Each existing row has exactly one of the four level FKs populated. The
-- matching Territory row is the one whose own FKs match at that level and
-- stop there (deeper levels null) — Territory rows from Part 3 mirror this
-- "stop at whichever level" shape exactly, so each case matches uniquely.

ALTER TABLE "user_territory_assignments" ADD COLUMN "territoryId" TEXT;

UPDATE "user_territory_assignments" uta
SET "territoryId" = t."id"
FROM "territories" t
WHERE uta."provinceId" IS NOT NULL
  AND t."provinceId" = uta."provinceId" AND t."villeId" IS NULL AND t."communeId" IS NULL AND t."quartierId" IS NULL;

UPDATE "user_territory_assignments" uta
SET "territoryId" = t."id"
FROM "territories" t
WHERE uta."villeId" IS NOT NULL
  AND t."villeId" = uta."villeId" AND t."communeId" IS NULL AND t."quartierId" IS NULL;

UPDATE "user_territory_assignments" uta
SET "territoryId" = t."id"
FROM "territories" t
WHERE uta."communeId" IS NOT NULL
  AND t."communeId" = uta."communeId" AND t."quartierId" IS NULL;

UPDATE "user_territory_assignments" uta
SET "territoryId" = t."id"
FROM "territories" t
WHERE uta."quartierId" IS NOT NULL
  AND t."quartierId" = uta."quartierId";

ALTER TABLE "user_territory_assignments" DROP CONSTRAINT IF EXISTS "user_territory_assignments_provinceId_fkey";
ALTER TABLE "user_territory_assignments" DROP CONSTRAINT IF EXISTS "user_territory_assignments_villeId_fkey";
ALTER TABLE "user_territory_assignments" DROP CONSTRAINT IF EXISTS "user_territory_assignments_communeId_fkey";
ALTER TABLE "user_territory_assignments" DROP CONSTRAINT IF EXISTS "user_territory_assignments_quartierId_fkey";

DROP INDEX IF EXISTS "user_territory_assignments_userId_provinceId_key";
DROP INDEX IF EXISTS "user_territory_assignments_userId_villeId_key";
DROP INDEX IF EXISTS "user_territory_assignments_userId_communeId_key";
DROP INDEX IF EXISTS "user_territory_assignments_userId_quartierId_key";

ALTER TABLE "user_territory_assignments" DROP COLUMN "provinceId";
ALTER TABLE "user_territory_assignments" DROP COLUMN "villeId";
ALTER TABLE "user_territory_assignments" DROP COLUMN "communeId";
ALTER TABLE "user_territory_assignments" DROP COLUMN "quartierId";

ALTER TABLE "user_territory_assignments" ALTER COLUMN "territoryId" SET NOT NULL;
ALTER TABLE "user_territory_assignments" ADD CONSTRAINT "user_territory_assignments_territoryId_fkey" FOREIGN KEY ("territoryId") REFERENCES "territories"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
CREATE UNIQUE INDEX "user_territory_assignments_userId_territoryId_key" ON "user_territory_assignments"("userId", "territoryId");

-- === Part 7: Target — rename quartierId to territoryId (table is empty) ===

ALTER TABLE "targets" DROP CONSTRAINT IF EXISTS "targets_quartierId_fkey";
ALTER TABLE "targets" RENAME COLUMN "quartierId" TO "territoryId";
ALTER TABLE "targets" ADD CONSTRAINT "targets_territoryId_fkey" FOREIGN KEY ("territoryId") REFERENCES "territories"("id") ON DELETE SET NULL ON UPDATE CASCADE;
