import { getServerDictionary } from "@/lib/i18n/server";
import { requirePermission } from "@/server/auth/require-permission";
import { getClientFormOptions } from "@/server/services/client-service";
import { getHospitalOptions } from "@/server/services/doctor-hospital-service";

import { ClientForm } from "../client-form";

export const dynamic = "force-dynamic";

export default async function NewClientPage() {
  await requirePermission("clients:manage");

  const [options, hospitalOptions, dict] = await Promise.all([
    getClientFormOptions(),
    getHospitalOptions(),
    getServerDictionary(),
  ]);

  return (
    <div className="flex flex-col gap-6 p-6">
      <h1 className="text-xl font-semibold">{dict.clientForm.newClientTitle}</h1>
      <ClientForm
        mode="create"
        options={{ ...options, hospitalOptions }}
        dict={dict.clientForm}
        territoryDict={dict.territory}
      />
    </div>
  );
}
