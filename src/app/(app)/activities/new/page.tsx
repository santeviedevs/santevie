import { getServerDictionary } from "@/lib/i18n/server";
import { requirePermission } from "@/server/auth/require-permission";
import {
  listRequirementCategories,
  listStandardEventActivityTypes,
} from "@/server/repositories/activity-repository";
import { listActiveCentersForSelection } from "@/server/repositories/center-repository";
import { listActiveContactsForSelection } from "@/server/repositories/contact-repository";
import { listActiveProductsForSelection } from "@/server/repositories/product-repository";
import { listActiveTerritoryOptions } from "@/server/services/territory-service";

import { ActivityForm } from "../activity-form";

export const dynamic = "force-dynamic";

// Creating is a manager (activities:assign) action. The activity starts
// unassigned; the Assignment tab is where it's given to someone.
export default async function NewActivityPage() {
  await requirePermission("activities:assign");
  const dict = await getServerDictionary();
  const t = dict.activitiesPage;

  const [centers, territories, types, products, contacts, requirementCategories] =
    await Promise.all([
      listActiveCentersForSelection(),
      listActiveTerritoryOptions(),
      listStandardEventActivityTypes(),
      listActiveProductsForSelection(),
      listActiveContactsForSelection(),
      listRequirementCategories(),
    ]);

  return (
    <div className="flex flex-col gap-6 p-6">
      <h1 className="text-xl font-semibold">{t.newActivityPageTitle}</h1>
      <ActivityForm
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
    </div>
  );
}
