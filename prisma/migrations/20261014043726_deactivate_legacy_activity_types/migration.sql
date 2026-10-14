-- The client asked for the legacy CAMPAIGN/EVENT/OTHER types to no longer
-- appear in the activity-creation dropdown. They stay in activity_type_defs
-- (so any existing Activity row still referencing one keeps a valid
-- typeId — no reclassification, no data loss) but are deactivated; the
-- active-types query (listStandardEventActivityTypes) already filters on
-- status = 'ACTIVE', so no application code change is needed beyond this
-- data correction.
UPDATE "activity_type_defs"
SET "status" = 'INACTIVE'
WHERE "code" IN ('CAMPAIGN', 'EVENT', 'OTHER');
