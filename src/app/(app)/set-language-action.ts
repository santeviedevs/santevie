"use server";

import { revalidatePath } from "next/cache";
import { cookies } from "next/headers";

import { isLanguage, LANGUAGE_COOKIE } from "@/lib/i18n/language";

export async function setLanguageAction(language: string) {
  if (!isLanguage(language)) return;

  const store = await cookies();
  store.set(LANGUAGE_COOKIE, language, {
    path: "/",
    maxAge: 60 * 60 * 24 * 365,
    sameSite: "lax",
  });

  // Every Server Component under the shell reads the cookie directly, so a
  // full-layout revalidation is what actually makes the switch visible —
  // a narrower revalidatePath would miss whichever page isn't the current
  // one.
  revalidatePath("/", "layout");
}
