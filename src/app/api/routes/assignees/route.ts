import { NextResponse } from "next/server";

import { assigneeSearchQuerySchema } from "@/lib/schemas/route";
import { searchAssigneesForActor } from "@/server/services/route-service";

import { requireRoutesAssignTeamOrRespond, searchParamsToObject } from "../search-helpers";

export const dynamic = "force-dynamic";

// Type-ahead for the "Assign To" field: active users the caller may assign
// to — themselves and their downstream team (ADMIN: any active user) —
// matched on name or employee code, bounded by the schema's limit ceiling.
// Never the whole user list.
export async function GET(request: Request) {
  const auth = await requireRoutesAssignTeamOrRespond();
  if (!auth.ok) return auth.response;
  const { session } = auth;

  const parsed = assigneeSearchQuerySchema.safeParse(searchParamsToObject(request.url));
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid search parameters" }, { status: 400 });
  }

  const users = await searchAssigneesForActor(parsed.data, session.user.id, session.user.roleName);
  return NextResponse.json({ users });
}
