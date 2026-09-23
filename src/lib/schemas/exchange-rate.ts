import { z } from "zod";

// USD → CDF. Positive, and deliberately not capped — the client's own rate
// already runs ahead of the central bank's and can move a lot between
// updates.
export const setExchangeRateSchema = z.object({
  rate: z.number().positive("Rate must be greater than zero"),
});
export type SetExchangeRateInput = z.infer<typeof setExchangeRateSchema>;
