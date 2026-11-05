import { build } from "esbuild";

// Bundles the Cloud Functions transport together with ../server and ../shared so both sides run the same business rules.
await build({
  entryPoints: ["src/index.ts"],
  bundle: true,
  platform: "node",
  target: "node22",
  format: "cjs",
  outfile: "lib/index.js",
  sourcemap: true,
  external: ["firebase-admin", "firebase-functions"],
  logLevel: "info",
});
