import { redirect } from "next/navigation";
import type { ReactNode } from "react";

import { AppShell } from "@/components/shell/app-shell";
import { NAV_ITEMS, SECONDARY_NAV_ITEMS } from "@/components/shell/nav-items";
import { auth } from "@/server/auth";
import { hasPermission } from "@/server/auth/permissions";

// Every screen behind this layout is user-scoped (it reads the signed-in
// user's session and permissions), so it must never be statically cached —
// otherwise one user's rendered shell could be served to another.
export const dynamic = "force-dynamic";

export default async function AppLayout({ children }: { children: ReactNode }) {
  const session = await auth();

  if (!session?.user) {
    redirect("/login");
  }

  const visibleNavItems = NAV_ITEMS.filter(
    (item) => !item.permission || hasPermission(session.user.permissions, item.permission),
  );

  return (
    <AppShell
      navItems={visibleNavItems}
      secondaryNavItems={SECONDARY_NAV_ITEMS}
      userName={session.user.name ?? session.user.email ?? "Account"}
      roleName={session.user.roleName}
    >
      {children}
    </AppShell>
  );
}
