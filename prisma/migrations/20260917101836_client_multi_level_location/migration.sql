-- DropForeignKey
ALTER TABLE "clients" DROP CONSTRAINT "clients_quartierId_fkey";

-- AlterTable
ALTER TABLE "clients" ADD COLUMN     "communeId" TEXT,
ADD COLUMN     "provinceId" TEXT,
ADD COLUMN     "villeId" TEXT,
ALTER COLUMN "quartierId" DROP NOT NULL;

-- AddForeignKey
ALTER TABLE "clients" ADD CONSTRAINT "clients_provinceId_fkey" FOREIGN KEY ("provinceId") REFERENCES "provinces"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "clients" ADD CONSTRAINT "clients_villeId_fkey" FOREIGN KEY ("villeId") REFERENCES "villes"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "clients" ADD CONSTRAINT "clients_communeId_fkey" FOREIGN KEY ("communeId") REFERENCES "communes"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "clients" ADD CONSTRAINT "clients_quartierId_fkey" FOREIGN KEY ("quartierId") REFERENCES "quartiers"("id") ON DELETE SET NULL ON UPDATE CASCADE;
