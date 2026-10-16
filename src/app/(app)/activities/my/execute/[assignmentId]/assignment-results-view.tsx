import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import type { Dictionary } from "@/lib/i18n/dictionary";

import {
  assignmentStatusLabel,
  assignmentStatusVariant,
} from "../../../activity-assignment-status";
import { executionFieldsFor } from "../../../activity-type-fields";
import type { ExecutionAssignment } from "./assignment-execution-form";

type Dict = Dictionary["activitiesPage"];
type Option = { id: string; label: string };

// What was set on the shared Activity plan at creation — the organizer-
// level figures this assignment's own actuals are compared against. Only
// the fields with a genuine planned counterpart live here (see the schema
// comments on Activity vs ActivityAssignment); everything else is
// actuals-only and has no "planned" side to show.
export type ActivityPlan = {
  expectedParticipants: number | null;
  foodExpense: string | null;
  transportExpense: string | null;
  requirementCategoryName: string | null;
};

type ResultsAssignment = Omit<ExecutionAssignment, "products"> & {
  products: (ExecutionAssignment["products"][number] & { plannedAvailability: string | null })[];
};

function Field({ label, value, dict }: { label: string; value: string | null; dict: Dict }) {
  return (
    <div className="flex flex-col gap-1">
      <dt className="text-xs text-muted-foreground">{label}</dt>
      <dd className="text-sm">
        {value || <span className="text-muted-foreground">{dict.notRecordedLabel}</span>}
      </dd>
    </div>
  );
}

// Planned-vs-actual pair, for the handful of fields that have both: shown
// side by side rather than as a delta, since a food/transport-expense
// "planned" figure is the organizer-level cost, not this one delegate's
// budget, so the two are never meant to be subtracted.
function ComparisonField({
  label,
  planned,
  actual,
  dict,
}: {
  label: string;
  planned: string | null;
  actual: string | null;
  dict: Dict;
}) {
  return (
    <div className="flex flex-col gap-1">
      <dt className="text-xs text-muted-foreground">{label}</dt>
      <dd className="flex flex-wrap items-baseline gap-x-3 text-sm">
        <span>
          <span className="text-xs text-muted-foreground">{dict.plannedLabel}: </span>
          {planned || dict.notRecordedLabel}
        </span>
        <span>
          <span className="text-xs text-muted-foreground">{dict.actualLabel}: </span>
          {actual || dict.notRecordedLabel}
        </span>
      </dd>
    </div>
  );
}

