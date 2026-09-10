import { notFound } from "next/navigation";

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
  const territory = await getTerritory(id);

  if (!territory) {
    notFound();
  }

  return (
    <div className="flex flex-col gap-6 p-6">
      <h1 className="text-xl font-semibold">Edit {territory.name}</h1>
      <TerritoryForm
        mode="edit"
        defaultValues={{ id: territory.id, code: territory.code, name: territory.name }}
      />
    </div>
  );
}
