"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import type { Dictionary } from "@/lib/i18n/dictionary";

import { type ActivityFormState, updateAssignmentExecutionAction } from "../../../actions";
import { executionFieldsFor } from "../../../activity-type-fields";

type Dict = Dictionary["activitiesPage"];
type Option = { id: string; label: string };

type ParticipantResult = {
  contactId: string;
  name: string;
  present: boolean;
  feedback: string | null;
  prescriptionsGenerated: number | null;
};

type ProductResult = {
  productId: string;
  name: string;
  prescriptionsGenerated: number | null;
  businessValueGenerated: string | null;
  samplesProvided: number | null;
  availability: string | null;
};

export type ExecutionAssignment = {
  id: string;
  status: string;
  typeCode: string;
  outcomeNotes: string | null;
  hcpFeedback: string | null;
  beneficiaryFeedback: string | null;
  commitments: string | null;
  pregnantWomenReached: number | null;
  childrenConsulted: number | null;
  actualParticipants: number | null;
  nightShiftTiming: string | null;
  requirementValue: string | null;
  supportProvidedDescription: string | null;
  recipientContactId: string | null;
  foodExpense: string | null;
  transportExpense: string | null;
  participants: ParticipantResult[];
  products: ProductResult[];
};

function numberField(value: string): number | null {
  const trimmed = value.trim();
  return trimmed === "" ? null : Number(trimmed);
}

