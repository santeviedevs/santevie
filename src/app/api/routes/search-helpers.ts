import { NextResponse } from "next/server";

import {
  ForbiddenError,
  requirePermission,
  SessionExpiredError,
} from "@/server/auth/require-permission";
import {
  CenterNotFoundError,
  CenterOutsideTerritoryError,
  InactiveCenterError,
  RouteNotAuthorizedError,
} from "@/server/services/route-service";

// Same 401/403 convention as the other route handlers (import, export):
// SessionExpiredError means "sign in again", ForbiddenError means "signed in
// but not allowed".
export async function requireRoutesAssignTeamOrRespond() {
  try {
    const session = await requirePermission("routes:assign-team");
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
        session: null,
        response: NextResponse.json({ error: error.message }, { status: 403 }),
      };
    }
    throw error;
  }
}

// Search params arrive as strings; an empty one (`?territoryId=`) means
// "not provided", not an invalid id.
export function searchParamsToObject(url: string): Record<string, string> {
  const params: Record<string, string> = {};
  for (const [key, value] of new URL(url).searchParams) {
    if (value !== "") params[key] = value;
  }
  return params;
}

export function respondToServiceError(error: unknown): NextResponse {
  if (error instanceof RouteNotAuthorizedError || error instanceof CenterOutsideTerritoryError) {
    return NextResponse.json({ error: error.message }, { status: 403 });
  }
  if (error instanceof CenterNotFoundError) {
    return NextResponse.json({ error: error.message }, { status: 404 });
  }
  if (error instanceof InactiveCenterError) {
    return NextResponse.json({ error: error.message }, { status: 409 });
  }
  throw error;
}
