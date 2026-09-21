import { notFound } from "next/navigation";

import { getServerDictionary } from "@/lib/i18n/server";
import { requirePermission } from "@/server/auth/require-permission";
import {
  listCommunes,
  listProvinces,
  listVilles,
} from "@/server/repositories/territory-repository";
import { getTerritoryEntry } from "@/server/services/territory-service";

import { TerritoryForm } from "../../territory-form";

export const dynamic = "force-dynamic";

type EditTerritoryPageProps = {
  params: Promise<{ id: string }>;
};

export default async function EditTerritoryPage({ params }: EditTerritoryPageProps) {
  await requirePermission("territories:manage");

  const { id } = await params;
  const [territory, provinces, villes, communes, dict] = await Promise.all([
    getTerritoryEntry(id),
    listProvinces(),
    listVilles(),
    listCommunes(),
    getServerDictionary(),
  ]);

  if (!territory) {
    notFound();
  }

  return (
    <div className="flex flex-col gap-6 p-6">
      <h1 className="text-xl font-semibold">{dict.editTerritoryTitle(territory.name)}</h1>
      <TerritoryForm
        mode="edit"
        options={{ provinces, villes, communes }}
        dict={dict.territoriesPage}
        hierarchyDict={dict.territory}
        defaultValues={{
          id: territory.id,
          level: territory.level,
          provinceId: territory.province?.id,
          villeId: territory.ville?.id,
          communeId: territory.commune?.id,
          name: territory.name,
          status: territory.status,
        }}
      />
    </div>
  );
}
