import { auth } from "@/server/auth";

import { hasPermission, type Permission } from "./permissions";

// Distinct from ForbiddenError: this means there's no session at all (e.g.
// it expired mid-form), not that a logged-in user lacks a permission. The
// two need different client-side handling — this one should send the user
// to sign in again, not show a permission-denied message.
export class SessionExpiredError extends Error {
  constructor() {
    super("Session expired");
    this.name = "SessionExpiredError";
  }
}

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

  if (!session?.user) {
    throw new SessionExpiredError();
  }

  if (!hasPermission(session.user.permissions, permission)) {
    throw new ForbiddenError(permission);
  }

  return session;
}

// For a screen a role can reach through more than one permission — e.g. the
// Team screen: a Supervisor's own reports:view-team and a Manager's broader
// reports:view-all both mean "this role can see a team roster," even though
// they're different grants in the role matrix. The thrown ForbiddenError
// names the first permission only, since there's no single "the" permission
// to report when none matched.
export async function requireAnyPermission(permissions: readonly Permission[]) {
  const session = await auth();

  if (!session?.user) {
    throw new SessionExpiredError();
  }

  if (!permissions.some((permission) => hasPermission(session.user.permissions, permission))) {
    throw new ForbiddenError(permissions[0]!);
  }

  return session;
}
