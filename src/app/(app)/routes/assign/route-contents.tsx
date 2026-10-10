import { Building2, User } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import type { Dictionary } from "@/lib/i18n/dictionary";
import type { RouteItemSummary } from "@/server/services/route-service";

const STATUS_VARIANT = {
  PENDING: "secondary",
  COMPLETED: "default",
  CANCELLED: "outline",
  MISSED: "destructive",
} as const;

// A route's Centers and the Contacts under each — plain stacked rows with
// subtle dividers, no card borders. Contacts are indented beneath their
// Center so the grouping is clear; every status badge sits on the right.
export function RouteContents({
  items,
  dict,
}: {
  items: RouteItemSummary[];
  dict: Dictionary["routesPage"];
}) {
  const contactCount = items.reduce((sum, item) => sum + item.contacts.length, 0);

  return (
    <section className="flex flex-col gap-3" aria-labelledby="route-contents-heading">
      <div className="flex flex-col gap-1">
        <h2 id="route-contents-heading" className="text-lg font-semibold">
          {dict.centersAndContactsHeading}
        </h2>
        <p className="text-sm text-muted-foreground">
          {items.length} {dict.itemsCountSuffix} · {contactCount} {dict.contactsCountSuffix}
        </p>
      </div>

      {items.length === 0 ? (
        <p className="text-sm text-muted-foreground">{dict.noCentersYet}</p>
      ) : (
        <ul className="flex flex-col divide-y divide-border border-y border-border">
          {items.map((item) => (
            <li key={item.id} className="flex flex-col py-3">
              <div className="flex items-start justify-between gap-3">
                <div className="flex min-w-0 items-start gap-3">
                  <Building2 className="mt-0.5 size-4 shrink-0 text-muted-foreground" aria-hidden />
                  <div className="flex min-w-0 flex-col">
                    <span className="break-words font-medium">
                      {item.center.name}{" "}
                      <span className="font-normal text-muted-foreground">
                        ({item.center.code})
                      </span>
                    </span>
                    <span className="text-xs text-muted-foreground">{item.center.typeName}</span>
                  </div>
                </div>
                <Badge variant={STATUS_VARIANT[item.status]} className="shrink-0">
                  {item.status}
                </Badge>
              </div>

              {item.contacts.length > 0 ? (
                <ul className="mt-2 ml-7 flex flex-col divide-y divide-border/60 border-l border-border pl-4">
                  {item.contacts.map((contact) => (
                    <li
                      key={contact.id}
                      className="flex items-start justify-between gap-3 py-2 first:pt-0 last:pb-0"
                    >
                      <div className="flex min-w-0 items-start gap-2.5">
                        <User
                          className="mt-0.5 size-4 shrink-0 text-muted-foreground"
                          aria-hidden
                        />
                        <div className="flex min-w-0 flex-col">
                          <span className="break-words text-sm">
                            {contact.name}{" "}
                            <span className="text-muted-foreground">({contact.code})</span>
                          </span>
                          {contact.issue ? (
                            <span className="text-xs text-destructive">
                              {contact.issue === "NOT_ASSOCIATED"
                                ? dict.noLongerAssociated
                                : dict.contactInactive}
                            </span>
                          ) : null}
                        </div>
                      </div>
                      <Badge variant={STATUS_VARIANT[contact.status]} className="shrink-0">
                        {contact.status}
                      </Badge>
                    </li>
                  ))}
                </ul>
              ) : null}
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
