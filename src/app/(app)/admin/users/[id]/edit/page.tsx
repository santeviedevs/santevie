import { notFound } from "next/navigation";

import { getServerDictionary } from "@/lib/i18n/server";
import { requirePermission } from "@/server/auth/require-permission";
import { getUserScope } from "@/server/scope";
import { getUser, getUserFormOptions } from "@/server/services/user-service";

import { UserForm } from "../../user-form";

export const dynamic = "force-dynamic";

type EditUserPageProps = {
  params: Promise<{ id: string }>;
};

export default async function EditUserPage({ params }: EditUserPageProps) {
  const session = await requirePermission("users:manage");

  const { id } = await params;
  const scope = await getUserScope(session);
  const [user, options, dict] = await Promise.all([
    getUser(id, scope),
    getUserFormOptions(id),
    getServerDictionary(),
  ]);

  if (!user) {
    notFound();
  }

  return (
    <div className="flex flex-col gap-6 p-6">
      <h1 className="text-xl font-semibold">{dict.editUserTitle(user.name)}</h1>
      <UserForm
        mode="edit"
        options={options}
        dict={dict.userForm}
        territoryDict={dict.territory}
        defaultValues={{
          id: user.id,
          employeeCode: user.employeeCode,
          name: user.name,
          email: user.email,
          roleId: user.role.id,
          managerId: user.manager?.id ?? null,
          territoryId: user.territory?.id ?? null,
          status: user.status,
        }}
      />
    </div>
  );
}
