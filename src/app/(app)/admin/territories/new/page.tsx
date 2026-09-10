import { requirePermission } from "@/server/auth/require-permission";

import { TerritoryForm } from "../territory-form";

export const dynamic = "force-dynamic";

export default async function NewTerritoryPage() {
  await requirePermission("territories:manage");

  return (
    <div className="flex flex-col gap-6 p-6">
      <h1 className="text-xl font-semibold">New territory</h1>
      <TerritoryForm mode="create" />
    </div>
  );
}
