import { getServerDictionary } from "@/lib/i18n/server";
import { requirePermission } from "@/server/auth/require-permission";
import { getEffectiveRequiresLocation } from "@/server/services/attendance-service";

import { CheckInForm } from "./check-in-form";

export const dynamic = "force-dynamic";

export default async function CheckInPage() {
  const session = await requirePermission("attendance:check-in");

  const [requiresLocation, dict] = await Promise.all([
    getEffectiveRequiresLocation(session.user.id),
    getServerDictionary(),
  ]);

  return (
    <div className="flex flex-col gap-6 p-6">
      <h1 className="text-xl font-semibold">{dict.checkInPage.title}</h1>
      <CheckInForm requiresLocation={requiresLocation} dict={dict.checkInPage} />
    </div>
  );
}
