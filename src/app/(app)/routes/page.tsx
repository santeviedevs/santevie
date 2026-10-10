import { redirect } from "next/navigation";

import { requirePermission } from "@/server/auth/require-permission";

// The Routes nav entry lands on its first tab.
export default async function RoutesIndexPage() {
  await requirePermission("routes:assign-team");
  redirect("/routes/add");
}
