import { getServerDictionary } from "@/lib/i18n/server";
import { requirePermission } from "@/server/auth/require-permission";
import { getPersonFormOptions } from "@/server/services/person-service";

import { PersonForm } from "../person-form";

export const dynamic = "force-dynamic";

export default async function NewPersonPage() {
  await requirePermission("persons:manage");

  const [options, dict] = await Promise.all([getPersonFormOptions(), getServerDictionary()]);

  return (
    <div className="flex flex-col gap-6 p-6">
      <h1 className="text-xl font-semibold">{dict.persons.newTitle}</h1>
      <PersonForm
        mode="create"
        options={options}
        dict={dict.persons}
        territoryDict={dict.territory}
      />
    </div>
  );
}
