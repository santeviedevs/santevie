import type { Dictionary } from "@/lib/i18n/dictionary";
import type { Language } from "@/lib/i18n/language";

import { LanguageToggle } from "./language-toggle";
import { UserMenu } from "./user-menu";

export function AppHeader({
  name,
  roleName,
  language,
  dict,
}: {
  name: string;
  roleName: string;
  language: Language;
  dict: Dictionary;
}) {
  return (
    <header className="flex h-14 items-center justify-between border-b border-border px-4 md:px-6">
      <span className="font-heading text-lg font-semibold md:hidden">Santevie</span>
      <div className="hidden md:block" />
      <div className="flex items-center gap-3">
        <LanguageToggle language={language} label={dict.header.languageToggleLabel} />
        <UserMenu name={name} roleName={roleName} signOutLabel={dict.header.signOut} />
      </div>
    </header>
  );
}
