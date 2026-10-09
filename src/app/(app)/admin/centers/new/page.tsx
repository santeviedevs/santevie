import { getServerDictionary } from "@/lib/i18n/server";
import { requirePermission } from "@/server/auth/require-permission";
import { getCenterFormOptions } from "@/server/services/center-service";

import { CenterForm } from "../center-form";

export const dynamic = "force-dynamic";

export default async function NewCenterPage() {
  await requirePermission("centers:manage");

  const [options, dict] = await Promise.all([getCenterFormOptions(), getServerDictionary()]);

  return (
    <div className="flex flex-col gap-6 p-6">
      <h1 className="text-xl font-semibold">{dict.centerForm.newCenterTitle}</h1>
      <CenterForm
        mode="create"
        options={options}
        dict={dict.centerForm}
        territoryDict={dict.territory}
      />
    </div>
  );
}
