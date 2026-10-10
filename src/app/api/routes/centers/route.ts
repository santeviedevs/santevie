import { NextResponse } from "next/server";

import { centerSearchQuerySchema } from "@/lib/schemas/route";
import { searchCentersForRoute } from "@/server/services/route-service";

import {
  requireRoutesAssignTeamOrRespond,
  respondToServiceError,
  searchParamsToObject,
} from "../search-helpers";

export const dynamic = "force-dynamic";

// Type-ahead for the Plan Routes editor's Center picker. A read fired on
// every (debounced) keystroke, so a GET route handler rather than a Server
// Action — Server Actions run one at a time and would queue up. Bounded by
// the schema's limit ceiling, scoped to the territories the route's owner
// may plan in, never the whole table.
export async function GET(request: Request) {
  const auth = await requireRoutesAssignTeamOrRespond();
  if (!auth.ok) return auth.response;
  const { session } = auth;

  const parsed = centerSearchQuerySchema.safeParse(searchParamsToObject(request.url));
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid search parameters" }, { status: 400 });
  }

  try {
    const centers = await searchCentersForRoute(
      parsed.data,
      session.user.id,
      session.user.roleName,
    );
    return NextResponse.json({ centers });
  } catch (error) {
    return respondToServiceError(error);
  }
}
