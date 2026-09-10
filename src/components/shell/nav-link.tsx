"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { ReactNode } from "react";

import { cn } from "@/lib/utils";

function isActive(pathname: string, href: string) {
  if (href === "/") return pathname === "/";
  return pathname === href || pathname.startsWith(`${href}/`);
}

export function NavLink({
  href,
  label,
  icon,
  className,
  activeClassName,
  inactiveClassName,
}: {
  href: string;
  label: string;
  icon: ReactNode;
  className: string;
  activeClassName: string;
  inactiveClassName: string;
}) {
  const pathname = usePathname();
  const active = isActive(pathname, href);

  return (
    <Link
      href={href}
      aria-current={active ? "page" : undefined}
      className={cn(className, active ? activeClassName : inactiveClassName)}
    >
      {icon}
      <span>{label}</span>
    </Link>
  );
}
