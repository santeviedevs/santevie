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
import { hasPermission, type Permission } from "@/server/auth/permissions";

// Every screen behind this layout is user-scoped (it reads the signed-in
// user's session and permissions), so it must never be statically cached —
// otherwise one user's rendered shell could be served to another.
export const dynamic = "force-dynamic";

// No permission/anyPermission set at all means visible to every signed-in
// user. `anyPermission` (e.g. Team: reports:view-team OR reports:view-all)
// only needs one of the listed permissions held, not all of them.
function isVisible(
  item: { permission?: Permission; anyPermission?: Permission[] },
  granted: readonly string[] | undefined,
): boolean {
  if (item.permission && !hasPermission(granted, item.permission)) return false;
  if (item.anyPermission && !item.anyPermission.some((p) => hasPermission(granted, p))) {
    return false;
  }
  return true;
}

export default async function AppLayout({ children }: { children: ReactNode }) {
  const session = await auth();

  if (!session?.user) {
    redirect("/login");
  }

  const [language, dict] = await Promise.all([getLanguage(), getServerDictionary()]);

  const visibleNavItems = resolveNavItems(NAV_ITEM_DEFS, dict.nav)
    .map((item) =>
      item.children
        ? {
            ...item,
            children: item.children.filter((child) => isVisible(child, session.user.permissions)),
          }
        : item,
    )
    // A group with no visible children (or a plain item without its
    // permission) is dropped entirely — a dropdown with nothing in it, or a
    // link nobody can use, has no reason to render.
    .filter((item) =>
      item.children ? item.children.length > 0 : isVisible(item, session.user.permissions),
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
