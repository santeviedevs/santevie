-- CreateEnum
CREATE TYPE "PlanItemStatus" AS ENUM ('PENDING', 'COMPLETED', 'CANCELLED');

-- AlterTable
ALTER TABLE "plan_items" ADD COLUMN     "status" "PlanItemStatus" NOT NULL DEFAULT 'PENDING';
