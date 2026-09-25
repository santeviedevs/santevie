import { z } from "zod";

const employeeCode = z
  .string()
  .trim()
  .min(2, "Employee code is required")
  .max(32, "Employee code must be 32 characters or fewer");

const name = z.string().trim().min(1, "Name is required").max(120);

const email = z.email("Enter a valid email address");

// cuid — matches the id format Prisma generates for Role/User/Territory.
const id = z.string().min(1);

export const createUserSchema = z.object({
  employeeCode,
  name,
  email,
  roleId: id,
  managerId: id.nullish(),
  // The Territory this user is scoped to — a Territory already represents
  // whatever depth (Province alone, down to a full Quartier path) it maps
  // to, so one optional field is enough.
  territoryId: id.nullish(),
});

export type CreateUserInput = z.infer<typeof createUserSchema>;

export const updateUserSchema = createUserSchema.extend({
  id,
  // Absent means "leave as-is" (e.g. the create form never sends it);
  // present is an explicit set, which is how the edit form's active/
  // inactive toggle applies alongside the rest of a save.
  status: z.enum(["ACTIVE", "INACTIVE"]).optional(),
});

export type UpdateUserInput = z.infer<typeof updateUserSchema>;

export const userFiltersSchema = z.object({
  q: z.string().trim().optional(),
  roleId: z.string().optional(),
  // "Reports to" — filters to users whose direct manager is this id.
  // Currently only surfaced on the Team screen (S2-04), but kept on the
  // shared schema alongside roleId rather than split out, since it's a
  // generic user-list filter, not something Team-specific.
  managerId: z.string().optional(),
  territoryId: z.string().optional(),
  status: z.enum(["ACTIVE", "INACTIVE"]).optional(),
});

export type UserFilters = z.infer<typeof userFiltersSchema>;
