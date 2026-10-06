import { z } from "zod";

import { CONTRACT_DURATION_UNITS } from "@/lib/contract-duration";
import { paginationParamsSchema } from "@/lib/pagination";

const employeeCode = z
  .string()
  .trim()
  .min(2, "Employee code is required")
  .max(32, "Employee code must be 32 characters or fewer");

const name = z.string().trim().min(1, "Name is required").max(120);

const email = z.email("Enter a valid email address");

// cuid — matches the id format Prisma generates for Role/User/Territory.
const id = z.string().min(1);

// Tri-state form representation of User.requiresLocation (DB column
// stays Boolean? — this enum maps to null/true/false at the service
// boundary): INHERIT -> null (use the role's default), REQUIRED -> true,
// NOT_REQUIRED -> false. Keeps "inherit" explicit in the UI rather than
// conflating it with an unset/false checkbox.
export const LOCATION_REQUIREMENT_OPTIONS = ["INHERIT", "REQUIRED", "NOT_REQUIRED"] as const;
export type LocationRequirement = (typeof LOCATION_REQUIREMENT_OPTIONS)[number];
const locationRequirement = z.enum(LOCATION_REQUIREMENT_OPTIONS);

// Inverse of the service-layer mapping — used when loading an existing
// user's stored Boolean? into the form's tri-state field.
export function toLocationRequirement(value: boolean | null): LocationRequirement {
  if (value === true) return "REQUIRED";
  if (value === false) return "NOT_REQUIRED";
  return "INHERIT";
}

const contractStartDate = z.iso.date("Enter a valid start date").nullish();
const contractDurationValue = z
  .number()
  .int("Duration must be a whole number")
  .positive("Duration must be greater than zero")
  .nullish();
const contractDurationUnit = z.enum(CONTRACT_DURATION_UNITS).nullish();

// contractExpiryDate is deliberately absent here — it's never accepted from
// the client, only computed server-side (see user-service.ts), same as
// order totals never being trusted from the browser.
const contractFields = {
  contractStartDate,
  contractDurationValue,
  contractDurationUnit,
};

// All three contract fields are set together or all left empty — a start
// date with no duration (or vice versa) can't produce an expiry date.
function checkContractFieldsComplete(
  data: {
    contractStartDate?: string | null;
    contractDurationValue?: number | null;
    contractDurationUnit?: string | null;
  },
  ctx: z.RefinementCtx,
) {
  const present = [data.contractStartDate, data.contractDurationValue, data.contractDurationUnit];
  const filledCount = present.filter((value) => value !== null && value !== undefined).length;
  if (filledCount !== 0 && filledCount !== 3) {
    ctx.addIssue({
      code: "custom",
      path: ["contractStartDate"],
      message: "Enter a start date and duration together, or leave both empty.",
    });
  }
}

export const createUserSchema = z
  .object({
    employeeCode,
    name,
    email,
    roleId: id,
    managerId: id.nullish(),
    // The Territory this user is scoped to — a Territory already represents
    // whatever depth (Province alone, down to a full Quartier path) it maps
    // to, so one optional field is enough.
    territoryId: id.nullish(),
    locationRequirement,
    ...contractFields,
  })
  .superRefine(checkContractFieldsComplete);

export type CreateUserInput = z.infer<typeof createUserSchema>;

export const updateUserSchema = z
  .object({
    id,
    employeeCode,
    name,
    email,
    roleId: id,
    managerId: id.nullish(),
    territoryId: id.nullish(),
    locationRequirement,
    ...contractFields,
    // Absent means "leave as-is" (e.g. the create form never sends it);
    // present is an explicit set, which is how the edit form's active/
    // inactive toggle applies alongside the rest of a save.
    status: z.enum(["ACTIVE", "INACTIVE"]).optional(),
  })
  .superRefine(checkContractFieldsComplete);

export type UpdateUserInput = z.infer<typeof updateUserSchema>;

export const userFiltersSchema = z
  .object({
    q: z.string().trim().optional(),
    roleId: z.string().optional(),
    // "Reports to" — filters to users whose direct manager is this id.
    // Currently only surfaced on the Team screen (S2-04), but kept on the
    // shared schema alongside roleId rather than split out, since it's a
    // generic user-list filter, not something Team-specific.
    managerId: z.string().optional(),
    territoryId: z.string().optional(),
    status: z.enum(["ACTIVE", "INACTIVE"]).optional(),
  })
  .merge(paginationParamsSchema);

export type UserFilters = z.infer<typeof userFiltersSchema>;
