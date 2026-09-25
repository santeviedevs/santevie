import { getServerDictionary } from "@/lib/i18n/server";
import { requirePermission } from "@/server/auth/require-permission";
import {
  listActiveCommunes,
  listActiveProvinces,
  listActiveQuartiers,
  listActiveVilles,
} from "@/server/repositories/territory-repository";
import { listActiveUserOptions } from "@/server/repositories/user-repository";
import { listTerritoryAssignments } from "@/server/services/territory-assignment-service";

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

  const [users, provinces, villes, communes, quartiers, dict] = await Promise.all([
    listActiveUserOptions(),
    listActiveProvinces(),
    listActiveVilles(),
    listActiveCommunes(),
    listActiveQuartiers(),
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
          territoryData={{ provinces, villes, communes, quartiers }}
          dict={t}
          territoryDict={dict.territory}
        />
      ) : (
        <p className="text-sm text-muted-foreground">{t.pickUserPrompt}</p>
      )}
    </div>
  );
}
