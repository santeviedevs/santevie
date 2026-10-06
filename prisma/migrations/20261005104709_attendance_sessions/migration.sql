-- Attendance moves from one check-in/check-out pair per day to any number
-- of cycles per day: a new attendance_sessions table holds each cycle, and
-- attendances becomes the day-level row (status + ownership) only.

-- CreateTable
CREATE TABLE "attendance_sessions" (
    "id" TEXT NOT NULL,
    "attendanceId" TEXT NOT NULL,
    "checkInAt" TIMESTAMP(3) NOT NULL,
    "checkInLat" DECIMAL(9,6),
    "checkInLng" DECIMAL(9,6),
    "checkInDeviceAt" TIMESTAMP(3),
    "checkInAccuracy" DECIMAL(10,2),
    "checkOutAt" TIMESTAMP(3),
    "checkOutLat" DECIMAL(9,6),
    "checkOutLng" DECIMAL(9,6),
    "checkOutDeviceAt" TIMESTAMP(3),
    "checkOutAccuracy" DECIMAL(10,2),
    "createdBy" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedBy" TEXT,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "attendance_sessions_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "attendance_sessions_attendanceId_idx" ON "attendance_sessions"("attendanceId");

-- Enforces at the database level that a day never has more than one open
-- (checkOutAt IS NULL) cycle running at once — the same guarantee S4-01
-- gives one active visit per delegate, applied here to attendance.
CREATE UNIQUE INDEX "attendance_sessions_one_open_per_day" ON "attendance_sessions"("attendanceId") WHERE "checkOutAt" IS NULL;

-- AddForeignKey
ALTER TABLE "attendance_sessions" ADD CONSTRAINT "attendance_sessions_attendanceId_fkey" FOREIGN KEY ("attendanceId") REFERENCES "attendances"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- Backfill: each existing attendances row's check-in/out pair becomes one
-- session, before the now-redundant columns are dropped from attendances.
INSERT INTO "attendance_sessions" (
    "id", "attendanceId", "checkInAt", "checkInLat", "checkInLng", "checkInDeviceAt", "checkInAccuracy",
    "checkOutAt", "checkOutLat", "checkOutLng", "checkOutDeviceAt", "checkOutAccuracy",
    "createdBy", "createdAt", "updatedBy", "updatedAt"
)
SELECT
    gen_random_uuid()::text, "id", "checkInAt", "checkInLat", "checkInLng", "checkInDeviceAt", "checkInAccuracy",
    "checkOutAt", "checkOutLat", "checkOutLng", "checkOutDeviceAt", "checkOutAccuracy",
    "createdBy", "createdAt", "updatedBy", "updatedAt"
FROM "attendances"
WHERE "checkInAt" IS NOT NULL;

-- AlterTable: drop the now-redundant per-day check-in/out columns —
-- every non-null row was preserved above as an attendance_sessions row
-- first.
ALTER TABLE "attendances"
    DROP COLUMN "checkInAt",
    DROP COLUMN "checkInLat",
    DROP COLUMN "checkInLng",
    DROP COLUMN "checkInDeviceAt",
    DROP COLUMN "checkInAccuracy",
    DROP COLUMN "checkOutAt",
    DROP COLUMN "checkOutLat",
    DROP COLUMN "checkOutLng",
    DROP COLUMN "checkOutDeviceAt",
    DROP COLUMN "checkOutAccuracy";
