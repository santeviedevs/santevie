-- Restructure the flat "territories" table into a 4-level administrative
-- hierarchy (Province > Ville > Commune > Quartier), matching how the
-- client's own location data is actually structured. Each existing
-- territory row is preserved by carrying its name into a new
-- Province/Ville/Commune/Quartier chain (one per level, same name), so no
-- existing user/client/target assignment is lost — see the data migration
-- block below.

-- CreateTable
CREATE TABLE "provinces" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "status" "Status" NOT NULL DEFAULT 'ACTIVE',
    "createdBy" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedBy" TEXT,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "provinces_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "villes" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "status" "Status" NOT NULL DEFAULT 'ACTIVE',
    "provinceId" TEXT NOT NULL,
    "createdBy" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedBy" TEXT,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "villes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "communes" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "status" "Status" NOT NULL DEFAULT 'ACTIVE',
    "villeId" TEXT NOT NULL,
    "createdBy" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedBy" TEXT,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "communes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "quartiers" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "status" "Status" NOT NULL DEFAULT 'ACTIVE',
    "communeId" TEXT NOT NULL,
    "createdBy" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedBy" TEXT,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "quartiers_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "provinces_name_key" ON "provinces"("name");

-- CreateIndex
CREATE UNIQUE INDEX "villes_provinceId_name_key" ON "villes"("provinceId", "name");

-- CreateIndex
CREATE UNIQUE INDEX "communes_villeId_name_key" ON "communes"("villeId", "name");

-- CreateIndex
CREATE UNIQUE INDEX "quartiers_communeId_name_key" ON "quartiers"("communeId", "name");

-- AddForeignKey
ALTER TABLE "villes" ADD CONSTRAINT "villes_provinceId_fkey" FOREIGN KEY ("provinceId") REFERENCES "provinces"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "communes" ADD CONSTRAINT "communes_villeId_fkey" FOREIGN KEY ("villeId") REFERENCES "villes"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "quartiers" ADD CONSTRAINT "quartiers_communeId_fkey" FOREIGN KEY ("communeId") REFERENCES "communes"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AlterTable: new location columns, nullable for now so the backfill below
-- can populate them before any NOT NULL constraint is applied.
ALTER TABLE "users" ADD COLUMN "provinceId" TEXT;
ALTER TABLE "users" ADD COLUMN "villeId" TEXT;
ALTER TABLE "users" ADD COLUMN "communeId" TEXT;
ALTER TABLE "users" ADD COLUMN "quartierId" TEXT;

ALTER TABLE "clients" ADD COLUMN "quartierId" TEXT;

ALTER TABLE "targets" ADD COLUMN "quartierId" TEXT;

-- Data migration: one Province/Ville/Commune/Quartier chain per existing
-- territory (all four levels named after the territory), then repoint
-- every user, client and target that referenced that territory at the new
-- Quartier (and, for users, the whole chain above it — a user's existing
-- assignment was a single territory, i.e. full depth, so it backfills to
-- all four new columns rather than just the leaf).
DO $$
DECLARE
  t RECORD;
  new_province_id TEXT;
  new_ville_id TEXT;
  new_commune_id TEXT;
  new_quartier_id TEXT;
BEGIN
  FOR t IN SELECT "id", "name", "status" FROM "territories" LOOP
    new_province_id := gen_random_uuid()::text;
    new_ville_id := gen_random_uuid()::text;
    new_commune_id := gen_random_uuid()::text;
    new_quartier_id := gen_random_uuid()::text;

    INSERT INTO "provinces" ("id", "name", "status", "createdAt", "updatedAt")
    VALUES (new_province_id, t."name", t."status", now(), now());

    INSERT INTO "villes" ("id", "name", "status", "provinceId", "createdAt", "updatedAt")
    VALUES (new_ville_id, t."name", t."status", new_province_id, now(), now());

    INSERT INTO "communes" ("id", "name", "status", "villeId", "createdAt", "updatedAt")
    VALUES (new_commune_id, t."name", t."status", new_ville_id, now(), now());

    INSERT INTO "quartiers" ("id", "name", "status", "communeId", "createdAt", "updatedAt")
    VALUES (new_quartier_id, t."name", t."status", new_commune_id, now(), now());

    UPDATE "users"
    SET "provinceId" = new_province_id,
        "villeId" = new_ville_id,
        "communeId" = new_commune_id,
        "quartierId" = new_quartier_id
    WHERE "homeTerritoryId" = t."id";

    UPDATE "clients" SET "quartierId" = new_quartier_id WHERE "territoryId" = t."id";

    UPDATE "targets" SET "quartierId" = new_quartier_id WHERE "territoryId" = t."id";
  END LOOP;
END $$;

-- Drop the old territory columns/constraints/table now that every
-- reference has been repointed above.
ALTER TABLE "users" DROP CONSTRAINT "users_homeTerritoryId_fkey";
ALTER TABLE "users" DROP COLUMN "homeTerritoryId";

ALTER TABLE "clients" DROP CONSTRAINT "clients_territoryId_fkey";
ALTER TABLE "clients" DROP COLUMN "territoryId";

ALTER TABLE "targets" DROP CONSTRAINT "targets_territoryId_fkey";
ALTER TABLE "targets" DROP COLUMN "territoryId";

DROP TABLE "territories";

-- clients.quartierId is required (every existing client was backfilled
-- above, since territoryId was itself required beforehand).
ALTER TABLE "clients" ALTER COLUMN "quartierId" SET NOT NULL;

-- AddForeignKey
ALTER TABLE "users" ADD CONSTRAINT "users_provinceId_fkey" FOREIGN KEY ("provinceId") REFERENCES "provinces"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "users" ADD CONSTRAINT "users_villeId_fkey" FOREIGN KEY ("villeId") REFERENCES "villes"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "users" ADD CONSTRAINT "users_communeId_fkey" FOREIGN KEY ("communeId") REFERENCES "communes"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "users" ADD CONSTRAINT "users_quartierId_fkey" FOREIGN KEY ("quartierId") REFERENCES "quartiers"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "clients" ADD CONSTRAINT "clients_quartierId_fkey" FOREIGN KEY ("quartierId") REFERENCES "quartiers"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "targets" ADD CONSTRAINT "targets_quartierId_fkey" FOREIGN KEY ("quartierId") REFERENCES "quartiers"("id") ON DELETE SET NULL ON UPDATE CASCADE;
