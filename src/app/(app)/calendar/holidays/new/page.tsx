import { getServerDictionary } from "@/lib/i18n/server";
import { requirePermission } from "@/server/auth/require-permission";
import { listActiveTerritoryOptions } from "@/server/services/territory-service";

import { HolidayForm } from "../holiday-form";

export const dynamic = "force-dynamic";

export default async function NewHolidayPage() {
  await requirePermission("holidays:manage");

  const [territories, dict] = await Promise.all([
    listActiveTerritoryOptions(),
    getServerDictionary(),
  ]);

  return (
    <div className="flex flex-col gap-6 p-6">
      <h1 className="text-xl font-semibold">{dict.holidayForm.newTitle}</h1>
      <HolidayForm
        mode="create"
        territories={territories.map((territory) => ({
          id: territory.id,
          label: `${territory.label} (${territory.code})`,
        }))}
        dict={dict.holidayForm}
      />
    </div>
  );
}
