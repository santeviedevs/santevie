"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { ReactNode } from "react";

import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";

import type { NavItem } from "./nav-items";

// Grouped nav item (e.g. "Territories" holding "Manage Territories" and
// "Assign Territories") — a real dropdown, not a flat nav entry, since
// there's no href of its own to link to. Shares NavLink's active/inactive
// styling props so it drops into SidebarNav and BottomNav the same way a
// plain NavLink does; "active" means the current path matches any child.
export function NavDropdownItem({
  label,
  icon,
  navChildren,
  className,
  activeClassName,
  inactiveClassName,
  side = "bottom",
}: {
  label: string;
  icon: ReactNode;
  navChildren: NonNullable<NavItem["children"]>;
  className: string;
  activeClassName: string;
  inactiveClassName: string;
  side?: "bottom" | "top";
}) {
  const pathname = usePathname();
  const active = navChildren.some(
    (child) => pathname === child.href || pathname.startsWith(`${child.href}/`),
  );

  return (
    <DropdownMenu>
      <DropdownMenuTrigger className={cn(className, active ? activeClassName : inactiveClassName)}>
        {icon}
        <span>{label}</span>
      </DropdownMenuTrigger>
      <DropdownMenuContent side={side} align="start">
        {navChildren.map((child) => (
          <DropdownMenuItem key={child.href} render={<Link href={child.href} />}>
            {child.label}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
