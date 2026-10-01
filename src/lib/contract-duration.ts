export const CONTRACT_DURATION_UNITS = ["DAYS", "MONTHS", "YEARS"] as const;
export type ContractDurationUnit = (typeof CONTRACT_DURATION_UNITS)[number];

// Pure date math, shared between the form's live expiry preview (client)
// and the server, which recomputes and owns the stored value — never trust
// an expiry date submitted by the client, same reasoning as order totals.
// UTC-based since contractStartDate/contractExpiryDate are calendar dates
// (Prisma @db.Date), not timestamped business events.
export function computeContractExpiry(
  startDate: Date,
  durationValue: number,
  durationUnit: ContractDurationUnit,
): Date {
  const expiry = new Date(startDate);
  if (durationUnit === "DAYS") {
    expiry.setUTCDate(expiry.getUTCDate() + durationValue);
  } else if (durationUnit === "MONTHS") {
    expiry.setUTCMonth(expiry.getUTCMonth() + durationValue);
  } else {
    expiry.setUTCFullYear(expiry.getUTCFullYear() + durationValue);
  }
  return expiry;
}
