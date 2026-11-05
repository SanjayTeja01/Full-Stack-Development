import { timingSafeEqual } from "node:crypto";
import { runScheduledWork } from "@server/index";

/**
 * Starts and finalises due auctions and expires due offers. Call it every minute from a free external
 * scheduler (for example cron-job.org) with `Authorization: Bearer <CRON_SECRET>`. Vercel Cron calls it
 * once a day on the Hobby plan as a backstop. Requests without the secret are rejected.
 */
export const maxDuration = 60;

function authorized(request: Request): boolean {
  const secret = process.env.CRON_SECRET;
  if (!secret) return false;
  const given = Buffer.from(request.headers.get("authorization") ?? "");
  const expected = Buffer.from(`Bearer ${secret}`);
  return given.length === expected.length && timingSafeEqual(given, expected);
}

async function handle(request: Request) {
  if (!authorized(request)) return Response.json({ error: "unauthorized" }, { status: 401 });
  const result = await runScheduledWork();
  return Response.json({ ok: result.errors.length === 0, ...result });
}

export const GET = handle;
export const POST = handle;
