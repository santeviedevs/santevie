import { NextResponse } from "next/server";

import { routeSearchQuerySchema } from "@/lib/schemas/route";
import { searchAssignableRoutesForActor } from "@/server/services/route-service";

import { requireRoutesAssignTeamOrRespond, searchParamsToObject } from "../search-helpers";

export const dynamic = "force-dynamic";

// Type-ahead for the Assign Routes form's Route dropdown: unassigned routes
// the caller may assign, that still have pending visits. A read fired on
// every (debounced) keystroke, so a GET route handler rather than a Server
// Action; the write itself stays a Server Action. Bounded by the schema's
// limit ceiling.
export async function GET(request: Request) {
  const auth = await requireRoutesAssignTeamOrRespond();
  if (!auth.ok) return auth.response;
  const { session } = auth;

  const parsed = routeSearchQuerySchema.safeParse(searchParamsToObject(request.url));
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid search parameters" }, { status: 400 });
  }

  const routes = await searchAssignableRoutesForActor(
    parsed.data,
    session.user.id,
    session.user.roleName,
  );
  return NextResponse.json({ routes });
}
