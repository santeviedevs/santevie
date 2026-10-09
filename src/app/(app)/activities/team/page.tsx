import { redirect } from "next/navigation";

// Moved under the Follow-ups tabs; kept so old bookmarks still land somewhere.
export default function LegacyTeamActivitiesPage() {
  redirect("/activities/follow-ups/team");
}
