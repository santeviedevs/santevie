import { LanguageToggle } from "@/components/shell/language-toggle";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { getLanguage, getServerDictionary } from "@/lib/i18n/server";

import { LoginForm } from "./login-form";

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ callbackUrl?: string }>;
}) {
  const { callbackUrl } = await searchParams;
  const [language, dict] = await Promise.all([getLanguage(), getServerDictionary()]);

  return (
    <div className="flex min-h-screen items-center justify-center bg-zinc-50 px-4 dark:bg-black">
      <Card className="w-full max-w-sm">
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle>{dict.loginPage.title}</CardTitle>
          <LanguageToggle language={language} label={dict.header.languageToggleLabel} />
        </CardHeader>
        <CardContent>
          <LoginForm callbackUrl={callbackUrl} dict={dict.loginPage} />
        </CardContent>
      </Card>
    </div>
  );
}
