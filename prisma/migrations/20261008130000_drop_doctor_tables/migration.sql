-- DropForeignKey
ALTER TABLE "doctors" DROP CONSTRAINT "doctors_clientId_fkey";

-- DropForeignKey
ALTER TABLE "doctor_hospitals" DROP CONSTRAINT "doctor_hospitals_doctorId_fkey";

-- DropForeignKey
ALTER TABLE "doctor_hospitals" DROP CONSTRAINT "doctor_hospitals_hospitalId_fkey";

-- DropTable
DROP TABLE "doctors";

-- DropTable
DROP TABLE "doctor_hospitals";
