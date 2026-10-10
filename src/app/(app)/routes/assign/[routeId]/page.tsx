import { ArrowLeft, User } from "lucide-react";
import Link from "next/link";
import { notFound } from "next/navigation";

import { Button } from "@/components/ui/button";
import { formatDateRange } from "@/lib/format-date";
import { getServerDictionary } from "@/lib/i18n/server";
import { todayInKinshasa } from "@/lib/week";
import { requirePermission } from "@/server/auth/require-permission";
import { getRouteForManagement } from "@/server/services/route-service";

import { CancelAssignmentButton } from "../cancel-assignment-button";
import { ReassignForm } from "../reassign-form";
import { RouteContents } from "../route-contents";

export const dynamic = "force-dynamic";

type AssignDetailPageProps = { params: Promise<{ routeId: string }> };

// The Manage page for one route, opened from a row of the Assign Routes
// table: its Centers and Contacts, and the actions on its assignment —
// reassign (a form below) and Cancel Current Assignment (top right). Loads
// just this route through the same authorization every action on it uses, so
// "not found" here means "not reachable", never "exists but hidden". Which
// actions are offered mirrors the rules the server enforces on each write.
export default async function AssignDetailPage({ params }: AssignDetailPageProps) {
  const session = await requirePermission("routes:assign-team");
  const dict = await getServerDictionary();
  const t = dict.routesPage;
  const { routeId } = await params;

  const route = await getRouteForManagement(routeId, session.user.id, session.user.roleName);
  if (!route) notFound();

  const isAssigned = route.userId !== null;
  const hasCompleted = route.items.some(
    (item) =>
      item.status === "COMPLETED" ||
      item.contacts.some((contact) => contact.status === "COMPLETED"),
  );
  const hasPending = route.items.some(
    (item) => item.status === "PENDING" || item.status === "MISSED",
  );
  // Reassignment is blocked once anything is completed; with nothing pending
  // there is nothing left to assign. (Server-enforced either way.)
  const canReassign = hasPending && !(isAssigned && hasCompleted);

  return (
    <div className="flex flex-col gap-6 p-6">
      <header className="flex flex-col gap-4">
        <Button
          render={<Link href="/routes/assign" />}
          variant="outline"
          size="sm"
          className="w-fit"
        >
          <ArrowLeft aria-hidden />
          {t.backToAssignRoutes}
        </Button>

        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="flex min-w-0 flex-col gap-1">
            <h1 className="text-2xl font-semibold">{route.code}</h1>
            <p className="flex flex-wrap items-center gap-x-2 gap-y-1 text-sm text-muted-foreground">
              <span className="flex items-center gap-1.5">
                <User className="size-4" aria-hidden />
                {route.visitorName ?? t.unassignedLabel}
              </span>
              {route.startDate && route.endDate ? (
                <>
                  <span aria-hidden>·</span>
                  <span>{formatDateRange(route.startDate, route.endDate)}</span>
                </>
              ) : null}
            </p>
          </div>

          {isAssigned && hasPending ? <CancelAssignmentButton routeId={route.id} dict={t} /> : null}
        </div>
      </header>

      <hr className="border-border" />

      <RouteContents items={route.items} dict={t} />

      <hr className="border-border" />

      {canReassign ? (
        <ReassignForm
          routeId={route.id}
          isAssigned={isAssigned}
          minDate={todayInKinshasa().toISOString().slice(0, 10)}
          initialStartDate={route.startDate ? route.startDate.toISOString().slice(0, 10) : ""}
          initialEndDate={route.endDate ? route.endDate.toISOString().slice(0, 10) : ""}
          dict={t}
        />
      ) : isAssigned && hasCompleted ? (
        <p className="text-sm text-muted-foreground">{t.hasCompletedHint}</p>
      ) : null}
    </div>
  );
}