// This delegate's own execution record — common fields always shown, the
// rest conditional on the activity's type (see activity-type-fields.ts,
// checked against the original 11-type brief rather than showing
// everything for every type). Locked once the assignment leaves PLANNED.
export function AssignmentExecutionForm({
  assignment,
  recipientOptions,
  dict,
}: {
  assignment: ExecutionAssignment;
  recipientOptions: Option[];
  dict: Dict;
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const fields = executionFieldsFor(assignment.typeCode);
  const locked = assignment.status !== "PLANNED";

  const [outcomeNotes, setOutcomeNotes] = useState(assignment.outcomeNotes ?? "");
  const [hcpFeedback, setHcpFeedback] = useState(assignment.hcpFeedback ?? "");
  const [beneficiaryFeedback, setBeneficiaryFeedback] = useState(
    assignment.beneficiaryFeedback ?? "",
  );
  const [commitments, setCommitments] = useState(assignment.commitments ?? "");
  const [pregnantWomenReached, setPregnantWomenReached] = useState(
    assignment.pregnantWomenReached?.toString() ?? "",
  );
  const [childrenConsulted, setChildrenConsulted] = useState(
    assignment.childrenConsulted?.toString() ?? "",
  );
  const [actualParticipants, setActualParticipants] = useState(
    assignment.actualParticipants?.toString() ?? "",
  );
  const [nightShiftTiming, setNightShiftTiming] = useState(assignment.nightShiftTiming ?? "");
  const [requirementValue, setRequirementValue] = useState(assignment.requirementValue ?? "");
  const [supportProvidedDescription, setSupportProvidedDescription] = useState(
    assignment.supportProvidedDescription ?? "",
  );
  const [recipientContactId, setRecipientContactId] = useState(assignment.recipientContactId ?? "");
  const [foodExpense, setFoodExpense] = useState(assignment.foodExpense ?? "");
  const [transportExpense, setTransportExpense] = useState(assignment.transportExpense ?? "");
  const [participants, setParticipants] = useState<ParticipantResult[]>(assignment.participants);
  const [products, setProducts] = useState<ProductResult[]>(assignment.products);

  function updateParticipant(contactId: string, patch: Partial<ParticipantResult>) {
    setParticipants((rows) =>
      rows.map((row) => (row.contactId === contactId ? { ...row, ...patch } : row)),
    );
  }

  function updateProduct(productId: string, patch: Partial<ProductResult>) {
    setProducts((rows) =>
      rows.map((row) => (row.productId === productId ? { ...row, ...patch } : row)),
    );
  }

  function onSubmit(event: React.FormEvent) {
    event.preventDefault();
    setError(null);
    startTransition(async () => {
      const formData = new FormData();
      formData.set("assignmentId", assignment.id);
      if (outcomeNotes) formData.set("outcomeNotes", outcomeNotes);
      if (fields.hcpBeneficiaryFeedback) {
        if (hcpFeedback) formData.set("hcpFeedback", hcpFeedback);
        if (beneficiaryFeedback) formData.set("beneficiaryFeedback", beneficiaryFeedback);
      }
      if (fields.commitments && commitments) formData.set("commitments", commitments);
      if (fields.pregnantWomenReached && pregnantWomenReached) {
        formData.set("pregnantWomenReached", pregnantWomenReached);
      }
      if (fields.childrenConsulted && childrenConsulted) {
        formData.set("childrenConsulted", childrenConsulted);
      }
      if (fields.actualParticipants && actualParticipants) {
        formData.set("actualParticipants", actualParticipants);
      }
      if (fields.nightShiftTiming && nightShiftTiming) {
        formData.set("nightShiftTiming", nightShiftTiming);
      }
      if (fields.necessity) {
        if (requirementValue) formData.set("requirementValue", requirementValue);
        if (supportProvidedDescription) {
          formData.set("supportProvidedDescription", supportProvidedDescription);
        }
        if (recipientContactId) formData.set("recipientContactId", recipientContactId);
      }
      if (fields.expenses) {
        if (foodExpense) formData.set("foodExpense", foodExpense);
        if (transportExpense) formData.set("transportExpense", transportExpense);
      }
      formData.set(
        "resultsJson",
        JSON.stringify(
          fields.participants
            ? participants.map((p) => ({
                contactId: p.contactId,
                present: p.present,
                unplanned: false,
                feedback: p.feedback || null,
                prescriptionsGenerated: numberField(p.prescriptionsGenerated?.toString() ?? ""),
              }))
            : [],
        ),
      );
      formData.set(
        "productResultsJson",
        JSON.stringify(
          fields.products
            ? products.map((p) => ({
                productId: p.productId,
                unplanned: false,
                prescriptionsGenerated: p.prescriptionsGenerated,
                businessValueGenerated: p.businessValueGenerated
                  ? Number(p.businessValueGenerated)
                  : null,
                samplesProvided: p.samplesProvided,
                availability: fields.productAvailability ? p.availability || null : null,
              }))
            : [],
        ),
      );

      const result: ActivityFormState = await updateAssignmentExecutionAction(
        { error: null },
        formData,
      );
      if (result.error) {
        setError(result.error);
        return;
      }
      toast.success(dict.resultsSaved);
      router.push("/activities/my");
    });
  }

  return (
    <form onSubmit={onSubmit} className="flex max-w-xl flex-col gap-4">
      {locked ? <p className="text-sm text-muted-foreground">{dict.executionLockedHint}</p> : null}

      {fields.participants && participants.length > 0 ? (
        <div className="flex flex-col gap-2">
          <Label>{dict.participantResultsHeading}</Label>
          <div className="flex flex-col gap-3 rounded-md border border-border p-3">
            {participants.map((p) => (
              <div
                key={p.contactId}
                className="flex flex-col gap-2 border-b border-border pb-3 last:border-0 last:pb-0"
              >
                <label className="flex items-center gap-2 text-sm font-medium">
                  <Checkbox
                    checked={p.present}
                    onCheckedChange={(checked) =>
                      updateParticipant(p.contactId, { present: checked === true })
                    }
                    disabled={isPending || locked}
                  />
                  {p.name}
                </label>
                {p.present ? (
                  <div className="grid grid-cols-2 gap-2 pl-6">
                    <Input
                      placeholder={dict.perPersonFeedbackLabel}
                      value={p.feedback ?? ""}
                      onChange={(e) => updateParticipant(p.contactId, { feedback: e.target.value })}
                      disabled={isPending || locked}
                    />
                    <Input
                      type="number"
                      min="0"
                      placeholder={dict.prescriptionsGeneratedLabel}
                      value={p.prescriptionsGenerated?.toString() ?? ""}
                      onChange={(e) =>
                        updateParticipant(p.contactId, {
                          prescriptionsGenerated: numberField(e.target.value),
                        })
                      }
                      disabled={isPending || locked}
                    />
                  </div>
                ) : null}
              </div>
            ))}
          </div>
        </div>
      ) : null}

      {fields.products && products.length > 0 ? (
        <div className="flex flex-col gap-2">
          <Label>{dict.productResultsHeading}</Label>
          <div className="flex flex-col gap-3 rounded-md border border-border p-3">
            {products.map((p) => (
              <div
                key={p.productId}
                className="flex flex-col gap-2 border-b border-border pb-3 last:border-0 last:pb-0"
              >
                <p className="text-sm font-medium">{p.name}</p>
                <div className="grid grid-cols-3 gap-2">
                  <Input
                    type="number"
                    min="0"
                    placeholder={dict.prescriptionsGeneratedLabel}
                    value={p.prescriptionsGenerated?.toString() ?? ""}
                    onChange={(e) =>
                      updateProduct(p.productId, {
                        prescriptionsGenerated: numberField(e.target.value),
                      })
                    }
                    disabled={isPending || locked}
                  />
                  <Input
                    type="number"
                    min="0"
                    step="0.01"
                    placeholder={dict.businessValueGeneratedLabel}
                    value={p.businessValueGenerated ?? ""}
                    onChange={(e) =>
                      updateProduct(p.productId, { businessValueGenerated: e.target.value || null })
                    }
                    disabled={isPending || locked}
                  />
                  <Input
                    type="number"
                    min="0"
                    placeholder={dict.samplesProvidedLabel}
                    value={p.samplesProvided?.toString() ?? ""}
                    onChange={(e) =>
                      updateProduct(p.productId, { samplesProvided: numberField(e.target.value) })
                    }
                    disabled={isPending || locked}
                  />
                </div>
                {fields.productAvailability ? (
                  <Input
                    placeholder={dict.availabilityLabel}
                    value={p.availability ?? ""}
                    onChange={(e) =>
                      updateProduct(p.productId, { availability: e.target.value || null })
                    }
                    disabled={isPending || locked}
                  />
                ) : null}
              </div>
            ))}
          </div>
        </div>
      ) : null}

      {fields.pregnantWomenReached || fields.childrenConsulted ? (
        <div className="grid grid-cols-2 gap-3">
          {fields.pregnantWomenReached ? (
            <div className="flex flex-col gap-2">
              <Label htmlFor="pregnantWomenReached">{dict.pregnantWomenReachedLabel}</Label>
              <Input
                id="pregnantWomenReached"
                type="number"
                min="0"
                value={pregnantWomenReached}
                onChange={(e) => setPregnantWomenReached(e.target.value)}
                disabled={isPending || locked}
              />
            </div>
          ) : null}
          {fields.childrenConsulted ? (
            <div className="flex flex-col gap-2">
              <Label htmlFor="childrenConsulted">{dict.childrenConsultedLabel}</Label>
              <Input
                id="childrenConsulted"
                type="number"
                min="0"
                value={childrenConsulted}
                onChange={(e) => setChildrenConsulted(e.target.value)}
                disabled={isPending || locked}
              />
            </div>
          ) : null}
        </div>
      ) : null}

      {fields.actualParticipants ? (
        <div className="grid grid-cols-2 gap-3">
          {fields.actualParticipants ? (
            <div className="flex flex-col gap-2">
              <Label htmlFor="actualParticipants">{dict.actualParticipantsLabel}</Label>
              <Input
                id="actualParticipants"
                type="number"
                min="0"
                value={actualParticipants}
                onChange={(e) => setActualParticipants(e.target.value)}
                disabled={isPending || locked}
              />
            </div>
          ) : null}
        </div>
      ) : null}

      {fields.nightShiftTiming ? (
        <div className="flex flex-col gap-2">
          <Label htmlFor="nightShiftTiming">{dict.nightShiftTimingLabel}</Label>
          <Input
            id="nightShiftTiming"
            value={nightShiftTiming}
            onChange={(e) => setNightShiftTiming(e.target.value)}
            disabled={isPending || locked}
          />
        </div>
      ) : null}

      {fields.necessity ? (
        <>
          <div className="flex flex-col gap-2">
            <Label htmlFor="supportProvidedDescription">{dict.supportProvidedLabel}</Label>
            <Textarea
              id="supportProvidedDescription"
              value={supportProvidedDescription}
              onChange={(e) => setSupportProvidedDescription(e.target.value)}
              disabled={isPending || locked}
            />
          </div>
          <div className="flex flex-col gap-2">
            <Label htmlFor="requirementValue">{dict.requirementValueLabel}</Label>
            <Input
              id="requirementValue"
              type="number"
              min="0"
              step="0.01"
              value={requirementValue}
              onChange={(e) => setRequirementValue(e.target.value)}
              disabled={isPending || locked}
            />
          </div>
          <div className="flex flex-col gap-2">
            <Label htmlFor="recipient">{dict.recipientLabel}</Label>
            <Select
              items={[
                { value: "", label: dict.recipientNone },
                ...recipientOptions.map((c) => ({ value: c.id, label: c.label })),
              ]}
              value={recipientContactId}
              onValueChange={(value) => setRecipientContactId(value ?? "")}
              disabled={isPending || locked}
            >
              <SelectTrigger id="recipient" className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="">{dict.recipientNone}</SelectItem>
                {recipientOptions.map((c) => (
                  <SelectItem key={c.id} value={c.id}>
                    {c.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </>
      ) : null}

      {fields.expenses ? (
        <div className="grid grid-cols-2 gap-3">
          <div className="flex flex-col gap-2">
            <Label htmlFor="foodExpense">{dict.foodExpenseLabel}</Label>
            <Input
              id="foodExpense"
              type="number"
              min="0"
              step="0.01"
              value={foodExpense}
              onChange={(e) => setFoodExpense(e.target.value)}
              disabled={isPending || locked}
            />
          </div>
          <div className="flex flex-col gap-2">
            <Label htmlFor="transportExpense">{dict.transportExpenseLabel}</Label>
            <Input
              id="transportExpense"
              type="number"
              min="0"
              step="0.01"
              value={transportExpense}
              onChange={(e) => setTransportExpense(e.target.value)}
              disabled={isPending || locked}
            />
          </div>
        </div>
      ) : null}

      {fields.hcpBeneficiaryFeedback ? (
        <>
          <div className="flex flex-col gap-2">
            <Label htmlFor="hcpFeedback">{dict.hcpFeedbackLabel}</Label>
            <Textarea
              id="hcpFeedback"
              value={hcpFeedback}
              onChange={(e) => setHcpFeedback(e.target.value)}
              disabled={isPending || locked}
            />
          </div>
          <div className="flex flex-col gap-2">
            <Label htmlFor="beneficiaryFeedback">{dict.beneficiaryFeedbackLabel}</Label>
            <Textarea
              id="beneficiaryFeedback"
              value={beneficiaryFeedback}
              onChange={(e) => setBeneficiaryFeedback(e.target.value)}
              disabled={isPending || locked}
            />
          </div>
        </>
      ) : null}

      {fields.commitments ? (
        <div className="flex flex-col gap-2">
          <Label htmlFor="commitments">{dict.commitmentsLabel}</Label>
          <Textarea
            id="commitments"
            value={commitments}
            onChange={(e) => setCommitments(e.target.value)}
            disabled={isPending || locked}
          />
        </div>
      ) : null}

      <div className="flex flex-col gap-2">
        <Label htmlFor="outcomeNotes">{dict.outcomeNotesLabel}</Label>
        <Textarea
          id="outcomeNotes"
          value={outcomeNotes}
          onChange={(e) => setOutcomeNotes(e.target.value)}
          disabled={isPending || locked}
        />
      </div>

      {error ? <p className="text-sm text-destructive">{error}</p> : null}

      <Button type="submit" disabled={isPending || locked}>
        {isPending ? dict.savingResults : dict.saveResults}
      </Button>
    </form>
  );
}
