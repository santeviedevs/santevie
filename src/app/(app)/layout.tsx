import { redirect } from "next/navigation";
import type { ReactNode } from "react";

import { AppShell } from "@/components/shell/app-shell";
import {
  NAV_ITEM_DEFS,
  resolveNavItems,
  SECONDARY_NAV_ITEM_DEFS,
} from "@/components/shell/nav-items";
import { getLanguage, getServerDictionary } from "@/lib/i18n/server";
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

  const [language, dict] = await Promise.all([getLanguage(), getServerDictionary()]);

  const visibleNavItems = resolveNavItems(NAV_ITEM_DEFS, dict.nav).filter(
    (item) => !item.permission || hasPermission(session.user.permissions, item.permission),
  );
  const secondaryNavItems = resolveNavItems(SECONDARY_NAV_ITEM_DEFS, dict.nav);

  return (
    <AppShell
      navItems={visibleNavItems}
      secondaryNavItems={secondaryNavItems}
      userName={session.user.name ?? session.user.email ?? "Account"}
      roleName={session.user.roleName}
      language={language}
      dict={dict}
    >
      {children}
    </AppShell>
  );
}
