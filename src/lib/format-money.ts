// The client's own price list uses a comma as the decimal separator (French/
// DRC convention: "3,334" means 3.334, not three thousand) — confirmed with
// Deepak, who asked the portal show "," rather than ".". Used anywhere a
// USD or CDF amount is displayed; never for anything sent back to the
// server, which always parses a plain "." decimal.
const usdFormatter = new Intl.NumberFormat("fr-FR", {
  minimumFractionDigits: 2,
  maximumFractionDigits: 3,
});

const cdfFormatter = new Intl.NumberFormat("fr-FR", {
  minimumFractionDigits: 0,
  maximumFractionDigits: 0,
});

export function formatUsd(amount: number): string {
  return `$ ${usdFormatter.format(amount)}`;
}

export function formatCdf(amount: number): string {
  return `${cdfFormatter.format(amount)} CDF`;
}
