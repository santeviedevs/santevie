"use client";

import { Check, X } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import type { Dictionary } from "@/lib/i18n/dictionary";
import type { RouteContactIssue } from "@/lib/schemas/route";

export type RouteContactRow = {
  id: string;
  name: string;
  code: string;
  status: "PENDING" | "COMPLETED" | "CANCELLED" | "MISSED";
  issue: RouteContactIssue | null;
};

const STATUS_VARIANT = {
  PENDING: "secondary",
  COMPLETED: "default",
  CANCELLED: "outline",
  MISSED: "destructive",
} as const;

// The contacts under one center on a saved route, each with its own status
// and — where the caller allows it — its own Complete / Cancel buttons. A
// contact whose link to the center has since been removed is flagged, never
// hidden.
export function RouteContactList({
  contacts,
  onComplete,
  onCancel,
  disabled,
  dict,
}: {
  contacts: RouteContactRow[];
  onComplete?: (routeItemContactId: string) => void;
  onCancel?: (routeItemContactId: string) => void;
  disabled: boolean;
  dict: Dictionary["routesPage"];
}) {
  if (contacts.length === 0) return null;

  return (
    <ul className="flex flex-col gap-1.5">
      {contacts.map((contact) => {
        const actionable = contact.status === "PENDING" || contact.status === "MISSED";
        return (
          <li
            key={contact.id}
            className="flex flex-wrap items-center justify-between gap-2 rounded-md bg-muted/40 px-2.5 py-1.5 text-sm"
          >
            <span className="flex min-w-0 flex-wrap items-center gap-2">
              <span className="break-words">
                {contact.name} <span className="text-muted-foreground">({contact.code})</span>
              </span>
              <Badge variant={STATUS_VARIANT[contact.status]}>{contact.status}</Badge>
              {contact.issue ? (
                <Badge variant="destructive">
                  {contact.issue === "NOT_ASSOCIATED"
                    ? dict.noLongerAssociated
                    : dict.contactInactive}
                </Badge>
              ) : null}
            </span>
            {actionable && (onComplete || onCancel) ? (
              <span className="flex items-center gap-1.5">
                {onComplete ? (
                  <Button
                    type="button"
                    size="sm"
                    title={dict.markComplete}
                    disabled={disabled}
                    onClick={() => onComplete(contact.id)}
                  >
                    <Check className="sm:hidden" aria-hidden />
                    <span className="max-sm:sr-only">{dict.markComplete}</span>
                  </Button>
                ) : null}
                {onCancel ? (
                  <Button
                    type="button"
                    variant="destructive"
                    size="sm"
                    title={dict.markCancelled}
                    disabled={disabled}
                    onClick={() => onCancel(contact.id)}
                  >
                    <X className="sm:hidden" aria-hidden />
                    <span className="max-sm:sr-only">{dict.markCancelled}</span>
                  </Button>
                ) : null}
              </span>
            ) : null}
          </li>
        );
      })}
    </ul>
  );
}
