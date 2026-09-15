import { notFound } from "next/navigation";

import { getServerDictionary } from "@/lib/i18n/server";
import { requirePermission } from "@/server/auth/require-permission";
import { getTerritory } from "@/server/services/territory-service";

import { TerritoryForm } from "../../territory-form";

export const dynamic = "force-dynamic";

type EditTerritoryPageProps = {
  params: Promise<{ id: string }>;
};

export default async function EditTerritoryPage({ params }: EditTerritoryPageProps) {
  await requirePermission("territories:manage");

  const { id } = await params;
  const [territory, dict] = await Promise.all([getTerritory(id), getServerDictionary()]);

  if (!territory) {
    notFound();
  }

  return (
    <div className="flex flex-col gap-6 p-6">
      <h1 className="text-xl font-semibold">{dict.editTerritoryTitle(territory.name)}</h1>
      <TerritoryForm
        mode="edit"
        dict={dict.territoryForm}
        defaultValues={{
          id: territory.id,
          code: territory.code,
          name: territory.name,
          status: territory.status,
        }}
      />
    </div>
  );
}
