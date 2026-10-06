-- AlterTable: S3-03 check-out gets the same audit columns check-in already
-- has (device-reported timestamp for reference, GPS fix accuracy for the
-- same quality gate applied on check-in).
ALTER TABLE "attendances" ADD COLUMN     "checkOutDeviceAt" TIMESTAMP(3),
ADD COLUMN     "checkOutAccuracy" DECIMAL(10,2);
