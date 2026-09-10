import type { ReactNode } from "react";

import { AppHeader } from "./app-header";
import { BottomNav } from "./bottom-nav";
import { InstallPrompt } from "./install-prompt";
import type { NavItem } from "./nav-items";
import { RegisterServiceWorker } from "./register-service-worker";
import { SidebarNav } from "./sidebar-nav";

export function AppShell({
  navItems,
  secondaryNavItems,
  userName,
  roleName,
  children,
}: {
  navItems: NavItem[];
  secondaryNavItems: NavItem[];
  userName: string;
  roleName: string;
  children: ReactNode;
}) {
  return (
    <div className="flex min-h-screen">
      <SidebarNav items={navItems} secondaryItems={secondaryNavItems} />
      <div className="flex min-w-0 flex-1 flex-col">
        <AppHeader name={userName} roleName={roleName} />
        <main className="flex-1 pb-16 md:pb-0">{children}</main>
        <BottomNav items={navItems} secondaryItems={secondaryNavItems} />
      </div>
      <RegisterServiceWorker />
      <InstallPrompt />
    </div>
  );
}
