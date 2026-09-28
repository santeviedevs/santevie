import { notFound } from "next/navigation";

import { getServerDictionary } from "@/lib/i18n/server";
import { requirePermission } from "@/server/auth/require-permission";
import {
  listActiveCommunes,
  listActiveProvinces,
  listActiveQuartiers,
  listActiveVilles,
} from "@/server/repositories/territory-repository";
import { getTerritory, type TerritorySummary } from "@/server/services/territory-service";

import { TerritoryForm } from "../../territory-form";

export const dynamic = "force-dynamic";

type EditTerritoryPageProps = {
  params: Promise<{ id: string }>;
};

function territoryPath(territory: TerritorySummary): string {
  return [
    territory.province.name,
    territory.ville?.name,
    territory.commune?.name,
    territory.quartier?.name,
  ]
    .filter(Boolean)
    .join(" › ");
}

export default async function EditTerritoryPage({ params }: EditTerritoryPageProps) {
  await requirePermission("territories:manage");

  const { id } = await params;
  const [territory, provinces, villes, communes, quartiers, dict] = await Promise.all([
    getTerritory(id),
    listActiveProvinces(),
    listActiveVilles(),
    listActiveCommunes(),
    listActiveQuartiers(),
    getServerDictionary(),
  ]);

  if (!territory) {
    notFound();
  }

  return (
    <div className="flex flex-col gap-6 p-6">
      <h1 className="text-xl font-semibold">{dict.editTerritoryTitle(territoryPath(territory))}</h1>
      <TerritoryForm
        mode="edit"
        options={{ provinces, villes, communes, quartiers }}
        dict={dict.territoriesPage}
        hierarchyDict={dict.territory}
        defaultValues={{
          id: territory.id,
          code: territory.code,
          provinceId: territory.province.id,
          villeId: territory.ville?.id,
          communeId: territory.commune?.id,
          quartierId: territory.quartier?.id,
          status: territory.status,
        }}
      />
    </div>
  );
}
