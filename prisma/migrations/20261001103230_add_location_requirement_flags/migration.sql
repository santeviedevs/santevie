-- AlterTable
ALTER TABLE "attendances" ADD COLUMN     "checkInAccuracy" DECIMAL(10,2),
ADD COLUMN     "checkInDeviceAt" TIMESTAMP(3);

-- AlterTable
ALTER TABLE "roles" ADD COLUMN     "requiresLocationOnCheckIn" BOOLEAN NOT NULL DEFAULT false;

-- AlterTable
ALTER TABLE "users" ADD COLUMN     "requiresLocationOnCheckIn" BOOLEAN;
