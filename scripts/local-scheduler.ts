/**
 * Runs the scheduled jobs against the LOCAL EMULATOR once a minute (the Emulator Suite does not fire
 * scheduled functions on its own). Uses the same code as the deployed `auctionScheduler` and
 * `expireOffers` functions. Refuses to run against a real project.
 *
 *   npm run scheduler:local          loop every 60 seconds
 *   npm run scheduler:local -- --once
 */
if (!process.env.FIRESTORE_EMULATOR_HOST) {
  console.error("Refusing to run: FIRESTORE_EMULATOR_HOST must be set (use `npm run scheduler:local`).");
  process.exit(1);
}
process.env.GCLOUD_PROJECT ||= "demo-farmconnect";

async function main() {
  const { processDueAuctions } = await import("../server/auctions");
  const { expireDueOffers } = await import("../server/offers");
  const once = process.argv.includes("--once");
  const tick = async () => {
    try {
      const auctions = await processDueAuctions();
      const offers = await expireDueOffers();
      console.log(`[${new Date().toISOString()}] auctions started=${auctions.started} finalized=${auctions.finalized}; offers expired=${offers}`);
    } catch (e) {
      console.error("Scheduler run failed:", e);
    }
  };
  await tick();
  if (once) return;
  setInterval(tick, 60_000);
}

void main();
