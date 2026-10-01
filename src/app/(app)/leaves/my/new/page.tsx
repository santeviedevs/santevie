import { getServerDictionary } from "@/lib/i18n/server";
import { requirePermission } from "@/server/auth/require-permission";
import { listLeaveTypes } from "@/server/repositories/leave-type-repository";

import { ApplyLeaveForm } from "../apply-leave-form";

export const dynamic = "force-dynamic";

export default async function ApplyLeavePage() {
  await requirePermission("leave:apply");

  const [leaveTypes, dict] = await Promise.all([listLeaveTypes(), getServerDictionary()]);

  return (
    <div className="flex flex-col gap-6 p-6">
      <h1 className="text-xl font-semibold">{dict.leaveForm.title}</h1>
      <ApplyLeaveForm
        leaveTypes={leaveTypes.map((type) => ({ id: type.id, name: type.name }))}
        dict={dict.leaveForm}
      />
    </div>
  );
}
