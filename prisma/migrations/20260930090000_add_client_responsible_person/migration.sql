-- Nullable: existing clients have no responsible-person data on file yet.
ALTER TABLE "clients" ADD COLUMN     "responsiblePerson" TEXT;
