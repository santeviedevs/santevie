-- CreateTable
CREATE TABLE "emballage_collections" (
    "id" TEXT NOT NULL,
    "centerId" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "visitDate" TIMESTAMP(3) NOT NULL,
    "quantity" DECIMAL(12,2) NOT NULL,
    "remarks" TEXT,
    "correctionCount" INTEGER NOT NULL DEFAULT 0,
    "locked" BOOLEAN NOT NULL DEFAULT false,
    "createdBy" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedBy" TEXT,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "emballage_collections_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "emballage_corrections" (
    "id" TEXT NOT NULL,
    "collectionId" TEXT NOT NULL,
    "previousQuantity" DECIMAL(12,2) NOT NULL,
    "newQuantity" DECIMAL(12,2) NOT NULL,
    "reason" TEXT,
    "correctedBy" TEXT NOT NULL,
    "correctedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "emballage_corrections_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "emballage_report_runs" (
    "id" TEXT NOT NULL,
    "periodMonth" INTEGER NOT NULL,
    "periodYear" INTEGER NOT NULL,
    "finalizedBy" TEXT NOT NULL,
    "finalizedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "emballage_report_runs_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "emballage_collections_centerId_productId_idx" ON "emballage_collections"("centerId", "productId");

-- CreateIndex
CREATE INDEX "emballage_collections_userId_idx" ON "emballage_collections"("userId");

-- CreateIndex
CREATE INDEX "emballage_collections_visitDate_idx" ON "emballage_collections"("visitDate");

-- CreateIndex
CREATE INDEX "emballage_corrections_collectionId_idx" ON "emballage_corrections"("collectionId");

-- CreateIndex
CREATE UNIQUE INDEX "emballage_report_runs_periodMonth_periodYear_key" ON "emballage_report_runs"("periodMonth", "periodYear");

-- AddForeignKey
ALTER TABLE "emballage_collections" ADD CONSTRAINT "emballage_collections_centerId_fkey" FOREIGN KEY ("centerId") REFERENCES "centers"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "emballage_collections" ADD CONSTRAINT "emballage_collections_productId_fkey" FOREIGN KEY ("productId") REFERENCES "products"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "emballage_collections" ADD CONSTRAINT "emballage_collections_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "emballage_corrections" ADD CONSTRAINT "emballage_corrections_collectionId_fkey" FOREIGN KEY ("collectionId") REFERENCES "emballage_collections"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "emballage_corrections" ADD CONSTRAINT "emballage_corrections_correctedBy_fkey" FOREIGN KEY ("correctedBy") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "emballage_report_runs" ADD CONSTRAINT "emballage_report_runs_finalizedBy_fkey" FOREIGN KEY ("finalizedBy") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
