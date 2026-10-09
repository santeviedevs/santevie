import { notFound } from "next/navigation";

import { getServerDictionary } from "@/lib/i18n/server";
import { requirePermission } from "@/server/auth/require-permission";
import { getPerson, getPersonFormOptions } from "@/server/services/person-service";

import { PersonForm } from "../../person-form";

export const dynamic = "force-dynamic";

type EditPersonPageProps = {
  params: Promise<{ id: string }>;
};

export default async function EditPersonPage({ params }: EditPersonPageProps) {
  await requirePermission("persons:manage");

  const { id } = await params;
  const [person, dict] = await Promise.all([getPerson(id), getServerDictionary()]);
  if (!person) notFound();

  const options = await getPersonFormOptions(person);

  return (
    <div className="flex flex-col gap-6 p-6">
      <h1 className="text-xl font-semibold">
        {dict.persons.editTitle}: {person.name}
      </h1>
      <PersonForm
        mode="edit"
        options={options}
        dict={dict.persons}
        territoryDict={dict.territory}
        defaultValues={{
          id: person.id,
          name: person.name,
          personTypeId: person.personType.id,
          gender: person.gender,
          mobile: person.mobile,
          specializationId: person.specialization.id,
          territoryId: person.territory.id,
          status: person.status,
          centers: person.centers.map((c) => ({
            clientId: c.clientId,
            roleAtCenterId: c.roleAtCenterId,
          })),
        }}
      />
    </div>
  );
}
