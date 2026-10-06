import { notFound } from "next/navigation";

import { getServerDictionary } from "@/lib/i18n/server";
import { requirePermission } from "@/server/auth/require-permission";
import { getHoliday } from "@/server/services/holiday-service";
import { listActiveTerritoryOptions } from "@/server/services/territory-service";

import { HolidayForm } from "../holiday-form";

export const dynamic = "force-dynamic";

type EditHolidayPageProps = {
  params: Promise<{ id: string }>;
};

function toDateInputValue(date: Date): string {
  return date.toISOString().slice(0, 10);
}

export default async function EditHolidayPage({ params }: EditHolidayPageProps) {
  await requirePermission("holidays:manage");

  const { id } = await params;
  const [holiday, territories, dict] = await Promise.all([
    getHoliday(id),
    listActiveTerritoryOptions(),
    getServerDictionary(),
  ]);

  if (!holiday) notFound();

  return (
    <div className="flex flex-col gap-6 p-6">
      <h1 className="text-xl font-semibold">{holiday.name}</h1>
      <HolidayForm
        mode="edit"
        territories={territories.map((territory) => ({
          id: territory.id,
          label: `${territory.label} (${territory.code})`,
        }))}
        defaultValues={{
          id: holiday.id,
          name: holiday.name,
          startDate: toDateInputValue(holiday.startDate),
          endDate: toDateInputValue(holiday.endDate),
          territoryId: holiday.territory?.id ?? null,
          status: holiday.status,
        }}
        dict={dict.holidayForm}
      />
    </div>
  );
}
