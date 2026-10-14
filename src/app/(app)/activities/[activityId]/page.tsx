import { ArrowLeft } from "lucide-react";
import Link from "next/link";
import { notFound } from "next/navigation";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { formatDate } from "@/lib/format-date";
import { getServerDictionary } from "@/lib/i18n/server";
import { hasPermission } from "@/server/auth/permissions";
import { requirePermission } from "@/server/auth/require-permission";
import {
  listRequirementCategories,
  listStandardEventActivityTypes,
} from "@/server/repositories/activity-repository";
import { listActiveCentersForSelection } from "@/server/repositories/center-repository";
import { listActiveContactsForSelection } from "@/server/repositories/contact-repository";
import { listActiveProductsForSelection } from "@/server/repositories/product-repository";
import { getActivityDetail } from "@/server/services/activity-service";
import { listActiveTerritoryOptions } from "@/server/services/territory-service";

import { assignmentStatusLabel, assignmentStatusVariant } from "../activity-assignment-status";
import { ActivityForm } from "../activity-form";

export const dynamic = "force-dynamic";

type ActivityDetailPageProps = { params: Promise<{ activityId: string }> };

// The dedicated page for one activity, opened from a row of the Activity
// List: its own details (editable by a manager through the same form used
// to create it) and every assignment raised against it, read-only here —
// respond actions (Add follow-up / Mark done / Cancel) live only on My
// Activities, and reassigning or cancelling one assignment happens on its
// own Manage page. Loaded through getActivityDetail, the same authorization
// every other action on the activity uses, so "not found" means "not
// reachable".
export default async function ActivityDetailPage({ params }: ActivityDetailPageProps) {
  const session = await requirePermission("activities:respond-own");
  const dict = await getServerDictionary();
  const t = dict.activitiesPage;
  const { activityId } = await params;

  const canAssign = hasPermission(session.user.permissions, "activities:assign");
  const activity = await getActivityDetail(activityId, session, canAssign);
  if (!activity) notFound();

  const [centers, territories, types, products, contacts, requirementCategories] = canAssign
    ? await Promise.all([
        listActiveCentersForSelection(),
        listActiveTerritoryOptions(),
        listStandardEventActivityTypes(),
        listActiveProductsForSelection(),
        listActiveContactsForSelection(),
        listRequirementCategories(),
      ])
    : [[], [], [], [], [], []];

  return (
    <div className="flex flex-col gap-6 p-6">
      <Button render={<Link href="/activities" />} variant="outline" size="sm" className="w-fit">
        <ArrowLeft aria-hidden />
        {t.backToActivityList}
      </Button>

      <div className="flex flex-col gap-1">
        <h1 className="text-xl font-semibold">{t.editActivityTitle}</h1>
        <p className="text-sm text-muted-foreground">{activity.name}</p>
      </div>

      {canAssign ? (
        <ActivityForm
          activity={{
            id: activity.id,
            name: activity.name,
            typeId: activity.type.id,
            centerId: activity.center?.id ?? null,
            territoryId: activity.territory?.id ?? null,
            location: activity.location,
            departmentName: activity.departmentName,
            speakerContactId: activity.speaker?.id ?? null,
            requirementCategoryId: activity.requirementCategory?.id ?? null,
            prescriberCount: activity.prescriberCount,
            expectedParticipants: activity.expectedParticipants,
            foodExpense: activity.foodExpense,
            transportExpense: activity.transportExpense,
            notes: activity.notes,
            products: activity.products,
            participantContactIds: activity.participantContactIds,
          }}
          centers={centers.map((c) => ({
            id: c.id,
            label: `${c.name} (${c.code})`,
            territoryId: c.territoryId,
          }))}
          territories={territories.map((territory) => ({
            id: territory.id,
            label: territory.label,
          }))}
          typeOptions={types.map((type) => ({ id: type.id, code: type.code, label: type.name }))}
          productOptions={products.map((p) => ({ id: p.id, label: `${p.name} (${p.code})` }))}
          contactOptions={contacts.map((c) => ({ id: c.id, label: `${c.name} (${c.code})` }))}
          requirementCategories={requirementCategories.map((c) => ({ id: c.id, label: c.name }))}
          dict={t}
        />
      ) : (
        <dl className="grid max-w-md grid-cols-[auto_1fr] gap-x-3 gap-y-1 text-sm">
          <dt className="text-muted-foreground">{t.nameLabel}</dt>
          <dd>{activity.name}</dd>
          <dt className="text-muted-foreground">{t.typeLabel}</dt>
          <dd>{activity.type.name}</dd>
          {activity.notes ? (
            <>
              <dt className="text-muted-foreground">{t.notesLabel}</dt>
              <dd>{activity.notes}</dd>
            </>
          ) : null}
        </dl>
      )}

      <hr className="border-border" />

      <section className="flex flex-col gap-3">
        <h2 className="text-lg font-semibold">{t.assignmentsHeading}</h2>

        {activity.assignments.length === 0 ? (
          <p className="text-sm text-muted-foreground">{t.noAssignments}</p>
        ) : (
          <ul className="flex flex-col gap-2">
            {activity.assignments.map((assignment) => (
              <li
                key={assignment.id}
                className="flex flex-wrap items-center justify-between gap-3 rounded-md border border-border p-3"
              >
                <div className="flex flex-wrap items-center gap-2">
                  <span className="font-medium">{assignment.user.name}</span>
                  <Badge variant={assignmentStatusVariant(assignment.status)}>
                    {assignmentStatusLabel(assignment.status, t)}
                  </Badge>
                  <span className="text-sm text-muted-foreground">
                    {formatDate(assignment.scheduledDate)}
                  </span>
                </div>
                {canAssign ? (
                  <Button
                    render={<Link href={`/activities/assign/${assignment.id}`} />}
                    variant="outline"
                    size="sm"
                  >
                    {t.viewAction}
                  </Button>
                ) : null}
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
