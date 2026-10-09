-- Rename Person -> Contact (the Persons module), and Center.contact -> mobileNo.
--
-- Hand-written in-place renames, not Prisma's DROP + CREATE, so no rows are
-- lost. Index/constraint names are renamed too so they match what Prisma
-- expects for the new names (no schema drift afterwards).

-- Center's own free-text "contact" field becomes "mobileNo", freeing the
-- word "contact" for the new module.
ALTER TABLE "centers" RENAME COLUMN "contact" TO "mobileNo";

-- Tables
ALTER TABLE "persons" RENAME TO "contacts";
ALTER TABLE "person_types" RENAME TO "contact_types";
ALTER TABLE "person_centers" RENAME TO "contact_centers";
ALTER TABLE "person_center_roles" RENAME TO "contact_center_roles";

-- Columns
ALTER TABLE "contacts" RENAME COLUMN "personTypeId" TO "contactTypeId";
ALTER TABLE "contact_centers" RENAME COLUMN "personId" TO "contactId";

-- Primary keys
ALTER TABLE "contacts" RENAME CONSTRAINT "persons_pkey" TO "contacts_pkey";
ALTER TABLE "contact_types" RENAME CONSTRAINT "person_types_pkey" TO "contact_types_pkey";
ALTER TABLE "contact_centers" RENAME CONSTRAINT "person_centers_pkey" TO "contact_centers_pkey";
ALTER TABLE "contact_center_roles" RENAME CONSTRAINT "person_center_roles_pkey" TO "contact_center_roles_pkey";

-- Foreign keys
ALTER TABLE "contacts" RENAME CONSTRAINT "persons_personTypeId_fkey" TO "contacts_contactTypeId_fkey";
ALTER TABLE "contacts" RENAME CONSTRAINT "persons_specializationId_fkey" TO "contacts_specializationId_fkey";
ALTER TABLE "contacts" RENAME CONSTRAINT "persons_territoryId_fkey" TO "contacts_territoryId_fkey";
ALTER TABLE "contact_centers" RENAME CONSTRAINT "person_centers_personId_fkey" TO "contact_centers_contactId_fkey";
ALTER TABLE "contact_centers" RENAME CONSTRAINT "person_centers_centerId_fkey" TO "contact_centers_centerId_fkey";
ALTER TABLE "contact_centers" RENAME CONSTRAINT "person_centers_roleAtCenterId_fkey" TO "contact_centers_roleAtCenterId_fkey";

-- Indexes
ALTER INDEX "person_types_code_key" RENAME TO "contact_types_code_key";
ALTER INDEX "person_center_roles_code_key" RENAME TO "contact_center_roles_code_key";
ALTER INDEX "persons_code_key" RENAME TO "contacts_code_key";
ALTER INDEX "persons_personTypeId_status_idx" RENAME TO "contacts_contactTypeId_status_idx";
ALTER INDEX "persons_specializationId_status_idx" RENAME TO "contacts_specializationId_status_idx";
ALTER INDEX "persons_territoryId_status_idx" RENAME TO "contacts_territoryId_status_idx";
ALTER INDEX "persons_name_idx" RENAME TO "contacts_name_idx";
ALTER INDEX "person_centers_centerId_idx" RENAME TO "contact_centers_centerId_idx";
ALTER INDEX "person_centers_personId_centerId_key" RENAME TO "contact_centers_contactId_centerId_key";

-- Code sequence
ALTER SEQUENCE "person_code_seq" RENAME TO "contact_code_seq";

-- Existing codes move to the new CON- prefix (PER-00001 -> CON-00001); the
-- numbers are kept, so the sequence continues without gaps or collisions.
UPDATE "contacts" SET "code" = 'CON-' || substring("code" from 5) WHERE "code" LIKE 'PER-%';

-- Permission catalogue: existing role grants keep pointing at the same row.
UPDATE "permissions" SET "key" = 'contacts:manage' WHERE "key" = 'persons:manage';
