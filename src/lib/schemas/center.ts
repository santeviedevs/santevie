import { z } from "zod";

import { paginationParamsSchema } from "@/lib/pagination";

// cuid — matches the id format Prisma generates for CenterType/Center/
// Doctor/Hospital/Province/Ville/Commune/Quartier.
const id = z.string().min(1);

const code = z
  .string()
  .trim()
  .min(2, "Code is required")
  .max(32, "Code must be 32 characters or fewer");

const name = z.string().trim().min(1, "Name is required").max(160);

// Latitude/longitude are optional at every layer, not defaulted to 0 or
// nullable-with-a-fallback — a Center legitimately has no coordinates yet
// (imported from an address-only source), and that must stay distinguishable
// from "coordinates deliberately cleared", never silently coerced to 0,0.
// Not z.coerce — the map picker always sets a real number via setValue, and
// coercing here would widen the resolver's inferred input type to `unknown`
// for this field, which then can't satisfy react-hook-form's shared
// create/update resolver type (see UserForm/CenterForm's single `schema`
// variable typed over both).
const latitude = z.number().min(-90).max(90).nullish();
const longitude = z.number().min(-180).max(180).nullish();

// Hospital-specific fields, only meaningful when the selected CenterType
// code is HOSPITAL.
export const hospitalDetailsSchema = z.object({
  hospitalCategory: z.string().trim().max(120).nullish(),
});
export type HospitalDetailsInput = z.infer<typeof hospitalDetailsSchema>;

export const createCenterSchema = z.object({
  code,
  name,
  typeId: id,
  responsiblePerson: z.string().trim().max(160).nullish(),
  mobileNo: z.string().trim().max(80).nullish(),
  address: z.string().trim().max(240).nullish(),
  latitude,
  longitude,
  // The Territory this center is located in — a Territory already
  // represents whatever depth (Province alone, down to a full Quartier
  // path) it maps to, so one optional field is enough.
  territoryId: id.nullish(),
  hospital: hospitalDetailsSchema.optional(),
});
export type CreateCenterInput = z.infer<typeof createCenterSchema>;

export const updateCenterSchema = createCenterSchema.extend({
  id,
  // Absent means "leave as-is"; present is an explicit set, same convention
  // as UpdateUserInput's status.
  status: z.enum(["ACTIVE", "INACTIVE"]).optional(),
});
export type UpdateCenterInput = z.infer<typeof updateCenterSchema>;

export const centerFiltersSchema = z
  .object({
    q: z.string().trim().optional(),
    typeId: z.string().optional(),
    territoryId: z.string().optional(),
    status: z.enum(["ACTIVE", "INACTIVE"]).optional(),
    // "Missing coordinates" — surfaces the centers proximity validation can't
    // work for yet (S2-02's "flag centers with no coordinates").
    missingCoordinates: z.coerce.boolean().optional(),
  })
  .merge(paginationParamsSchema);
export type CenterFilters = z.infer<typeof centerFiltersSchema>;
