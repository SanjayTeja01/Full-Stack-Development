/**
 * Cloud Functions transport (Blaze plan only). The free deployment path serves the same operations from
 * the Next.js route at src/app/api/rpc/[name]; both use the platform-neutral code in ../../server.
 */
import { onCall, HttpsError as FunctionsHttpsError, type CallableRequest } from "firebase-functions/https";
import { onSchedule } from "firebase-functions/scheduler";
import { operations, HttpsError, processDueAuctions, expireDueOffers } from "../../server";

const REGION = "asia-south1";
const ENFORCE_APP_CHECK = process.env.ENFORCE_APP_CHECK === "true";

function expose(name: string) {
  const op = operations.get(name)!;
  return onCall({ region: REGION, enforceAppCheck: ENFORCE_APP_CHECK, cors: true }, async (request: CallableRequest<unknown>) => {
    try {
      return await op.run(request.data, { auth: request.auth ? { uid: request.auth.uid, token: request.auth.token } : null });
    } catch (err) {
      if (err instanceof HttpsError) throw new FunctionsHttpsError(err.code, err.message, err.details);
      throw err;
    }
  });
}

const callables = Object.fromEntries([...operations.keys()].map((name) => [name, expose(name)]));
module.exports = {
  ...callables,
  auctionScheduler: onSchedule({ region: REGION, schedule: "every 1 minutes", timeZone: "Asia/Kolkata", retryCount: 3 }, async () => {
    await processDueAuctions();
  }),
  expireOffers: onSchedule({ region: REGION, schedule: "every 5 minutes", timeZone: "Asia/Kolkata" }, async () => {
    await expireDueOffers();
  }),
};
