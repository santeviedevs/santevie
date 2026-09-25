import { getServerDictionary } from "@/lib/i18n/server";
import { requirePermission } from "@/server/auth/require-permission";
import { listActiveUserOptions } from "@/server/repositories/user-repository";
import { listTerritoryAssignments } from "@/server/services/territory-assignment-service";
import { listActiveTerritoryOptions } from "@/server/services/territory-service";

import { AssignmentManager } from "./assignment-manager";
import { UserPicker } from "./user-picker";

// Gated on territories:manage — both ADMIN and MANAGER get access (see the
// S2-04 decision log: this avoids the Manager/users:manage lockout that
// nesting under Users would have caused). Inherently user-scoped, so never
// statically cached.
export const dynamic = "force-dynamic";

type AssignmentPageProps = {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

function firstValue(value: string | string[] | undefined): string | undefined {
  const single = Array.isArray(value) ? value[0] : value;
  return single === "" ? undefined : single;
}

export default async function TerritoryAssignmentPage({ searchParams }: AssignmentPageProps) {
  await requirePermission("territories:manage");

  const params = await searchParams;
  const selectedUserId = firstValue(params.userId) ?? null;

  const [users, territoryOptions, dict] = await Promise.all([
    listActiveUserOptions(),
    listActiveTerritoryOptions(),
    getServerDictionary(),
  ]);
  const t = dict.territoryAssignmentPage;

  const assignments = selectedUserId ? await listTerritoryAssignments(selectedUserId) : [];

  return (
    <div className="flex flex-col gap-6 p-6">
      <h1 className="text-xl font-semibold">{t.title}</h1>

      <UserPicker
        users={users}
        selectedUserId={selectedUserId}
        label={t.userLabel}
        placeholder={t.selectUser}
      />

      {selectedUserId ? (
        <AssignmentManager
          userId={selectedUserId}
          assignments={assignments}
          territoryOptions={territoryOptions}
          dict={t}
          territoryPickerDict={dict.territory}
        />
      ) : (
        <p className="text-sm text-muted-foreground">{t.pickUserPrompt}</p>
      )}
    </div>
  );
}
