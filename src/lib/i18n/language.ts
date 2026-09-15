export const LANGUAGES = ["en", "fr"] as const;

export type Language = (typeof LANGUAGES)[number];

export const DEFAULT_LANGUAGE: Language = "en";

// Client and server both read/write this name, so it has to stay a plain
// string constant rather than living only on one side.
export const LANGUAGE_COOKIE = "lang";

export function isLanguage(value: unknown): value is Language {
  return typeof value === "string" && (LANGUAGES as readonly string[]).includes(value);
}
