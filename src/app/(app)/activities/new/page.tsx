import { getServerDictionary } from "@/lib/i18n/server";
import { requirePermission } from "@/server/auth/require-permission";
import { listActiveClientsForSelection } from "@/server/repositories/client-repository";
import { listActiveTerritoryOptions } from "@/server/services/territory-service";

import { ActivityForm } from "../activity-form";

export const dynamic = "force-dynamic";

// Creating is a manager (activities:assign) action. The activity starts
// unassigned; the Assignment tab is where it's given to someone.
export default async function NewActivityPage() {
  await requirePermission("activities:assign");
  const dict = await getServerDictionary();
  const t = dict.activitiesPage;

  const [clients, territories] = await Promise.all([
    listActiveClientsForSelection(),
    listActiveTerritoryOptions(),
  ]);

  return (
    <div className="flex flex-col gap-6 p-6">
      <h1 className="text-xl font-semibold">{t.newActivityPageTitle}</h1>
      <ActivityForm
        clients={clients.map((c) => ({ id: c.id, label: `${c.name} (${c.code})` }))}
        territories={territories.map((territory) => ({
          id: territory.id,
          label: territory.label,
        }))}
        dict={t}
      />
    </div>
  );
}
