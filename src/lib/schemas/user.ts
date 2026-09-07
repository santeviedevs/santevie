import { z } from "zod";

const employeeCode = z
  .string()
  .trim()
  .min(2, "Employee code is required")
  .max(32, "Employee code must be 32 characters or fewer");

const name = z.string().trim().min(1, "Name is required").max(120);

const email = z.email("Enter a valid email address");

// cuid — matches the id format Prisma generates for Role/Territory/User.
const id = z.string().min(1);

export const createUserSchema = z.object({
  employeeCode,
  name,
  email,
  roleId: id,
  managerId: id.nullish(),
  homeTerritoryId: id.nullish(),
});

export type CreateUserInput = z.infer<typeof createUserSchema>;

export const updateUserSchema = createUserSchema.extend({
  id,
});

export type UpdateUserInput = z.infer<typeof updateUserSchema>;

export const userFiltersSchema = z.object({
  q: z.string().trim().optional(),
  roleId: z.string().optional(),
  territoryId: z.string().optional(),
  status: z.enum(["ACTIVE", "INACTIVE"]).optional(),
});

export type UserFilters = z.infer<typeof userFiltersSchema>;
