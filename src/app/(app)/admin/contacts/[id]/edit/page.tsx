import { notFound } from "next/navigation";

import { getServerDictionary } from "@/lib/i18n/server";
import { requirePermission } from "@/server/auth/require-permission";
import { getContact, getContactFormOptions } from "@/server/services/contact-service";

import { ContactForm } from "../../contact-form";

export const dynamic = "force-dynamic";

type EditContactPageProps = {
  params: Promise<{ id: string }>;
};

export default async function EditContactPage({ params }: EditContactPageProps) {
  await requirePermission("contacts:manage");

  const { id } = await params;
  const [contact, dict] = await Promise.all([getContact(id), getServerDictionary()]);
  if (!contact) notFound();

  const options = await getContactFormOptions(contact);

  return (
    <div className="flex flex-col gap-6 p-6">
      <h1 className="text-xl font-semibold">
        {dict.contacts.editTitle}: {contact.name}
      </h1>
      <ContactForm
        mode="edit"
        options={options}
        dict={dict.contacts}
        territoryDict={dict.territory}
        defaultValues={{
          id: contact.id,
          name: contact.name,
          contactTypeId: contact.contactType.id,
          gender: contact.gender,
          mobile: contact.mobile,
          specializationId: contact.specialization.id,
          territoryId: contact.territory.id,
          status: contact.status,
          centers: contact.centers.map((c) => ({
            centerId: c.centerId,
            roleAtCenterId: c.roleAtCenterId,
          })),
        }}
      />
    </div>
  );
}
