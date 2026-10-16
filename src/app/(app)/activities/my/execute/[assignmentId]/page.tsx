import { ArrowLeft } from "lucide-react";
import Link from "next/link";
import { notFound } from "next/navigation";

import { Button } from "@/components/ui/button";
import { getServerDictionary } from "@/lib/i18n/server";
import { hasPermission } from "@/server/auth/permissions";
import { requirePermission } from "@/server/auth/require-permission";
import { listActiveContactsForSelection } from "@/server/repositories/contact-repository";
import { getAssignmentExecutionDetail } from "@/server/services/activity-service";

import { AssignmentExecutionForm } from "./assignment-execution-form";
import { AssignmentResultsView } from "./assignment-results-view";

export const dynamic = "force-dynamic";

type ExecutionPageProps = { params: Promise<{ assignmentId: string }> };

// Where a delegate records their own results for one assignment — present/
// unplanned participants, per-product outcomes, and whichever type-specific
// fields apply to this activity's type (see activity-type-fields.ts).
// Reached from My Activities while the assignment is still PLANNED; the
// form locks once it isn't (same rule the server re-enforces in
// updateAssignmentExecution). This is deliberately a separate screen from
// the Activity edit form — that one is the shared plan a manager sets up;
// this one is what one delegate actually did.
export default async function AssignmentExecutionPage({ params }: ExecutionPageProps) {
  const session = await requirePermission("activities:respond-own");
  const dict = await getServerDictionary();
  const t = dict.activitiesPage;
  const { assignmentId } = await params;

  const canAssign = hasPermission(session.user.permissions, "activities:assign");
  const canViewTeam = hasPermission(session.user.permissions, "activities:view-team");
  const [assignment, contacts] = await Promise.all([
    getAssignmentExecutionDetail(assignmentId, session, canAssign, canViewTeam).catch(() => null),
    listActiveContactsForSelection(),
  ]);
  if (!assignment) notFound();

  const isOwner = assignment.userId === session.user.id;
  // Read-only reach (activities:view-team) is wider than edit reach — a
  // team member's still-PLANNED assignment stays read-only for a viewer who
  // can't act on it, same boundary the server enforces in
  // updateAssignmentExecution.
  const canEdit = assignment.status === "PLANNED" && (isOwner || canAssign);
  const locked = !canEdit;
  const executionAssignment = {
    id: assignment.id,
    status: assignment.status,
    typeCode: assignment.activity.type.code,
    outcomeNotes: assignment.outcomeNotes,
    hcpFeedback: assignment.hcpFeedback,
    beneficiaryFeedback: assignment.beneficiaryFeedback,
    commitments: assignment.commitments,
    pregnantWomenReached: assignment.pregnantWomenReached,
    childrenConsulted: assignment.childrenConsulted,
    actualParticipants: assignment.actualParticipants,
    nightShiftTiming: assignment.nightShiftTiming,
    requirementValue: assignment.requirementValue?.toString() ?? null,
    supportProvidedDescription: assignment.supportProvidedDescription,
    recipientContactId: assignment.recipient?.id ?? null,
    foodExpense: assignment.foodExpense?.toString() ?? null,
    transportExpense: assignment.transportExpense?.toString() ?? null,
    participants: assignment.activity.participants.map((p) => {
      const existing = assignment.results.find((r) => r.contactId === p.contact.id);
      return {
        contactId: p.contact.id,
        name: p.contact.name,
        present: existing?.present ?? false,
        feedback: existing?.feedback ?? null,
        prescriptionsGenerated: existing?.prescriptionsGenerated ?? null,
      };
    }),
    products: assignment.activity.products.map((p) => {
      const existing = assignment.productResults.find((r) => r.productId === p.product.id);
      return {
        productId: p.product.id,
        name: p.product.name,
        prescriptionsGenerated: existing?.prescriptionsGenerated ?? null,
        businessValueGenerated: existing?.businessValueGenerated?.toString() ?? null,
        samplesProvided: existing?.samplesProvided ?? null,
        availability: existing?.availability ?? null,
        plannedAvailability: p.availability,
      };
    }),
  };
  const plan = {
    expectedParticipants:
      assignment.activity.prescriberCount ?? assignment.activity.expectedParticipants,
    foodExpense: assignment.activity.foodExpense?.toString() ?? null,
    transportExpense: assignment.activity.transportExpense?.toString() ?? null,
    requirementCategoryName: assignment.activity.requirementCategory?.name ?? null,
  };
  const recipientOptions = contacts.map((c) => ({ id: c.id, label: `${c.name} (${c.code})` }));

  return (
    <div className="flex flex-col gap-6 p-6">
      <Button render={<Link href="/activities/my" />} variant="outline" size="sm" className="w-fit">
        <ArrowLeft aria-hidden />
        {t.myActivitiesTitle}
      </Button>

      <div className="flex flex-col gap-1">
        <h1 className="text-xl font-semibold">
          {locked ? t.viewResultsTitle : t.recordResultsTitle}
        </h1>
        <p className="text-sm text-muted-foreground">
          {assignment.activity.name} · {assignment.activity.type.name}
        </p>
      </div>

      {locked ? (
        <AssignmentResultsView
          assignment={executionAssignment}
          plan={plan}
          recipientOptions={recipientOptions}
          dict={t}
        />
      ) : (
        <AssignmentExecutionForm
          assignment={executionAssignment}
          recipientOptions={recipientOptions}
          dict={t}
        />
      )}
    </div>
  );
}
