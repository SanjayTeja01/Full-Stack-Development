import { logger } from "./http";
import { db, FieldValue } from "./admin";

/** Records an operational error for the admin dashboard. Never throws. */
export async function recordOpsError(source: string, error: unknown, context: Record<string, unknown> = {}): Promise<void> {
  const message = error instanceof Error ? error.message : String(error);
  logger.error(`[ops] ${source}: ${message}`, context);
  try {
    const ref = db.collection("opsErrors").doc();
    await ref.set({ errorId: ref.id, source, message, context, createdAt: FieldValue.serverTimestamp(), resolved: false });
  } catch (e) {
    logger.error("Failed to record ops error", e);
  }
}
