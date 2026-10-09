import { notFound } from "next/navigation";

import { getServerDictionary } from "@/lib/i18n/server";
import { requirePermission } from "@/server/auth/require-permission";
import { getCenter, getCenterFormOptions } from "@/server/services/center-service";

import { CenterForm } from "../../center-form";

export const dynamic = "force-dynamic";

type EditCenterPageProps = {
  params: Promise<{ id: string }>;
};

export default async function EditCenterPage({ params }: EditCenterPageProps) {
  await requirePermission("centers:manage");

  const { id } = await params;
  const [center, options, dict] = await Promise.all([
    getCenter(id),
    getCenterFormOptions(),
    getServerDictionary(),
  ]);

  if (!center) {
    notFound();
  }

  return (
    <div className="flex flex-col gap-6 p-6">
      <h1 className="text-xl font-semibold">{dict.editCenterTitle(center.name)}</h1>
      <CenterForm
        mode="edit"
        options={options}
        dict={dict.centerForm}
        territoryDict={dict.territory}
        defaultValues={{
          id: center.id,
          code: center.code,
          name: center.name,
          typeId: center.type.id,
          responsiblePerson: center.responsiblePerson,
          mobileNo: center.mobileNo,
          address: center.address,
          latitude: center.latitude,
          longitude: center.longitude,
          territoryId: center.territory?.id ?? null,
          status: center.status,
          hospital: center.hospital
            ? { hospitalCategory: center.hospital.hospitalCategory }
            : undefined,
        }}
      />
    </div>
  );
}