// Read-only presentation of a completed (or cancelled) assignment's
// recorded results — the counterpart to AssignmentExecutionForm, which is
// only ever shown while the assignment is still PLANNED. Grouped into
// cards so a delegate (or, later, a manager) can scan what was submitted
// rather than parse a grayed-out copy of the edit form.
export function AssignmentResultsView({
  assignment,
  plan,
  recipientOptions,
  dict,
}: {
  assignment: ResultsAssignment;
  plan: ActivityPlan;
  recipientOptions: Option[];
  dict: Dict;
}) {
  const fields = executionFieldsFor(assignment.typeCode);
  const recipientLabel =
    recipientOptions.find((o) => o.id === assignment.recipientContactId)?.label ?? null;

  const hasMetrics =
    fields.pregnantWomenReached ||
    fields.childrenConsulted ||
    fields.actualParticipants ||
    fields.nightShiftTiming;

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center gap-2">
        <Badge variant={assignmentStatusVariant(assignment.status)}>
          {assignmentStatusLabel(assignment.status, dict)}
        </Badge>
      </div>

      {fields.participants && assignment.participants.length > 0 ? (
        <Card>
          <CardHeader>
            <CardTitle>{dict.participantResultsHeading}</CardTitle>
          </CardHeader>
          <CardContent className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{dict.nameLabel}</TableHead>
                  <TableHead>{dict.perPersonFeedbackLabel}</TableHead>
                  <TableHead className="text-right">{dict.prescriptionsGeneratedLabel}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {assignment.participants.map((p) => (
                  <TableRow key={p.contactId}>
                    <TableCell className="font-medium">
                      <div className="flex flex-col gap-1">
                        <span>{p.name}</span>
                        <Badge variant={p.present ? "default" : "outline"} className="w-fit">
                          {p.present ? dict.presentLabel : dict.absentLabel}
                        </Badge>
                      </div>
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {p.present ? p.feedback || dict.notRecordedLabel : "—"}
                    </TableCell>
                    <TableCell className="text-right">
                      {p.present ? (p.prescriptionsGenerated ?? dict.notRecordedLabel) : "—"}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      ) : null}

      {fields.products && assignment.products.length > 0 ? (
        <Card>
          <CardHeader>
            <CardTitle>{dict.productResultsHeading}</CardTitle>
          </CardHeader>
          <CardContent className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{dict.productResultsHeading}</TableHead>
                  <TableHead className="text-right">{dict.prescriptionsGeneratedLabel}</TableHead>
                  <TableHead className="text-right">{dict.businessValueGeneratedLabel}</TableHead>
                  <TableHead className="text-right">{dict.samplesProvidedLabel}</TableHead>
                  {fields.productAvailability ? (
                    <TableHead>{dict.availabilityLabel}</TableHead>
                  ) : null}
                </TableRow>
              </TableHeader>
              <TableBody>
                {assignment.products.map((p) => (
                  <TableRow key={p.productId}>
                    <TableCell className="font-medium">{p.name}</TableCell>
                    <TableCell className="text-right">
                      {p.prescriptionsGenerated ?? dict.notRecordedLabel}
                    </TableCell>
                    <TableCell className="text-right">
                      {p.businessValueGenerated ?? dict.notRecordedLabel}
                    </TableCell>
                    <TableCell className="text-right">
                      {p.samplesProvided ?? dict.notRecordedLabel}
                    </TableCell>
                    {fields.productAvailability ? (
                      <TableCell>
                        <span className="flex flex-col gap-0.5">
                          <span className="text-xs text-muted-foreground">
                            {dict.plannedLabel}: {p.plannedAvailability || dict.notRecordedLabel}
                          </span>
                          <span>
                            {dict.actualLabel}: {p.availability || dict.notRecordedLabel}
                          </span>
                        </span>
                      </TableCell>
                    ) : null}
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      ) : null}

      {hasMetrics || fields.necessity || fields.expenses ? (
        <Card>
          <CardHeader>
            <CardTitle>{dict.executionDetailsHeading}</CardTitle>
          </CardHeader>
          <CardContent>
            <dl className="grid grid-cols-2 gap-4 sm:grid-cols-3">
              {fields.pregnantWomenReached ? (
                <Field
                  label={dict.pregnantWomenReachedLabel}
                  value={assignment.pregnantWomenReached?.toString() ?? null}
                  dict={dict}
                />
              ) : null}
              {fields.childrenConsulted ? (
                <Field
                  label={dict.childrenConsultedLabel}
                  value={assignment.childrenConsulted?.toString() ?? null}
                  dict={dict}
                />
              ) : null}
              {fields.actualParticipants ? (
                <ComparisonField
                  label={dict.actualParticipantsLabel}
                  planned={plan.expectedParticipants?.toString() ?? null}
                  actual={assignment.actualParticipants?.toString() ?? null}
                  dict={dict}
                />
              ) : null}
              {fields.nightShiftTiming ? (
                <Field
                  label={dict.nightShiftTimingLabel}
                  value={assignment.nightShiftTiming}
                  dict={dict}
                />
              ) : null}
              {fields.necessity ? (
                <>
                  <Field
                    label={dict.requirementCategoryLabel}
                    value={plan.requirementCategoryName}
                    dict={dict}
                  />
                  <Field
                    label={dict.requirementValueLabel}
                    value={assignment.requirementValue}
                    dict={dict}
                  />
                  <Field label={dict.recipientLabel} value={recipientLabel} dict={dict} />
                </>
              ) : null}
              {fields.expenses ? (
                <>
                  <ComparisonField
                    label={dict.foodExpenseLabel}
                    planned={plan.foodExpense}
                    actual={assignment.foodExpense}
                    dict={dict}
                  />
                  <ComparisonField
                    label={dict.transportExpenseLabel}
                    planned={plan.transportExpense}
                    actual={assignment.transportExpense}
                    dict={dict}
                  />
                </>
              ) : null}
            </dl>
            {fields.necessity && assignment.supportProvidedDescription ? (
              <div className="mt-4 flex flex-col gap-1">
                <dt className="text-xs text-muted-foreground">{dict.supportProvidedLabel}</dt>
                <dd className="text-sm">{assignment.supportProvidedDescription}</dd>
              </div>
            ) : null}
          </CardContent>
        </Card>
      ) : null}

      <Card>
        <CardHeader>
          <CardTitle>{dict.outcomeNotesLabel}</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          {fields.hcpBeneficiaryFeedback ? (
            <>
              <div className="flex flex-col gap-1">
                <dt className="text-xs text-muted-foreground">{dict.hcpFeedbackLabel}</dt>
                <dd className="text-sm whitespace-pre-wrap">
                  {assignment.hcpFeedback || dict.notRecordedLabel}
                </dd>
              </div>
              <div className="flex flex-col gap-1">
                <dt className="text-xs text-muted-foreground">{dict.beneficiaryFeedbackLabel}</dt>
                <dd className="text-sm whitespace-pre-wrap">
                  {assignment.beneficiaryFeedback || dict.notRecordedLabel}
                </dd>
              </div>
            </>
          ) : null}
          {fields.commitments ? (
            <div className="flex flex-col gap-1">
              <dt className="text-xs text-muted-foreground">{dict.commitmentsLabel}</dt>
              <dd className="text-sm whitespace-pre-wrap">
                {assignment.commitments || dict.notRecordedLabel}
              </dd>
            </div>
          ) : null}
          <div className="flex flex-col gap-1">
            <dt className="text-xs text-muted-foreground">{dict.outcomeNotesLabel}</dt>
            <dd className="text-sm whitespace-pre-wrap">
              {assignment.outcomeNotes || dict.notRecordedLabel}
            </dd>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
