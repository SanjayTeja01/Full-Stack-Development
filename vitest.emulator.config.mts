import { defineConfig } from "vitest/config";
import { fileURLToPath } from "node:url";

/** Integration tests against the Emulator Suite. Run with `npm run test:emulator`. */
export default defineConfig({
  resolve: {
    alias: {
      "@shared": fileURLToPath(new URL("./shared", import.meta.url)),
      "@server": fileURLToPath(new URL("./server", import.meta.url)),
      "@": fileURLToPath(new URL("./src", import.meta.url)),
    },
  },
  test: {
    include: ["tests/emulator/**/*.test.ts", "tests/rules/**/*.test.ts"],
    environment: "node",
    env: {
      FIRESTORE_EMULATOR_HOST: process.env.FIRESTORE_EMULATOR_HOST ?? "127.0.0.1:8080",
      FIREBASE_AUTH_EMULATOR_HOST: process.env.FIREBASE_AUTH_EMULATOR_HOST ?? "127.0.0.1:9099",
      GCLOUD_PROJECT: process.env.GCLOUD_PROJECT ?? "demo-farmconnect",
    },
    testTimeout: 60_000,
    hookTimeout: 60_000,
    fileParallelism: false,
  },
});
