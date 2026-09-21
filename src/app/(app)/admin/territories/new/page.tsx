import { getServerDictionary } from "@/lib/i18n/server";
import { requirePermission } from "@/server/auth/require-permission";
import {
  listActiveCommunes,
  listActiveProvinces,
  listActiveVilles,
} from "@/server/repositories/territory-repository";

import { TerritoryForm } from "../territory-form";

export const dynamic = "force-dynamic";

export default async function NewTerritoryPage() {
  await requirePermission("territories:manage");

  const [provinces, villes, communes, dict] = await Promise.all([
    listActiveProvinces(),
    listActiveVilles(),
    listActiveCommunes(),
    getServerDictionary(),
  ]);

  return (
    <div className="flex flex-col gap-6 p-6">
      <h1 className="text-xl font-semibold">{dict.territoriesPage.createTerritory}</h1>
      <TerritoryForm
        mode="create"
        options={{ provinces, villes, communes }}
        dict={dict.territoriesPage}
        hierarchyDict={dict.territory}
      />
    </div>
  );
}
