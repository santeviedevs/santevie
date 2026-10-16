-- CreateTable
CREATE TABLE "prescription_targets" (
    "id" TEXT NOT NULL,
    "contactId" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "monthlyTarget" INTEGER NOT NULL,
    "periodMonth" INTEGER NOT NULL,
    "periodYear" INTEGER NOT NULL,
    "updateSequence" INTEGER NOT NULL DEFAULT 0,
    "createdBy" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedBy" TEXT,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "prescription_targets_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "prescription_updates" (
    "id" TEXT NOT NULL,
    "targetId" TEXT NOT NULL,
    "sequenceNo" INTEGER NOT NULL,
    "cumulativeAchieved" INTEGER NOT NULL,
    "feedback" TEXT,
    "challenges" TEXT,
    "followUpDate" TIMESTAMP(3),
    "acknowledgedDecrease" BOOLEAN NOT NULL DEFAULT false,
    "correctionReason" TEXT,
    "recordedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "recordedBy" TEXT NOT NULL,

    CONSTRAINT "prescription_updates_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "prescription_target_revisions" (
    "id" TEXT NOT NULL,
    "targetId" TEXT NOT NULL,
    "previousTarget" INTEGER NOT NULL,
    "newTarget" INTEGER NOT NULL,
    "reason" TEXT,
    "changedBy" TEXT NOT NULL,
    "changedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "prescription_target_revisions_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "prescription_targets_userId_periodYear_periodMonth_idx" ON "prescription_targets"("userId", "periodYear", "periodMonth");

-- CreateIndex
CREATE UNIQUE INDEX "prescription_targets_contactId_productId_userId_periodMonth_key" ON "prescription_targets"("contactId", "productId", "userId", "periodMonth", "periodYear");

-- CreateIndex
CREATE INDEX "prescription_updates_targetId_sequenceNo_idx" ON "prescription_updates"("targetId", "sequenceNo");

-- CreateIndex
CREATE UNIQUE INDEX "prescription_updates_targetId_sequenceNo_key" ON "prescription_updates"("targetId", "sequenceNo");

-- CreateIndex
CREATE INDEX "prescription_target_revisions_targetId_idx" ON "prescription_target_revisions"("targetId");

-- AddForeignKey
ALTER TABLE "prescription_targets" ADD CONSTRAINT "prescription_targets_contactId_fkey" FOREIGN KEY ("contactId") REFERENCES "contacts"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "prescription_targets" ADD CONSTRAINT "prescription_targets_productId_fkey" FOREIGN KEY ("productId") REFERENCES "products"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "prescription_targets" ADD CONSTRAINT "prescription_targets_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "prescription_updates" ADD CONSTRAINT "prescription_updates_targetId_fkey" FOREIGN KEY ("targetId") REFERENCES "prescription_targets"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "prescription_updates" ADD CONSTRAINT "prescription_updates_recordedBy_fkey" FOREIGN KEY ("recordedBy") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "prescription_target_revisions" ADD CONSTRAINT "prescription_target_revisions_targetId_fkey" FOREIGN KEY ("targetId") REFERENCES "prescription_targets"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "prescription_target_revisions" ADD CONSTRAINT "prescription_target_revisions_changedBy_fkey" FOREIGN KEY ("changedBy") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
