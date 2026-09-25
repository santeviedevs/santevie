import { ImportWizard } from "@/components/import/import-wizard";
import { getServerDictionary } from "@/lib/i18n/server";
import { requirePermission } from "@/server/auth/require-permission";

export const dynamic = "force-dynamic";

export default async function ClientsImportPage() {
  await requirePermission("clients:manage");
  const dict = await getServerDictionary();

  return (
    <div className="flex flex-col gap-6 p-6">
      <h1 className="text-xl font-semibold">{dict.clientsPage.importButton}</h1>
      <ImportWizard entity="clients" backHref="/admin/clients" dict={dict.importPage} />
    </div>
  );
}
