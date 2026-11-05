// Starts the Emulator Suite, restoring data saved by the previous run when there is any,
// and saving it again on exit. Pass --fresh to start empty.
// By default only Auth, Firestore and Storage start: the app's API routes are the backend (free plan).
// Pass --with-functions to also run the Cloud Functions transport (Blaze deployment path).
import { existsSync } from "node:fs";
import { spawn } from "node:child_process";

const fresh = process.argv.includes("--fresh");
const withFunctions = process.argv.includes("--with-functions");
const only = withFunctions ? "auth,firestore,storage,functions" : "auth,firestore,storage";
const args = ["firebase", "emulators:start", "--project", "demo-farmconnect", "--only", only];
if (!fresh) {
  if (existsSync(".emulator-data/firebase-export-metadata.json")) args.push("--import=.emulator-data");
  args.push("--export-on-exit=.emulator-data");
}
const child = spawn("npx", args, { stdio: "inherit", shell: process.platform === "win32" });
for (const sig of ["SIGINT", "SIGTERM"]) process.on(sig, () => child.kill(sig));
child.on("exit", (code) => process.exit(code ?? 0));
