import { ImportWizard } from "@/components/import/import-wizard";
import { getServerDictionary } from "@/lib/i18n/server";
import { requirePermission } from "@/server/auth/require-permission";

export const dynamic = "force-dynamic";

export default async function CentersImportPage() {
  await requirePermission("centers:manage");
  const dict = await getServerDictionary();

  return (
    <div className="flex flex-col gap-6 p-6">
      <h1 className="text-xl font-semibold">{dict.centersPage.importButton}</h1>
      <ImportWizard entity="centers" backHref="/admin/centers" dict={dict.importPage} />
    </div>
  );
}
