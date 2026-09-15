"use client";

import { useRouter } from "next/navigation";
import { useTransition } from "react";

import { setLanguageAction } from "@/app/(app)/set-language-action";
import { Switch } from "@/components/ui/switch";
import type { Language } from "@/lib/i18n/language";

export function LanguageToggle({ language, label }: { language: Language; label: string }) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  const handleChange = (checked: boolean) => {
    const next: Language = checked ? "fr" : "en";
    startTransition(async () => {
      await setLanguageAction(next);
      router.refresh();
    });
  };

  return (
    <div className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
      <span aria-hidden="true" className={language === "en" ? "text-foreground" : undefined}>
        EN
      </span>
      <Switch
        size="sm"
        aria-label={label}
        disabled={isPending}
        checked={language === "fr"}
        onCheckedChange={handleChange}
      />
      <span aria-hidden="true" className={language === "fr" ? "text-foreground" : undefined}>
        FR
      </span>
    </div>
  );
}
