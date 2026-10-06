import { notFound } from "next/navigation";

import { getServerDictionary } from "@/lib/i18n/server";
import { requirePermission } from "@/server/auth/require-permission";
import { getTerritory } from "@/server/services/territory-service";
import { getWorkingDays } from "@/server/services/working-day-service";

import { WorkingDaysForm } from "./working-days-form";

export const dynamic = "force-dynamic";

type WorkingDaysPageProps = {
  params: Promise<{ id: string }>;
};

export default async function WorkingDaysPage({ params }: WorkingDaysPageProps) {
  await requirePermission("working-days:manage");

  const { id } = await params;
  const [territory, workingDays, dict] = await Promise.all([
    getTerritory(id),
    getWorkingDays(id),
    getServerDictionary(),
  ]);

  if (!territory) notFound();

  return (
    <div className="flex flex-col gap-6 p-6">
      <h1 className="text-xl font-semibold">
        {dict.workingDaysPage.title} — {territory.code}
      </h1>
      <WorkingDaysForm
        territoryId={territory.id}
        workingDays={workingDays}
        dict={dict.workingDaysPage}
      />
    </div>
  );
}
