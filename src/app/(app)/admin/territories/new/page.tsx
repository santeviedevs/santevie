import { getServerDictionary } from "@/lib/i18n/server";
import { requirePermission } from "@/server/auth/require-permission";

import { TerritoryForm } from "../territory-form";

export const dynamic = "force-dynamic";

export default async function NewTerritoryPage() {
  await requirePermission("territories:manage");

  const dict = await getServerDictionary();

  return (
    <div className="flex flex-col gap-6 p-6">
      <h1 className="text-xl font-semibold">{dict.territoryForm.newTerritoryTitle}</h1>
      <TerritoryForm mode="create" dict={dict.territoryForm} />
    </div>
  );
}
