"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { toast } from "sonner";

import { MultiSelectCombobox } from "@/components/multi-select-combobox";
import { Button } from "@/components/ui/button";
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

import { type ActivityFormState, createActivityAction, updateActivityAction } from "./actions";
import { sharedFieldsFor } from "./activity-type-fields";

type Option = { id: string; label: string };
type TypeOption = { id: string; code: string; label: string };
type CenterOption = { id: string; label: string; territoryId: string | null };

export type EditableActivity = {
  id: string;
  name: string;
  typeId: string;
  centerId: string | null;
  territoryId: string | null;
  location: string | null;
  departmentName: string | null;
  speakerContactId: string | null;
  requirementCategoryId: string | null;
  prescriberCount: number | null;
  expectedParticipants: number | null;
  foodExpense: string | null;
  transportExpense: string | null;
  notes: string | null;
  products: { productId: string; availability: string | null }[];
  participantContactIds: string[];
};

// Creation and editing share one form: creating is a manager action
// (activities:assign) that starts the activity unassigned — the Assignment
// screen is where it's given to one or more people; editing goes through
// the same permission and authorization boundary the service enforces again.
//
// This is the shared-plan form — name, type, where it happens, planned
// products, invited participants, expected counts, requirement category and
// the shared event cost — everything set once at creation, the same for
// every delegate assigned to it. A delegate's own execution results (who
// was actually present, what they achieved) are a separate form entirely,
// reached from their own assignment, not this one — see the schema
// comments on Activity vs. ActivityAssignment for why that split exists.
//
// Every field below this line is conditional on the selected type, checked
// against the client's own "Activity creation form" field table (see
// activity-type-fields.ts) — not the same fields for every type. In
// particular: centre/territory (as a Territory -> Centre cascade: pick a
// territory first, which narrows the centre list, then pick the centre) is
// only required for some types (CPN, CPS, Bonjour, Matinee Scientifique, La
// Garde); RTM/CME/Nurse Conference use a free-text location instead;
// Necessity-Driven uses neither.
export function ActivityForm({
  activity,
  centers,
  territories,
  typeOptions,
  productOptions,
  contactOptions,
  requirementCategories,
  dict,
}: {
  activity?: EditableActivity;
  centers: CenterOption[];
  territories: Option[];
  typeOptions: TypeOption[];
  productOptions: Option[];
  contactOptions: Option[];
  requirementCategories: Option[];
  dict: Dictionary["activitiesPage"];
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const [name, setName] = useState(activity?.name ?? "");
  const [typeId, setTypeId] = useState(activity?.typeId ?? typeOptions[0]?.id ?? "");
  const [territoryId, setTerritoryId] = useState(
    activity?.territoryId ??
      centers.find((c) => c.id === activity?.centerId)?.territoryId ??
      territories[0]?.id ??
      "",
  );
  const [centerId, setCenterId] = useState(activity?.centerId ?? "");
  const [location, setLocation] = useState(activity?.location ?? "");
  const [departmentName, setDepartmentName] = useState(activity?.departmentName ?? "");
  const [speakerContactId, setSpeakerContactId] = useState(activity?.speakerContactId ?? "");
  const [requirementCategoryId, setRequirementCategoryId] = useState(
    activity?.requirementCategoryId ?? "",
  );
  const [prescriberCount, setPrescriberCount] = useState(
    activity?.prescriberCount?.toString() ?? "",
  );
  const [expectedParticipants, setExpectedParticipants] = useState(
    activity?.expectedParticipants?.toString() ?? "",
  );
  const [foodExpense, setFoodExpense] = useState(activity?.foodExpense ?? "");
  const [transportExpense, setTransportExpense] = useState(activity?.transportExpense ?? "");
  const [notes, setNotes] = useState(activity?.notes ?? "");
  const [products, setProducts] = useState<{ productId: string; availability: string | null }[]>(
    activity?.products ?? [],
  );
  const [participantContactIds, setParticipantContactIds] = useState<string[]>(
    activity?.participantContactIds ?? [],
  );
  const productIds = products.map((p) => p.productId);

  // The multi-select only ever hands back the full set of selected ids —
  // reconcile that against `products` rather than replacing it wholesale,
  // so a product's already-entered availability survives re-renders (only
  // newly added ids start out with availability: null).
  function setProductIds(ids: string[]) {
    setProducts((prev) =>
      ids.map(
        (id) => prev.find((p) => p.productId === id) ?? { productId: id, availability: null },
      ),
    );
  }

  function updateProductAvailability(productId: string, availability: string | null) {
    setProducts((prev) =>
      prev.map((p) => (p.productId === productId ? { ...p, availability } : p)),
    );
  }

  const selectedType = typeOptions.find((t) => t.id === typeId);
  const fields = sharedFieldsFor(selectedType?.code);

  function onSubmit(event: React.FormEvent) {
    event.preventDefault();
    setError(null);
    startTransition(async () => {
      const formData = new FormData();
      if (activity) formData.set("id", activity.id);
      formData.set("name", name);
      formData.set("typeId", typeId);
      formData.set("notes", notes);
      if (fields.requiresCenter) {
        formData.set("territoryId", territoryId);
        formData.set("centerId", centerId);
      }
      if (fields.usesLocation && location) formData.set("location", location);
      if (fields.usesDepartment && departmentName) formData.set("departmentName", departmentName);
      if (fields.speaker && speakerContactId) formData.set("speakerContactId", speakerContactId);
      if (fields.requirementCategory && requirementCategoryId) {
        formData.set("requirementCategoryId", requirementCategoryId);
      }
      if (fields.prescriberCount && prescriberCount) {
        formData.set("prescriberCount", prescriberCount);
      }
      if (fields.expectedParticipants && expectedParticipants) {
        formData.set("expectedParticipants", expectedParticipants);
      }
      if (foodExpense) formData.set("foodExpense", foodExpense);
      if (transportExpense) formData.set("transportExpense", transportExpense);
      formData.set(
        "productsJson",
        JSON.stringify(
          fields.products
            ? products.map((p) => ({ productId: p.productId, availability: p.availability }))
            : [],
        ),
      );
      formData.set(
        "participantContactIdsJson",
        JSON.stringify(fields.participants ? participantContactIds : []),
      );

      const result: ActivityFormState = activity
        ? await updateActivityAction({ error: null }, formData)
        : await createActivityAction({ error: null }, formData);
      if (result.error) {
        setError(result.error);
        return;
      }
      toast.success(activity ? dict.activityUpdated : dict.activityCreated);
      router.push(activity ? `/activities/${activity.id}` : "/activities");
    });
  }

  return (
    <form onSubmit={onSubmit} className="flex max-w-xl flex-col gap-3">
      <div className="flex flex-col gap-2">
        <Label htmlFor="name">{dict.nameLabel}</Label>
        <Input
          id="name"
          disabled={isPending}
          value={name}
          onChange={(e) => setName(e.target.value)}
          required
        />
      </div>

      <div className="flex flex-col gap-2">
        <Label htmlFor="type">{dict.typeLabel}</Label>
        <Select
          items={typeOptions.map((t) => ({ value: t.id, label: t.label }))}
          value={typeId}
          onValueChange={(value) => setTypeId(value ?? typeOptions[0]?.id ?? "")}
          disabled={isPending}
        >
          <SelectTrigger id="type" className="w-full">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {typeOptions.map((t) => (
              <SelectItem key={t.id} value={t.id}>
                {t.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {fields.requiresCenter ? (
        <>
          <div className="flex flex-col gap-2">
            <Label htmlFor="territory">{dict.territoryFieldLabel}</Label>
            <Select
              items={territories.map((t) => ({ value: t.id, label: t.label }))}
              value={territoryId}
              onValueChange={(value) => {
                const next = value ?? territories[0]?.id ?? "";
                setTerritoryId(next);
                setCenterId((prev) =>
                  centers.some((c) => c.id === prev && c.territoryId === next) ? prev : "",
                );
              }}
              disabled={isPending}
            >
              <SelectTrigger id="territory" className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {territories.map((t) => (
                  <SelectItem key={t.id} value={t.id}>
                    {t.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="flex flex-col gap-2">
            <Label htmlFor="center">{dict.centerFieldLabel}</Label>
            <Select
              items={centers
                .filter((c) => c.territoryId === territoryId)
                .map((c) => ({ value: c.id, label: c.label }))}
              value={centerId}
              onValueChange={(value) => setCenterId(value ?? "")}
              disabled={isPending || !territoryId}
            >
              <SelectTrigger id="center" className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {centers
                  .filter((c) => c.territoryId === territoryId)
                  .map((c) => (
                    <SelectItem key={c.id} value={c.id}>
                      {c.label}
                    </SelectItem>
                  ))}
              </SelectContent>
            </Select>
          </div>
        </>
      ) : null}

      {fields.usesLocation ? (
        <div className="flex flex-col gap-2">
          <Label htmlFor="location">{dict.locationLabel}</Label>
          <Input
            id="location"
            disabled={isPending}
            value={location}
            onChange={(e) => setLocation(e.target.value)}
          />
        </div>
      ) : null}

      {fields.usesDepartment ? (
        <div className="flex flex-col gap-2">
          <Label htmlFor="departmentName">{dict.departmentLabel}</Label>
          <Input
            id="departmentName"
            disabled={isPending}
            value={departmentName}
            onChange={(e) => setDepartmentName(e.target.value)}
          />
        </div>
      ) : null}

      {fields.speaker ? (
        <div className="flex flex-col gap-2">
          <Label htmlFor="speaker">{dict.speakerLabel}</Label>
          <Select
            items={[
              { value: "", label: dict.speakerNone },
              ...contactOptions.map((c) => ({ value: c.id, label: c.label })),
            ]}
            value={speakerContactId}
            onValueChange={(value) => setSpeakerContactId(value ?? "")}
            disabled={isPending}
          >
            <SelectTrigger id="speaker" className="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="">{dict.speakerNone}</SelectItem>
              {contactOptions.map((c) => (
                <SelectItem key={c.id} value={c.id}>
                  {c.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      ) : null}

      {fields.requirementCategory ? (
        <div className="flex flex-col gap-2">
          <Label htmlFor="requirementCategory">{dict.requirementCategoryLabel}</Label>
          <Select
            items={requirementCategories.map((c) => ({ value: c.id, label: c.label }))}
            value={requirementCategoryId}
            onValueChange={(value) => setRequirementCategoryId(value ?? "")}
            disabled={isPending}
          >
            <SelectTrigger id="requirementCategory" className="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {requirementCategories.map((c) => (
                <SelectItem key={c.id} value={c.id}>
                  {c.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      ) : null}

      {fields.prescriberCount || fields.expectedParticipants ? (
        <div className="grid grid-cols-2 gap-3">
          {fields.prescriberCount ? (
            <div className="flex flex-col gap-2">
              <Label htmlFor="prescriberCount">{dict.prescriberCountLabel}</Label>
              <Input
                id="prescriberCount"
                type="number"
                min="0"
                disabled={isPending}
                value={prescriberCount}
                onChange={(e) => setPrescriberCount(e.target.value)}
              />
            </div>
          ) : null}
          {fields.expectedParticipants ? (
            <div className="flex flex-col gap-2">
              <Label htmlFor="expectedParticipants">{dict.expectedParticipantsLabel}</Label>
              <Input
                id="expectedParticipants"
                type="number"
                min="0"
                disabled={isPending}
                value={expectedParticipants}
                onChange={(e) => setExpectedParticipants(e.target.value)}
              />
            </div>
          ) : null}
        </div>
      ) : null}

      <div className="grid grid-cols-2 gap-3">
        <div className="flex flex-col gap-2">
          <Label htmlFor="foodExpense">{dict.foodExpenseLabel}</Label>
          <Input
            id="foodExpense"
            type="number"
            min="0"
            step="0.01"
            disabled={isPending}
            value={foodExpense}
            onChange={(e) => setFoodExpense(e.target.value)}
          />
        </div>
        <div className="flex flex-col gap-2">
          <Label htmlFor="transportExpense">{dict.transportExpenseLabel}</Label>
          <Input
            id="transportExpense"
            type="number"
            min="0"
            step="0.01"
            disabled={isPending}
            value={transportExpense}
            onChange={(e) => setTransportExpense(e.target.value)}
          />
        </div>
      </div>

      {fields.products ? (
        <div className="flex flex-col gap-2">
          <Label htmlFor="products">{dict.productsLabel}</Label>
          <MultiSelectCombobox
            id="products"
            placeholder={dict.productsPlaceholder}
            options={productOptions}
            value={productIds}
            onChange={setProductIds}
            noMatchesLabel={dict.noOptionsAvailable}
            disabled={isPending}
          />
          {products.length > 0 ? (
            <div className="flex flex-col gap-2 rounded-md border border-border p-3">
              {products.map((p) => (
                <div key={p.productId} className="flex items-center gap-2">
                  <span className="min-w-0 flex-1 truncate text-sm">
                    {productOptions.find((o) => o.id === p.productId)?.label ?? p.productId}
                  </span>
                  <Input
                    className="w-48"
                    placeholder={dict.availabilityLabel}
                    value={p.availability ?? ""}
                    onChange={(e) => updateProductAvailability(p.productId, e.target.value || null)}
                    disabled={isPending}
                  />
                </div>
              ))}
            </div>
          ) : null}
        </div>
      ) : null}

      {fields.participants ? (
        <div className="flex flex-col gap-2">
          <Label htmlFor="participants">{dict.participantsLabel}</Label>
          <MultiSelectCombobox
            id="participants"
            placeholder={dict.participantsPlaceholder}
            options={contactOptions}
            value={participantContactIds}
            onChange={setParticipantContactIds}
            noMatchesLabel={dict.noOptionsAvailable}
            disabled={isPending}
          />
        </div>
      ) : null}

      <div className="flex flex-col gap-2">
        <Label htmlFor="notes">{dict.notesLabel}</Label>
        <Textarea
          id="notes"
          disabled={isPending}
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
        />
      </div>

      {error ? <p className="text-sm text-destructive">{error}</p> : null}

      <Button type="submit" disabled={isPending}>
        {isPending ? dict.saving : dict.save}
      </Button>
    </form>
  );
}
