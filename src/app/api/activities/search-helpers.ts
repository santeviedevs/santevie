import { NextResponse } from "next/server";

import {
  ForbiddenError,
  requirePermission,
  SessionExpiredError,
} from "@/server/auth/require-permission";

// Same 401/403 convention as the routes search handlers: SessionExpiredError
// means "sign in again", ForbiddenError means "signed in but not allowed".
export async function requireActivitiesAssign() {
  try {
    const session = await requirePermission("activities:assign");
    return { ok: true as const, session };
  } catch (error) {
    if (error instanceof SessionExpiredError) {
      return {
        ok: false as const,
        response: NextResponse.json({ error: "Session expired" }, { status: 401 }),
      };
    }
    if (error instanceof ForbiddenError) {
      return {
        ok: false as const,
        response: NextResponse.json({ error: error.message }, { status: 403 }),
      };
    }
    throw error;
  }
}

// Search params arrive as strings; an empty one (`?q=`) means "not
// provided", not an invalid value.
export function searchParamsToObject(url: string): Record<string, string> {
  const params: Record<string, string> = {};
  for (const [key, value] of new URL(url).searchParams) {
    if (value !== "") params[key] = value;
  }
  return params;
}
