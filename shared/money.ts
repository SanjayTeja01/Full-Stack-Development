/**
 * Money is always stored as integer minor units (paise for INR).
 * Never do arithmetic on rupee floats.
 */
export const CURRENCY = "INR" as const;
export type Currency = typeof CURRENCY;

export function isValidMinorAmount(value: unknown): value is number {
  return typeof value === "number" && Number.isSafeInteger(value) && value >= 0;
}

/** Parses a rupee string such as "2150", "2,150.5" or "2150.50" into paise without floating point. */
export function parseRupeesToPaise(input: string): number | null {
  const cleaned = input.replace(/[,\s₹]/g, "");
  const match = /^(\d{1,12})(?:\.(\d{0,2}))?$/.exec(cleaned);
  if (!match) return null;
  const rupees = Number(match[1]);
  const fraction = (match[2] ?? "").padEnd(2, "0");
  const paise = rupees * 100 + Number(fraction || "0");
  return Number.isSafeInteger(paise) ? paise : null;
}

export function paiseToRupeeString(paise: number): string {
  const sign = paise < 0 ? "-" : "";
  const abs = Math.abs(paise);
  const rupees = Math.floor(abs / 100);
  const rem = abs % 100;
  return rem === 0 ? `${sign}${rupees}` : `${sign}${rupees}.${String(rem).padStart(2, "0")}`;
}

const inrFormatter = new Intl.NumberFormat("en-IN", {
  style: "currency",
  currency: "INR",
  minimumFractionDigits: 0,
  maximumFractionDigits: 2,
});

export function formatINR(paise: number): string {
  // Division by 100 is only used for display, never stored.
  return inrFormatter.format(paise / 100);
}

/** Total value in paise for an integer quantity at an integer price per unit. */
export function lineTotal(pricePerUnitPaise: number, quantity: number): number {
  const total = pricePerUnitPaise * quantity;
  if (!Number.isSafeInteger(total)) throw new Error("Amount is too large");
  return total;
}
