"use server";

import { headers } from "next/headers";
import { AuthError } from "next-auth";

import { loginSchema } from "@/lib/schemas/auth";
import { signIn } from "@/server/auth";
import { isRateLimited } from "@/server/auth/rate-limit";

const GENERIC_ERROR = "Invalid email or password.";
const RATE_LIMIT_ERROR = "Too many sign-in attempts. Try again in a few minutes.";

// callbackUrl comes from the query string, so it's attacker-controllable —
// only ever redirect to a same-origin relative path, never to a value like
// "https://evil.example" or "//evil.example" (protocol-relative).
function safeRedirectTarget(value: FormDataEntryValue | null): string {
  if (typeof value === "string" && value.startsWith("/") && !value.startsWith("//")) {
    return value;
  }
  return "/";
}

export async function loginAction(
  _prevState: { error: string | null },
  formData: FormData,
): Promise<{ error: string | null }> {
  const parsed = loginSchema.safeParse({
    email: formData.get("email"),
    password: formData.get("password"),
  });

  if (!parsed.success) {
    return { error: GENERIC_ERROR };
  }

  const { email, password } = parsed.data;
  const address = (await headers()).get("x-forwarded-for") ?? "unknown";

  if (isRateLimited(`account:${email.toLowerCase()}`) || isRateLimited(`address:${address}`)) {
    return { error: RATE_LIMIT_ERROR };
  }

  try {
    await signIn("credentials", {
      email,
      password,
      redirectTo: safeRedirectTarget(formData.get("callbackUrl")),
    });
    return { error: null };
  } catch (error) {
    if (error instanceof AuthError) {
      return { error: GENERIC_ERROR };
    }
    // signIn throws a redirect internally on success; let that propagate.
    throw error;
  }
}
