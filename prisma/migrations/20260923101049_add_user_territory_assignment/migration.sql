-- CreateTable
CREATE TABLE "user_territory_assignments" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "provinceId" TEXT,
    "villeId" TEXT,
    "communeId" TEXT,
    "quartierId" TEXT,
    "createdBy" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedBy" TEXT,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "user_territory_assignments_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "user_territory_assignments_userId_provinceId_key" ON "user_territory_assignments"("userId", "provinceId");

-- CreateIndex
CREATE UNIQUE INDEX "user_territory_assignments_userId_villeId_key" ON "user_territory_assignments"("userId", "villeId");

-- CreateIndex
CREATE UNIQUE INDEX "user_territory_assignments_userId_communeId_key" ON "user_territory_assignments"("userId", "communeId");

-- CreateIndex
CREATE UNIQUE INDEX "user_territory_assignments_userId_quartierId_key" ON "user_territory_assignments"("userId", "quartierId");

-- AddForeignKey
ALTER TABLE "user_territory_assignments" ADD CONSTRAINT "user_territory_assignments_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_territory_assignments" ADD CONSTRAINT "user_territory_assignments_provinceId_fkey" FOREIGN KEY ("provinceId") REFERENCES "provinces"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_territory_assignments" ADD CONSTRAINT "user_territory_assignments_villeId_fkey" FOREIGN KEY ("villeId") REFERENCES "villes"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_territory_assignments" ADD CONSTRAINT "user_territory_assignments_communeId_fkey" FOREIGN KEY ("communeId") REFERENCES "communes"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_territory_assignments" ADD CONSTRAINT "user_territory_assignments_quartierId_fkey" FOREIGN KEY ("quartierId") REFERENCES "quartiers"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Backfill: each existing user's current home territory (whichever level
-- they were set to) becomes their first row in the new assignment table.
-- Only the deepest non-null level is copied per user — never every
-- ancestor field at once — matching how this table is populated going
-- forward (see the model comment in schema.prisma).
INSERT INTO "user_territory_assignments" ("id", "userId", "provinceId", "villeId", "communeId", "quartierId", "createdAt", "updatedAt")
SELECT
    gen_random_uuid()::text,
    "id",
    CASE WHEN "quartierId" IS NULL AND "communeId" IS NULL AND "villeId" IS NULL THEN "provinceId" END,
    CASE WHEN "quartierId" IS NULL AND "communeId" IS NULL AND "villeId" IS NOT NULL THEN "villeId" END,
    CASE WHEN "quartierId" IS NULL AND "communeId" IS NOT NULL THEN "communeId" END,
    "quartierId",
    CURRENT_TIMESTAMP,
    CURRENT_TIMESTAMP
FROM "users"
WHERE "provinceId" IS NOT NULL OR "villeId" IS NOT NULL OR "communeId" IS NOT NULL OR "quartierId" IS NOT NULL;
