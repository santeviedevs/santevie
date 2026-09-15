import { cookies } from "next/headers";

import { getDictionary } from "./dictionary";
import { DEFAULT_LANGUAGE, isLanguage, type Language, LANGUAGE_COOKIE } from "./language";

export async function getLanguage(): Promise<Language> {
  const store = await cookies();
  const value = store.get(LANGUAGE_COOKIE)?.value;
  return isLanguage(value) ? value : DEFAULT_LANGUAGE;
}

// Convenience for Server Components that just want the strings — the
// common case, since most pages have no other use for the language value
// itself.
export async function getServerDictionary() {
  return getDictionary(await getLanguage());
}
