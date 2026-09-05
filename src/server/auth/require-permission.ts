import { auth } from "@/server/auth";

import { hasPermission, type Permission } from "./permissions";

export class ForbiddenError extends Error {
  constructor(permission: Permission) {
    super(`Missing permission: ${permission}`);
    this.name = "ForbiddenError";
  }
}

// Call this first, before doing any work, in every Server Action and route
// handler that isn't public. Hiding a menu item is presentation, not
// security — this is the actual enforcement boundary.
export async function requirePermission(permission: Permission) {
  const session = await auth();

  if (!session?.user || !hasPermission(session.user.permissions, permission)) {
    throw new ForbiddenError(permission);
  }

  return session;
}
