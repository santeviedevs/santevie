import { NextResponse } from "next/server";
import { z } from "zod";

import { contactSearchQuerySchema } from "@/lib/schemas/route";
import { searchContactsForRouteCenter } from "@/server/services/route-service";

import {
  requireRoutesAssignTeamOrRespond,
  respondToServiceError,
  searchParamsToObject,
} from "../../../search-helpers";

export const dynamic = "force-dynamic";

// Type-ahead for the Contacts of one selected Center. Only Contacts linked
// to that Center (through ContactCenter) are ever returned, and only if the
// Center is active and inside the caller's reach.
export async function GET(request: Request, { params }: { params: Promise<{ centerId: string }> }) {
  const auth = await requireRoutesAssignTeamOrRespond();
  if (!auth.ok) return auth.response;
  const { session } = auth;

  const { centerId } = await params;
  const parsedCenterId = z.string().min(1).safeParse(centerId);
  const parsed = contactSearchQuerySchema.safeParse(searchParamsToObject(request.url));
  if (!parsedCenterId.success || !parsed.success) {
    return NextResponse.json({ error: "Invalid search parameters" }, { status: 400 });
  }

  try {
    const contacts = await searchContactsForRouteCenter(
      parsedCenterId.data,
      parsed.data,
      session.user.id,
      session.user.roleName,
    );
    return NextResponse.json({ contacts });
  } catch (error) {
    return respondToServiceError(error);
  }
}
