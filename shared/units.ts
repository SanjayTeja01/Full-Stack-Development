/**
 * Supported measurement units. Quantities are whole numbers in the listing's unit.
 * All v1 units are weight units so prices can be compared on a per-quintal basis.
 */
export const UNITS = {
  kg: { id: "kg", label: "Kilogram", short: "kg", plural: "kg", kgFactor: 1 },
  quintal: { id: "quintal", label: "Quintal (100 kg)", short: "qtl", plural: "quintals", kgFactor: 100 },
  tonne: { id: "tonne", label: "Tonne (1,000 kg)", short: "t", plural: "tonnes", kgFactor: 1000 },
} as const;

export type UnitId = keyof typeof UNITS;
export const UNIT_IDS = Object.keys(UNITS) as UnitId[];

export function unitShort(unit: UnitId): string {
  return UNITS[unit]?.short ?? unit;
}

export function formatQuantity(quantity: number, unit: UnitId): string {
  const def = UNITS[unit];
  if (!def) return `${quantity} ${unit}`;
  const label = unit === "kg" ? "kg" : quantity === 1 ? unit : def.plural;
  return `${new Intl.NumberFormat("en-IN").format(quantity)} ${label}`;
}

export function toKg(quantity: number, unit: UnitId): number {
  return quantity * UNITS[unit].kgFactor;
}

/**
 * Price per quintal in paise, used only for comparison and sorting across units.
 * Rounded to the nearest paisa; never used for agreements.
 */
export function normalizedPricePerQuintal(pricePerUnitPaise: number, unit: UnitId): number {
  return Math.round((pricePerUnitPaise * 100) / UNITS[unit].kgFactor);
}
