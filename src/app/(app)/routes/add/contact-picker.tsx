"use client";

import { useState } from "react";

import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { useTypeahead } from "@/lib/hooks/use-typeahead";
import type { Dictionary } from "@/lib/i18n/dictionary";
import { ROUTE_SEARCH_LIMIT, type RouteContactIssue } from "@/lib/schemas/route";

export type SelectedContact = {
  contactId: string;
  name: string;
  code: string;
  roleName: string | null;
  specialization: string | null;
  // Set when the saved Contact<->Center link is gone (or the Contact went
  // inactive). Never dropped silently: the user removes it, and Save stays
  // blocked until they do.
  issue: RouteContactIssue | null;
};

// A Contact on this Center that already has a final status — shown for
// context, never editable, never re-selectable.
export type LockedContact = {
  contactId: string;
  name: string;
  code: string;
  roleName: string | null;
  specialization: string | null;
  status: "COMPLETED" | "CANCELLED";
  issue: RouteContactIssue | null;
};

export type ContactResult = {
  id: string;
  name: string;
  code: string;
  roleName: string;
  specialization: string | null;
};

const DEBOUNCE_MS = 300;

function detailLine(roleName: string | null, specialization: string | null): string {
  return [roleName, specialization].filter(Boolean).join(" · ");
}

function issueText(issue: RouteContactIssue, dict: Dictionary["routesPage"]): string {
  return issue === "NOT_ASSOCIATED" ? dict.noLongerAssociated : dict.contactInactive;
}

// One Center's Contact selector: a search box over only that Center's
// associated Contacts (the endpoint joins through ContactCenter), then one
// list of divided rows — Contacts already chosen first (checked, badged
// "Selected", untick to remove), then the matching ones to tick. Several can
// be ticked in one pass. Chosen Contacts are always listed, so a search can
// never hide one.
export function ContactPicker({
  routeId,
  centerId,
  selected,
  locked,
  onAdd,
  onRemove,
  disabled,
  dict,
}: {
  routeId: string | null;
  centerId: string;
  selected: SelectedContact[];
  locked: LockedContact[];
  onAdd: (contact: ContactResult) => void;
  onRemove: (contactId: string) => void;
  disabled: boolean;
  dict: Dictionary["routesPage"];
}) {
  const [query, setQuery] = useState("");
  const selectedIds = new Set(selected.map((contact) => contact.contactId));
  const lockedIds = new Set(locked.map((contact) => contact.contactId));

  const params = new URLSearchParams({ q: query.trim() });
  if (routeId) params.set("routeId", routeId);
  const { data, status } = useTypeahead<{ contacts: ContactResult[] }>(
    `/api/routes/centers/${encodeURIComponent(centerId)}/contacts?${params.toString()}`,
    query.trim() === "" ? 0 : DEBOUNCE_MS,
  );
  const results = (data?.contacts ?? []).filter(
    (contact) => !lockedIds.has(contact.id) && !selectedIds.has(contact.id),
  );

  const searchMessage =
    status === "error"
      ? dict.searchFailed
      : status === "loading" || data === null
        ? dict.searching
        : query.trim() === ""
          ? data.contacts.length === 0
            ? dict.noContactsForCenter
            : null
          : results.length === 0
            ? dict.noMatchingContacts
            : null;

  return (
    <div className="flex flex-col gap-3">
      <Input
        type="search"
        value={query}
        onChange={(event) => setQuery(event.target.value)}
        placeholder={dict.searchContactsPlaceholder}
        aria-label={dict.searchContactsPlaceholder}
        className="w-full"
      />

      {selected.length === 0 && locked.length === 0 ? (
        <p className="text-sm text-muted-foreground">{dict.noContactsSelected}</p>
      ) : null}

      <ul className="flex flex-col divide-y divide-border border-y border-border">
        {locked.map((contact) => (
          <li
            key={contact.contactId}
            className="flex items-start justify-between gap-3 py-2 text-sm"
          >
            <div className="flex min-w-0 flex-col">
              <span className="break-words">
                {contact.name} <span className="text-muted-foreground">({contact.code})</span>
              </span>
              <span className="text-xs text-muted-foreground">
                {detailLine(contact.roleName, contact.specialization)}
                {contact.issue ? ` · ${issueText(contact.issue, dict)}` : ""}
              </span>
            </div>
            <Badge variant={contact.status === "COMPLETED" ? "default" : "outline"}>
              {contact.status}
            </Badge>
          </li>
        ))}

        {selected.map((contact) => (
          <li key={contact.contactId}>
            <label className="flex cursor-pointer items-start gap-3 py-2 text-sm">
              <Checkbox
                className="mt-0.5"
                checked
                disabled={disabled}
                onCheckedChange={() => onRemove(contact.contactId)}
                aria-label={`${dict.removeContact} ${contact.name}`}
              />
              <span className="flex min-w-0 flex-1 flex-col">
                <span className="break-words font-medium">
                  {contact.name}{" "}
                  <span className="font-normal text-muted-foreground">({contact.code})</span>
                </span>
                <span className="text-xs text-muted-foreground">
                  {detailLine(contact.roleName, contact.specialization)}
                </span>
                {contact.issue ? (
                  <span className="text-xs text-destructive">{issueText(contact.issue, dict)}</span>
                ) : null}
              </span>
              <Badge variant={contact.issue ? "destructive" : "secondary"} className="shrink-0">
                {dict.selectedBadge}
              </Badge>
            </label>
          </li>
        ))}

        {results.map((contact) => (
          <li key={contact.id}>
            <label className="flex cursor-pointer items-start gap-3 py-2 text-sm hover:bg-muted/50">
              <Checkbox
                className="mt-0.5"
                checked={false}
                disabled={disabled}
                onCheckedChange={() => onAdd(contact)}
              />
              <span className="flex min-w-0 flex-col">
                <span className="break-words font-medium">
                  {contact.name}{" "}
                  <span className="font-normal text-muted-foreground">({contact.code})</span>
                </span>
                <span className="text-xs text-muted-foreground">
                  {detailLine(contact.roleName, contact.specialization)}
                </span>
              </span>
            </label>
          </li>
        ))}
      </ul>

      {searchMessage ? <p className="text-sm text-muted-foreground">{searchMessage}</p> : null}
      {data && data.contacts.length >= ROUTE_SEARCH_LIMIT ? (
        <p className="text-xs text-muted-foreground">{dict.showingFirstResults}</p>
      ) : null}
    </div>
  );
}
