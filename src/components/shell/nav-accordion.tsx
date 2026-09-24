"use client";

import { ChevronRight } from "lucide-react";
import { usePathname } from "next/navigation";
import type { ReactNode } from "react";
import { useState } from "react";

import { cn } from "@/lib/utils";

import type { NavItem } from "./nav-items";
import { NavLink } from "./nav-link";

// Inline expand/collapse for a grouped sidebar item (e.g. "Territories"
// holding "Manage Territories" and "Assign Territories") — children
// render in the normal flow below the trigger, pushing later items down,
// rather than a floating popup. Starts expanded when the current route is
// one of its children, so landing on a child page doesn't hide it.
export function NavAccordionItem({
  label,
  icon,
  navChildren,
  className,
  activeClassName,
  inactiveClassName,
  childClassName,
  childActiveClassName,
  childInactiveClassName,
}: {
  label: string;
  icon: ReactNode;
  navChildren: NonNullable<NavItem["children"]>;
  className: string;
  activeClassName: string;
  inactiveClassName: string;
  childClassName: string;
  childActiveClassName: string;
  childInactiveClassName: string;
}) {
  const pathname = usePathname();
  const childActive = navChildren.some(
    (child) => pathname === child.href || pathname.startsWith(`${child.href}/`),
  );
  const [open, setOpen] = useState(childActive);

  return (
    <div className="flex flex-col">
      <button
        type="button"
        onClick={() => setOpen((current) => !current)}
        aria-expanded={open}
        className={cn(className, childActive ? activeClassName : inactiveClassName)}
      >
        {icon}
        <span className="flex-1 text-left">{label}</span>
        <ChevronRight
          className={cn("size-4 shrink-0 transition-transform", open && "rotate-90")}
          aria-hidden="true"
        />
      </button>
      {open ? (
        <div className="flex flex-col gap-1 pt-1">
          {navChildren.map((child) => (
            <NavLink
              key={child.href}
              href={child.href}
              label={child.label}
              icon={<span className="size-5 shrink-0" aria-hidden="true" />}
              className={childClassName}
              activeClassName={childActiveClassName}
              inactiveClassName={childInactiveClassName}
            />
          ))}
        </div>
      ) : null}
    </div>
  );
}
