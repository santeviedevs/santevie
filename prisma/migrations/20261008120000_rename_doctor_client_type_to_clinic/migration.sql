-- Doctor is retired as a client type; existing Doctor clients become Clinics.
UPDATE "client_types" SET "code" = 'CLINIC', "name" = 'Clinic' WHERE "code" = 'DOCTOR';
