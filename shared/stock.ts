import { DomainError } from "./errors";

/**
 * Stock buckets for a product. A unit of produce is in exactly one bucket:
 *  available -> free to offer, auction or sell
 *  reserved  -> held by a scheduled or live auction
 *  committed -> promised by an accepted offer or auction win, awaiting external fulfilment
 *  sold      -> reported complete by both parties
 */
export interface StockLevels {
  availableQuantity: number;
  reservedQuantity: number;
  committedQuantity: number;
  soldQuantity: number;
}

function assertQuantity(q: number) {
  if (!Number.isSafeInteger(q) || q <= 0) {
    throw new DomainError("invalid-argument", "Quantity must be a positive whole number.");
  }
}

function assertInvariant(s: StockLevels): StockLevels {
  for (const [k, v] of Object.entries(s)) {
    if (!Number.isSafeInteger(v) || v < 0) {
      throw new DomainError("failed-precondition", `Stock bucket ${k} would become invalid.`);
    }
  }
  return s;
}

export function reserveForAuction(s: StockLevels, q: number): StockLevels {
  assertQuantity(q);
  if (s.availableQuantity < q) {
    throw new DomainError("failed-precondition", `Only ${s.availableQuantity} available; cannot reserve ${q} for the auction.`, {
      available: s.availableQuantity,
    });
  }
  return assertInvariant({ ...s, availableQuantity: s.availableQuantity - q, reservedQuantity: s.reservedQuantity + q });
}

export function releaseReservation(s: StockLevels, q: number): StockLevels {
  assertQuantity(q);
  return assertInvariant({ ...s, reservedQuantity: s.reservedQuantity - q, availableQuantity: s.availableQuantity + q });
}

export function commitFromReservation(s: StockLevels, q: number): StockLevels {
  assertQuantity(q);
  return assertInvariant({ ...s, reservedQuantity: s.reservedQuantity - q, committedQuantity: s.committedQuantity + q });
}

export function commitFromAvailable(s: StockLevels, q: number): StockLevels {
  assertQuantity(q);
  if (s.availableQuantity < q) {
    throw new DomainError(
      "failed-precondition",
      `Only ${s.availableQuantity} is still uncommitted, so ${q} cannot be accepted. Please revise the quantity.`,
      { available: s.availableQuantity },
    );
  }
  return assertInvariant({ ...s, availableQuantity: s.availableQuantity - q, committedQuantity: s.committedQuantity + q });
}

/** External fulfilment failed or was cancelled: produce returns to available stock. */
export function releaseCommitment(s: StockLevels, q: number): StockLevels {
  assertQuantity(q);
  return assertInvariant({ ...s, committedQuantity: s.committedQuantity - q, availableQuantity: s.availableQuantity + q });
}

export function fulfilCommitment(s: StockLevels, q: number): StockLevels {
  assertQuantity(q);
  return assertInvariant({ ...s, committedQuantity: s.committedQuantity - q, soldQuantity: s.soldQuantity + q });
}

/** Farmer adjusts free stock (new harvest, spoilage). Reserved and committed stock cannot be changed this way. */
export function setAvailable(s: StockLevels, newAvailable: number): StockLevels {
  if (!Number.isSafeInteger(newAvailable) || newAvailable < 0) {
    throw new DomainError("invalid-argument", "Available quantity must be a whole number of zero or more.");
  }
  return assertInvariant({ ...s, availableQuantity: newAvailable });
}

export function totalHeld(s: StockLevels): number {
  return s.availableQuantity + s.reservedQuantity + s.committedQuantity;
}

export function pickStock(s: StockLevels): StockLevels {
  return {
    availableQuantity: s.availableQuantity,
    reservedQuantity: s.reservedQuantity,
    committedQuantity: s.committedQuantity,
    soldQuantity: s.soldQuantity,
  };
}
