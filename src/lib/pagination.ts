import { z } from "zod";

// The hard ceiling (S2-06): whatever a caller requests, pageSize is clamped
// to this — never send the whole table because a query string asked for it.
export const MAX_PAGE_SIZE = 100;
export const DEFAULT_PAGE_SIZE = 5;

// `.catch()`, not `.max()` alone: `.max()` only validates — a pageSize over
// the ceiling would fail parsing and crash the whole page. A malformed or
// out-of-range query param should degrade to a sane default instead, so
// `.catch()` swallows anything invalid (missing, non-numeric, negative,
// decimal) before the separate `.transform` clamps an otherwise-valid but
// too-large pageSize down to the ceiling.
export const paginationParamsSchema = z.object({
  page: z.coerce.number().int().min(1).catch(1),
  pageSize: z.coerce
    .number()
    .int()
    .min(1)
    .catch(DEFAULT_PAGE_SIZE)
    .transform((value) => Math.min(value, MAX_PAGE_SIZE)),
});

export type PaginationParams = z.infer<typeof paginationParamsSchema>;

export type PagedResult<T> = {
  items: T[];
  total: number;
  page: number;
  pageSize: number;
};

export function toSkipTake(params: PaginationParams): { skip: number; take: number } {
  return { skip: (params.page - 1) * params.pageSize, take: params.pageSize };
}

export function totalPages(total: number, pageSize: number): number {
  return Math.max(1, Math.ceil(total / pageSize));
}
