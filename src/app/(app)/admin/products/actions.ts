"use server";

import { revalidatePath } from "next/cache";

import { createProductSchema, updateProductSchema } from "@/lib/schemas/product";
import { requirePermission, SessionExpiredError } from "@/server/auth/require-permission";
import {
  createProduct,
  DuplicateProductCodeError,
  updateProduct,
} from "@/server/services/product-service";

export type ProductFormState = { error: string | null; sessionExpired?: boolean };

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

function messageFor(error: unknown): string {
  if (error instanceof DuplicateProductCodeError) {
    return error.message;
  }
  throw error;
}

function readId(formData: FormData, key: string): string | null {
  const value = formData.get(key);
  return typeof value === "string" && value.length > 0 ? value : null;
}

function readNumber(formData: FormData, key: string): number | undefined {
  const value = formData.get(key);
  if (typeof value !== "string" || value.length === 0) return undefined;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : undefined;
}

function readCommon(formData: FormData) {
  return {
    code: formData.get("code"),
    name: formData.get("name"),
    categoryId: readId(formData, "categoryId"),
    grossPrice: readNumber(formData, "grossPrice"),
    netPrice: readNumber(formData, "netPrice"),
  };
}

export async function createProductAction(
  _prevState: ProductFormState,
  formData: FormData,
): Promise<ProductFormState> {
  const session = await requireProductsManage();
  if (!session) return { error: null, sessionExpired: true };

  const parsed = createProductSchema.safeParse(readCommon(formData));
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Check the highlighted fields." };
  }

  try {
    await createProduct(parsed.data, session.user.id);
  } catch (error) {
    return { error: messageFor(error) };
  }

  revalidatePath("/admin/products");
  return { error: null };
}

export async function updateProductAction(
  _prevState: ProductFormState,
  formData: FormData,
): Promise<ProductFormState> {
  const session = await requireProductsManage();
  if (!session) return { error: null, sessionExpired: true };

  const status = formData.get("status");

  const parsed = updateProductSchema.safeParse({
    id: formData.get("id"),
    ...readCommon(formData),
    status: status === "ACTIVE" || status === "INACTIVE" ? status : undefined,
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Check the highlighted fields." };
  }

  try {
    await updateProduct(parsed.data, session.user.id);
  } catch (error) {
    return { error: messageFor(error) };
  }

  revalidatePath("/admin/products");
  return { error: null };
}
