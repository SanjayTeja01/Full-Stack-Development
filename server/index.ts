/**
 * Entry point of the trusted backend. Importing this module registers every operation in `operations`.
 * Transports: src/app/api/rpc/[name]/route.ts (Next.js, free plan) and functions/src/index.ts (Cloud Functions, Blaze).
 */
import "./users";
import "./products";
import "./reports";
import "./conversations";
import "./offers";
import "./agreements";
import "./auctions";
import "./admin";
import { db, FieldValue } from "./lib/admin";
import { processDueAuctions } from "./auctions";
import { expireDueOffers } from "./offers";
import { recordOpsError } from "./lib/ops";
import { logger } from "./lib/http";

export { operations, type CallRequest, type RequestAuth } from "./lib/callable";
export { HttpsError } from "./lib/http";
export { processDueAuctions, expireDueOffers };

/** Starts/finalises due auctions and expires due offers. Safe to run concurrently and repeatedly. */
export async function runScheduledWork(nowMs = Date.now()) {
  const result: { auctions?: { started: number; finalized: number }; expiredOffers?: number; errors: string[] } = { errors: [] };
  try {
    result.auctions = await processDueAuctions(nowMs);
  } catch (e) {
    result.errors.push("auctions");
    await recordOpsError("scheduler.auctions", e);
  }
  try {
    result.expiredOffers = await expireDueOffers(nowMs);
  } catch (e) {
    result.errors.push("offers");
    await recordOpsError("scheduler.offers", e);
  }
  return result;
}

const CATCH_UP_INTERVAL_MS = 60_000;
let lastLocalCatchUp = 0;

/**
 * Runs the scheduled work at most about once a minute across all server instances, using a lease
 * document. Called after normal API requests so timers advance even without an external cron.
 */
export async function catchUpIfDue(nowMs = Date.now()): Promise<void> {
  if (nowMs - lastLocalCatchUp < CATCH_UP_INTERVAL_MS) return;
  lastLocalCatchUp = nowMs;
  const lease = db.collection("system").doc("scheduler");
  try {
    const acquired = await db.runTransaction(async (tx) => {
      const last = ((await tx.get(lease)).get("lastRunAtMs") as number | undefined) ?? 0;
      if (nowMs - last < CATCH_UP_INTERVAL_MS) return false;
      tx.set(lease, { lastRunAtMs: nowMs, updatedAt: FieldValue.serverTimestamp() }, { merge: true });
      return true;
    });
    if (acquired) await runScheduledWork(nowMs);
  } catch (e) {
    logger.warn("scheduled catch-up skipped", e);
  }
}
