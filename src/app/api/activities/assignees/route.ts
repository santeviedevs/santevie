import { NextResponse } from "next/server";

import { activityAssigneeSearchQuerySchema } from "@/lib/schemas/activity";
import { searchAssigneesForActor } from "@/server/services/activity-service";

import { requireActivitiesAssign, searchParamsToObject } from "../search-helpers";

export const dynamic = "force-dynamic";

// Type-ahead for the "Assign To" field: active users the caller may assign
// to — themselves and their downstream team (ADMIN: any active user) —
// matched on name or employee code, bounded by the schema's limit ceiling.
export async function GET(request: Request) {
  const auth = await requireActivitiesAssign();
  if (!auth.ok) return auth.response;
  const { session } = auth;

  const parsed = activityAssigneeSearchQuerySchema.safeParse(searchParamsToObject(request.url));
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid search parameters" }, { status: 400 });
  }

  const users = await searchAssigneesForActor(parsed.data, session.user.id, session.user.roleName);
  return NextResponse.json({ users });
}
