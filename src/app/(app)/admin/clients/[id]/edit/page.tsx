import { notFound } from "next/navigation";

import { getServerDictionary } from "@/lib/i18n/server";
import { requirePermission } from "@/server/auth/require-permission";
import { getClient, getClientFormOptions } from "@/server/services/client-service";
import { getHospitalOptions } from "@/server/services/doctor-hospital-service";

import { ClientForm } from "../../client-form";

export const dynamic = "force-dynamic";

type EditClientPageProps = {
  params: Promise<{ id: string }>;
};

export default async function EditClientPage({ params }: EditClientPageProps) {
  await requirePermission("clients:manage");

  const { id } = await params;
  const [client, options, hospitalOptions, dict] = await Promise.all([
    getClient(id),
    getClientFormOptions(),
    getHospitalOptions(),
    getServerDictionary(),
  ]);

  if (!client) {
    notFound();
  }

  return (
    <div className="flex flex-col gap-6 p-6">
      <h1 className="text-xl font-semibold">{dict.editClientTitle(client.name)}</h1>
      <ClientForm
        mode="edit"
        options={{ ...options, hospitalOptions }}
        dict={dict.clientForm}
        territoryDict={dict.territory}
        defaultValues={{
          id: client.id,
          code: client.code,
          name: client.name,
          typeId: client.type.id,
          contact: client.contact,
          address: client.address,
          latitude: client.latitude,
          longitude: client.longitude,
          territoryId: client.territory?.id ?? null,
          status: client.status,
          doctor: client.doctor
            ? {
                doctorType: client.doctor.doctorType,
                gender: client.doctor.gender,
                department: client.doctor.department,
                mobileNo: client.doctor.mobileNo,
              }
            : undefined,
          hospital: client.hospital
            ? { hospitalCategory: client.hospital.hospitalCategory }
            : undefined,
          hospitalIds: client.doctor?.hospitals.map((h) => h.id) ?? [],
        }}
      />
    </div>
  );
}
