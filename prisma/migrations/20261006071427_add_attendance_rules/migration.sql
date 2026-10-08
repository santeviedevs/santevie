-- CreateTable
CREATE TABLE "attendance_rules" (
    "id" TEXT NOT NULL,
    "expectedStartMinutes" INTEGER NOT NULL,
    "lateGraceMinutes" INTEGER NOT NULL,
    "minimumWorkedMinutes" INTEGER NOT NULL,
    "territoryId" TEXT,
    "ownerId" TEXT,
    "targetUserId" TEXT,
    "createdBy" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedBy" TEXT,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "attendance_rules_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "attendance_rules_territoryId_idx" ON "attendance_rules"("territoryId");

-- CreateIndex
CREATE INDEX "attendance_rules_ownerId_idx" ON "attendance_rules"("ownerId");

-- CreateIndex
CREATE INDEX "attendance_rules_targetUserId_idx" ON "attendance_rules"("targetUserId");

-- AddForeignKey
ALTER TABLE "attendance_rules" ADD CONSTRAINT "attendance_rules_territoryId_fkey" FOREIGN KEY ("territoryId") REFERENCES "territories"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "attendance_rules" ADD CONSTRAINT "attendance_rules_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "attendance_rules" ADD CONSTRAINT "attendance_rules_targetUserId_fkey" FOREIGN KEY ("targetUserId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
