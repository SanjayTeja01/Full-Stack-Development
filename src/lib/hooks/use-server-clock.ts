"use client";

import * as React from "react";
import { call } from "@/lib/firebase/callable";

let offsetPromise: Promise<number> | null = null;

/**
 * Estimates the difference between the server clock and this device's clock.
 * Countdowns use it so they match the authoritative end time; the server still decides bid validity.
 */
function syncOffset(): Promise<number> {
  if (!offsetPromise) {
    offsetPromise = (async () => {
      const sent = Date.now();
      const { now } = await call<Record<string, never>, { now: number }>("getServerTime", {});
      const received = Date.now();
      return Math.round(now - (sent + received) / 2);
    })().catch(() => {
      offsetPromise = null;
      return 0;
    });
  }
  return offsetPromise;
}

/**
 * `now` is 0 until the component has mounted (the clock must not be read during prerendering);
 * check `ready` before showing countdowns.
 */
export function useServerNow(tickMs = 1000): { now: number; synced: boolean; ready: boolean } {
  const [offset, setOffset] = React.useState<number | null>(null);
  const [tick, setTick] = React.useState(0);
  React.useEffect(() => {
    let alive = true;
    syncOffset().then((o) => alive && setOffset(o));
    return () => {
      alive = false;
    };
  }, []);
  React.useEffect(() => {
    const first = setTimeout(() => setTick(Date.now()), 0);
    const id = setInterval(() => setTick(Date.now()), tickMs);
    return () => {
      clearTimeout(first);
      clearInterval(id);
    };
  }, [tickMs]);
  return { now: tick === 0 ? 0 : tick + (offset ?? 0), synced: offset !== null, ready: tick !== 0 };
}
