"use client";

import { toast } from "sonner";

import type { CreatableOption } from "@/components/creatable-combobox";
import type { LookupKind } from "@/lib/schemas/person";

import { createLookupAction } from "./actions";

// Client-side wrapper around createLookupAction for the create-or-select
// comboboxes: resolves to the (new or already-existing) option, or null
// after toasting why it failed.
export async function createLookupOption(
  kind: LookupKind,
  name: string,
): Promise<(CreatableOption & { code: string }) | null> {
  const result = await createLookupAction(kind, name);
  if (result.sessionExpired) {
    toast.error("Your session expired. Please sign in again.");
    return null;
  }
  if (result.error || !result.lookup) {
    toast.error(result.error ?? "Could not add the value.");
    return null;
  }
  return { id: result.lookup.id, label: result.lookup.name, code: result.lookup.code };
}
