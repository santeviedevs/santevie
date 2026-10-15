-- Drop ContactCenterRole: it only ever encoded MEDECIN/INFIRMIER, the same
-- classification Contact.contactTypeId already carries, and specializationId
-- (now per Contact<->Center link, see the previous migration) covers the
-- per-center distinction it existed for. No replacement column needed.

ALTER TABLE "contact_centers" DROP CONSTRAINT "contact_centers_roleAtCenterId_fkey";
ALTER TABLE "contact_centers" DROP COLUMN "roleAtCenterId";

DROP TABLE "contact_center_roles";
