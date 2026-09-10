import { requirePermission } from "@/server/auth/require-permission";
import { getUserFormOptions } from "@/server/services/user-service";

import { UserForm } from "../user-form";

export const dynamic = "force-dynamic";

export default async function NewUserPage() {
  await requirePermission("users:manage");

  const options = await getUserFormOptions();

  return (
    <div className="flex flex-col gap-6 p-6">
      <h1 className="text-xl font-semibold">New user</h1>
      <UserForm mode="create" options={options} />
    </div>
  );
}
