import type { ReactNode } from "react";

import type { Dictionary } from "@/lib/i18n/dictionary";
import type { Language } from "@/lib/i18n/language";

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
  language,
  dict,
  children,
}: {
  navItems: NavItem[];
  secondaryNavItems: NavItem[];
  userName: string;
  roleName: string;
  language: Language;
  dict: Dictionary;
  children: ReactNode;
}) {
  return (
    <div className="flex min-h-screen">
      <SidebarNav items={navItems} secondaryItems={secondaryNavItems} />
      <div className="flex min-w-0 flex-1 flex-col">
        <AppHeader name={userName} roleName={roleName} language={language} dict={dict} />
        <main className="min-w-0 flex-1 pb-16 md:pb-0">{children}</main>
        <BottomNav items={navItems} secondaryItems={secondaryNavItems} />
      </div>
      <RegisterServiceWorker />
      <InstallPrompt />
    </div>
  );
}
