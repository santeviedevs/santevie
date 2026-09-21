import { z } from "zod";

const employeeCode = z
  .string()
  .trim()
  .min(2, "Employee code is required")
  .max(32, "Employee code must be 32 characters or fewer");

const name = z.string().trim().min(1, "Name is required").max(120);

const email = z.email("Enter a valid email address");

// cuid — matches the id format Prisma generates for Role/User/Province/
// Ville/Commune/Quartier.
const id = z.string().min(1);

export const createUserSchema = z.object({
  employeeCode,
  name,
  email,
  roleId: id,
  managerId: id.nullish(),
  // Independent per level — a Manager might be scoped to a whole Province
  // with nothing below it set, while a Delegate is scoped down to one
  // Quartier. The cascading select on the form lets an admin stop at any
  // level, so each is its own optional field rather than one leaf id.
  provinceId: id.nullish(),
  villeId: id.nullish(),
  communeId: id.nullish(),
  quartierId: id.nullish(),
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
  provinceId: z.string().optional(),
  villeId: z.string().optional(),
  communeId: z.string().optional(),
  quartierId: z.string().optional(),
  status: z.enum(["ACTIVE", "INACTIVE"]).optional(),
});

export type UserFilters = z.infer<typeof userFiltersSchema>;
