import { NextResponse } from "next/server";

import { activitySearchQuerySchema } from "@/lib/schemas/activity";
import { searchActivitiesForActor } from "@/server/services/activity-service";

import { requireActivitiesAssign, searchParamsToObject } from "../search-helpers";

export const dynamic = "force-dynamic";

// Type-ahead for the Assignment screen's "Activity" field: activities
// within the actor's scope, matched on name. Not narrowed to "unassigned
// only" — more than one person can be assigned to the same activity at
// once; the write itself re-validates there's no duplicate active
// assignment for the chosen user.
export async function GET(request: Request) {
  const auth = await requireActivitiesAssign();
  if (!auth.ok) return auth.response;
  const { session } = auth;

  const parsed = activitySearchQuerySchema.safeParse(searchParamsToObject(request.url));
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid search parameters" }, { status: 400 });
  }

  const activities = await searchActivitiesForActor(parsed.data, session);
  return NextResponse.json({ activities });
}
