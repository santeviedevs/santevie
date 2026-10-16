import { NextResponse } from "next/server";

import { activityAssigneeSearchQuerySchema } from "@/lib/schemas/activity";
import {
  ForbiddenError,
  requirePermission,
  SessionExpiredError,
} from "@/server/auth/require-permission";
import { searchAssigneesForActor } from "@/server/services/activity-service";

import { searchParamsToObject } from "../../activities/search-helpers";

export const dynamic = "force-dynamic";

// Type-ahead for the "Delegate" field on the set-target form: active users
// the caller may set a target for — themselves and their downstream team
// (ADMIN: any active user), same scope rule as the activity assignee
// picker. Gated on prescriptions:manage-targets rather than
// activities:assign — SUPERVISOR holds the former but not the latter, so
// the existing /api/activities/assignees endpoint can't be reused as-is;
// the underlying search logic (searchAssigneesForActor) is shared, only
// the permission gate differs.
export async function GET(request: Request) {
  try {
    const session = await requirePermission("prescriptions:manage-targets");
    const parsed = activityAssigneeSearchQuerySchema.safeParse(searchParamsToObject(request.url));
    if (!parsed.success) {
      return NextResponse.json({ error: "Invalid search parameters" }, { status: 400 });
    }
    const users = await searchAssigneesForActor(
      parsed.data,
      session.user.id,
      session.user.roleName,
    );
    return NextResponse.json({ users });
  } catch (error) {
    if (error instanceof SessionExpiredError) {
      return NextResponse.json({ error: "Session expired" }, { status: 401 });
    }
    if (error instanceof ForbiddenError) {
      return NextResponse.json({ error: error.message }, { status: 403 });
    }
    throw error;
  }
}
