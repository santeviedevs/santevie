-- Specialization moves from Contact to ContactCenter: a contact can work in
-- different departments at different hospitals (e.g. "Généraliste" at one
-- center, "Pédiatre" at another), which a single Contact-level field can't
-- represent. Matches how roleAtCenterId already works: "a property of the
-- Contact<->Center relationship, never of the Contact itself".
--
-- Hand-written with an explicit backfill so no row loses its specialization
-- in the move, same discipline as the rename_person_to_contact migration.

-- Add the new column nullable first so the backfill below can populate it.
ALTER TABLE "contact_centers" ADD COLUMN "specializationId" TEXT;

-- Every existing ContactCenter link inherits its Contact's current
-- specialization.
UPDATE "contact_centers" cc
SET "specializationId" = c."specializationId"
FROM "contacts" c
WHERE c.id = cc."contactId";

ALTER TABLE "contact_centers" ALTER COLUMN "specializationId" SET NOT NULL;

ALTER TABLE "contact_centers" ADD CONSTRAINT "contact_centers_specializationId_fkey"
  FOREIGN KEY ("specializationId") REFERENCES "specializations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

CREATE INDEX "contact_centers_specializationId_idx" ON "contact_centers"("specializationId");

-- Drop the old Contact-level specialization.
ALTER TABLE "contacts" DROP CONSTRAINT "contacts_specializationId_fkey";
DROP INDEX "contacts_specializationId_status_idx";
ALTER TABLE "contacts" DROP COLUMN "specializationId";
