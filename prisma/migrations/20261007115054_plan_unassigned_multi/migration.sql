-- DropForeignKey
ALTER TABLE "plans" DROP CONSTRAINT "plans_userId_fkey";

-- DropIndex
DROP INDEX "plans_userId_date_key";

-- AlterTable
ALTER TABLE "plans" ALTER COLUMN "userId" DROP NOT NULL,
ALTER COLUMN "date" DROP NOT NULL;

-- CreateIndex
CREATE INDEX "plans_userId_date_idx" ON "plans"("userId", "date");

-- AddForeignKey
ALTER TABLE "plans" ADD CONSTRAINT "plans_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
