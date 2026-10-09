import { requirePermission } from "@/server/auth/require-permission";

// Defense in depth: the whole Routes section (Plan Routes, Assign Routes)
// is closed to anyone without routes:assign-team — Delegates included —
// even if a future page here forgets its own check.
export default async function RoutesLayout({ children }: { children: React.ReactNode }) {
  await requirePermission("routes:assign-team");
  return children;
}
