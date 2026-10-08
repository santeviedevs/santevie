-- DropForeignKey
ALTER TABLE "activities" DROP CONSTRAINT "activities_ownerId_fkey";

-- AlterTable
ALTER TABLE "activities" ALTER COLUMN "ownerId" DROP NOT NULL;

-- AddForeignKey
ALTER TABLE "activities" ADD CONSTRAINT "activities_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Permission catalogue change (data, not schema): activities:manage-own is
-- renamed to activities:respond-own, and a new activities:assign is granted
-- to MANAGER and ADMIN only. Done here rather than by re-running the seed
-- because the seed only ever adds rows — it would leave the old permission
-- and its role links behind. Renaming the row keeps every existing role
-- link (ADMIN, MANAGER, SUPERVISOR, DELEGATE) pointing at the new name.
-- Each statement is guarded so the migration is safe if the seed has
-- already created these rows.
UPDATE "permissions"
SET "key" = 'activities:respond-own', "updatedAt" = CURRENT_TIMESTAMP
WHERE "key" = 'activities:manage-own'
  AND NOT EXISTS (SELECT 1 FROM "permissions" WHERE "key" = 'activities:respond-own');

INSERT INTO "permissions" ("id", "key", "createdAt", "updatedAt")
SELECT gen_random_uuid()::text, 'activities:assign', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
WHERE NOT EXISTS (SELECT 1 FROM "permissions" WHERE "key" = 'activities:assign');

INSERT INTO "role_permissions" ("id", "roleId", "permissionId", "createdAt", "updatedAt")
SELECT gen_random_uuid()::text, r."id", p."id", CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
FROM "roles" r
CROSS JOIN "permissions" p
WHERE r."name" IN ('ADMIN', 'MANAGER')
  AND p."key" = 'activities:assign'
ON CONFLICT ("roleId", "permissionId") DO NOTHING;
