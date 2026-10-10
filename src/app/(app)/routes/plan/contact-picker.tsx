"use client";

import { X } from "lucide-react";
import { useState } from "react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import type { Dictionary } from "@/lib/i18n/dictionary";
import { ROUTE_SEARCH_LIMIT, type RouteContactIssue } from "@/lib/schemas/route";

import { useTypeahead } from "./use-typeahead";

export type SelectedContact = {
  contactId: string;
  name: string;
  code: string;
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
  status: "COMPLETED" | "CANCELLED";
  issue: RouteContactIssue | null;
};

type ContactResult = { id: string; name: string; code: string; roleName: string };

const DEBOUNCE_MS = 300;

// One Center's Contact selector — a search box over only that Center's
// associated Contacts (the endpoint joins through ContactCenter), a list of
// checkboxes so several can be ticked in one pass, and the chosen Contacts
// as removable badges underneath.
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
  const results = (data?.contacts ?? []).filter((contact) => !lockedIds.has(contact.id));

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

      <div className="max-h-56 overflow-y-auto rounded-md border border-border">
        {results.length === 0 ? (
          <p className="px-3 py-2 text-sm text-muted-foreground">
            {status === "error"
              ? dict.searchFailed
              : status === "loading" || data === null
                ? dict.searching
                : query.trim() === ""
                  ? dict.noContactsForCenter
                  : dict.noMatchingContacts}
          </p>
        ) : (
          <ul className="divide-y divide-border">
            {results.map((contact) => (
              <li key={contact.id}>
                <label className="flex cursor-pointer items-start gap-3 px-3 py-2 text-sm hover:bg-accent/50">
                  <Checkbox
                    className="mt-0.5"
                    checked={selectedIds.has(contact.id)}
                    disabled={disabled}
                    onCheckedChange={(checked) => {
                      if (checked) onAdd(contact);
                      else onRemove(contact.id);
                    }}
                  />
                  <span className="flex min-w-0 flex-col">
                    <span className="break-words font-medium">{contact.name}</span>
                    <span className="text-xs text-muted-foreground">
                      {contact.code} · {contact.roleName}
                    </span>
                  </span>
                </label>
              </li>
            ))}
          </ul>
        )}
        {data && data.contacts.length >= ROUTE_SEARCH_LIMIT ? (
          <p className="border-t border-border px-3 py-1.5 text-xs text-muted-foreground">
            {dict.showingFirstResults}
          </p>
        ) : null}
      </div>

      {selected.length === 0 && locked.length === 0 ? (
        <p className="text-sm text-muted-foreground">{dict.noContactsSelected}</p>
      ) : (
        <ul className="flex flex-wrap gap-2">
          {locked.map((contact) => (
            <li key={contact.contactId}>
              <Badge variant={contact.status === "COMPLETED" ? "default" : "outline"}>
                {contact.name} ({contact.code}) · {contact.status}
                {contact.issue ? ` · ${issueLabel(contact.issue, dict)}` : ""}
              </Badge>
            </li>
          ))}
          {selected.map((contact) => (
            <li key={contact.contactId}>
              <Badge
                variant={contact.issue ? "destructive" : "secondary"}
                className="h-auto gap-1.5 py-1"
              >
                <span className="whitespace-normal break-words">
                  {contact.name} ({contact.code})
                  {contact.issue ? ` · ${issueLabel(contact.issue, dict)}` : ""}
                </span>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon-xs"
                  aria-label={`${dict.removeContact} ${contact.name}`}
                  disabled={disabled}
                  onClick={() => onRemove(contact.contactId)}
                >
                  <X aria-hidden />
                </Button>
              </Badge>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

export function issueLabel(issue: RouteContactIssue, dict: Dictionary["routesPage"]): string {
  return issue === "NOT_ASSOCIATED" ? dict.noLongerAssociated : dict.contactInactive;
}
