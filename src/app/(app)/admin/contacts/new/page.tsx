import { getServerDictionary } from "@/lib/i18n/server";
import { requirePermission } from "@/server/auth/require-permission";
import { getContactFormOptions } from "@/server/services/contact-service";

import { ContactForm } from "../contact-form";

export const dynamic = "force-dynamic";

export default async function NewContactPage() {
  await requirePermission("contacts:manage");

  const [options, dict] = await Promise.all([getContactFormOptions(), getServerDictionary()]);

  return (
    <div className="flex flex-col gap-6 p-6">
      <h1 className="text-xl font-semibold">{dict.contacts.newTitle}</h1>
      <ContactForm
        mode="create"
        options={options}
        dict={dict.contacts}
        territoryDict={dict.territory}
      />
    </div>
  );
}
