"use server";

import { revalidatePath } from "next/cache";

import { setExchangeRateSchema } from "@/lib/schemas/exchange-rate";
import { requirePermission, SessionExpiredError } from "@/server/auth/require-permission";
import { setExchangeRate } from "@/server/services/exchange-rate-service";

export type ExchangeRateFormState = { error: string | null; sessionExpired?: boolean };

async function requireProductsManage() {
  try {
    return await requirePermission("products:manage");
  } catch (error) {
    if (error instanceof SessionExpiredError) {
      return null;
    }
    throw error;
  }
}

export async function setExchangeRateAction(
  _prevState: ExchangeRateFormState,
  formData: FormData,
): Promise<ExchangeRateFormState> {
  const session = await requireProductsManage();
  if (!session) return { error: null, sessionExpired: true };

  const rateValue = formData.get("rate");
  const parsed = setExchangeRateSchema.safeParse({
    rate: typeof rateValue === "string" ? Number(rateValue) : undefined,
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Check the highlighted fields." };
  }

  await setExchangeRate(parsed.data, session.user.id);

  revalidatePath("/admin/exchange-rate");
  revalidatePath("/admin/products");
  return { error: null };
}
