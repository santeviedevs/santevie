import { z } from "zod";

// cuid — matches the id format Prisma generates for ClientType/Client/
// Doctor/Hospital/Province/Ville/Commune/Quartier.
const id = z.string().min(1);

const code = z
  .string()
  .trim()
  .min(2, "Code is required")
  .max(32, "Code must be 32 characters or fewer");

const name = z.string().trim().min(1, "Name is required").max(160);

// Latitude/longitude are optional at every layer, not defaulted to 0 or
// nullable-with-a-fallback — a Client legitimately has no coordinates yet
// (imported from an address-only source), and that must stay distinguishable
// from "coordinates deliberately cleared", never silently coerced to 0,0.
// Not z.coerce — the map picker always sets a real number via setValue, and
// coercing here would widen the resolver's inferred input type to `unknown`
// for this field, which then can't satisfy react-hook-form's shared
// create/update resolver type (see UserForm/ClientForm's single `schema`
// variable typed over both).
const latitude = z.number().min(-90).max(90).nullish();
const longitude = z.number().min(-180).max(180).nullish();

// Doctor-specific fields, only meaningful when the selected ClientType code
// is DOCTOR — the service layer checks that match independently of this
// shape, since a tampered request could send doctor fields under a
// different type.
export const doctorDetailsSchema = z.object({
  doctorType: z.string().trim().max(80).nullish(),
  gender: z.string().trim().max(20).nullish(),
  department: z.string().trim().max(120).nullish(),
  mobileNo: z.string().trim().max(32).nullish(),
});
export type DoctorDetailsInput = z.infer<typeof doctorDetailsSchema>;

// Hospital-specific fields, only meaningful when the selected ClientType
// code is HOSPITAL.
export const hospitalDetailsSchema = z.object({
  hospitalCategory: z.string().trim().max(120).nullish(),
});
export type HospitalDetailsInput = z.infer<typeof hospitalDetailsSchema>;

export const createClientSchema = z.object({
  code,
  name,
  typeId: id,
  contact: z.string().trim().max(80).nullish(),
  address: z.string().trim().max(240).nullish(),
  latitude,
  longitude,
  // The Territory this client is located in — a Territory already
  // represents whatever depth (Province alone, down to a full Quartier
  // path) it maps to, so one optional field is enough.
  territoryId: id.nullish(),
  doctor: doctorDetailsSchema.optional(),
  hospital: hospitalDetailsSchema.optional(),
  // Only meaningful when `doctor` is present — the set of Hospital ids this
  // Doctor is associated with (DoctorHospital), not Doctor's own field.
  hospitalIds: z.array(id).optional(),
});
export type CreateClientInput = z.infer<typeof createClientSchema>;

export const updateClientSchema = createClientSchema.extend({
  id,
  // Absent means "leave as-is"; present is an explicit set, same convention
  // as UpdateUserInput's status.
  status: z.enum(["ACTIVE", "INACTIVE"]).optional(),
});
export type UpdateClientInput = z.infer<typeof updateClientSchema>;

export const clientFiltersSchema = z.object({
  q: z.string().trim().optional(),
  typeId: z.string().optional(),
  territoryId: z.string().optional(),
  status: z.enum(["ACTIVE", "INACTIVE"]).optional(),
  // "Missing coordinates" — surfaces the clients proximity validation can't
  // work for yet (S2-02's "flag clients with no coordinates").
  missingCoordinates: z.coerce.boolean().optional(),
});
export type ClientFilters = z.infer<typeof clientFiltersSchema>;
