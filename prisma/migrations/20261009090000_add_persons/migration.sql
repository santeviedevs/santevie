-- CreateEnum
CREATE TYPE "Gender" AS ENUM ('MALE', 'FEMALE', 'OTHER');

-- CreateTable
CREATE TABLE "person_types" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "createdBy" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedBy" TEXT,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "person_types_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "specializations" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "createdBy" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedBy" TEXT,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "specializations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "person_center_roles" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "createdBy" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedBy" TEXT,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "person_center_roles_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "persons" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "gender" "Gender",
    "mobile" TEXT,
    "status" "Status" NOT NULL DEFAULT 'ACTIVE',
    "personTypeId" TEXT NOT NULL,
    "specializationId" TEXT NOT NULL,
    "territoryId" TEXT NOT NULL,
    "createdBy" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedBy" TEXT,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "persons_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "person_centers" (
    "id" TEXT NOT NULL,
    "personId" TEXT NOT NULL,
    "clientId" TEXT NOT NULL,
    "roleAtCenterId" TEXT NOT NULL,
    "createdBy" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedBy" TEXT,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "person_centers_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "person_types_code_key" ON "person_types"("code");

-- CreateIndex
CREATE UNIQUE INDEX "specializations_code_key" ON "specializations"("code");

-- CreateIndex
CREATE UNIQUE INDEX "person_center_roles_code_key" ON "person_center_roles"("code");

-- CreateIndex
CREATE UNIQUE INDEX "persons_code_key" ON "persons"("code");

-- CreateIndex
CREATE INDEX "persons_personTypeId_status_idx" ON "persons"("personTypeId", "status");

-- CreateIndex
CREATE INDEX "persons_specializationId_status_idx" ON "persons"("specializationId", "status");

-- CreateIndex
CREATE INDEX "persons_territoryId_status_idx" ON "persons"("territoryId", "status");

-- CreateIndex
CREATE INDEX "persons_name_idx" ON "persons"("name");

-- CreateIndex
CREATE INDEX "person_centers_clientId_idx" ON "person_centers"("clientId");

-- CreateIndex
CREATE UNIQUE INDEX "person_centers_personId_clientId_key" ON "person_centers"("personId", "clientId");

-- AddForeignKey
ALTER TABLE "persons" ADD CONSTRAINT "persons_personTypeId_fkey" FOREIGN KEY ("personTypeId") REFERENCES "person_types"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "persons" ADD CONSTRAINT "persons_specializationId_fkey" FOREIGN KEY ("specializationId") REFERENCES "specializations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "persons" ADD CONSTRAINT "persons_territoryId_fkey" FOREIGN KEY ("territoryId") REFERENCES "territories"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "person_centers" ADD CONSTRAINT "person_centers_personId_fkey" FOREIGN KEY ("personId") REFERENCES "persons"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "person_centers" ADD CONSTRAINT "person_centers_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "clients"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "person_centers" ADD CONSTRAINT "person_centers_roleAtCenterId_fkey" FOREIGN KEY ("roleAtCenterId") REFERENCES "person_center_roles"("id") ON DELETE RESTRICT ON UPDATE CASCADE;


-- Backend-generated Person codes (PER-00001). A sequence, not count+1, so
-- concurrent creates and deletions can never hand out the same number.
CREATE SEQUENCE "person_code_seq" START 1;
