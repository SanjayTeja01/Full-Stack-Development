import { expect, type Browser, type Page } from "@playwright/test";
import { initializeApp, getApps } from "firebase-admin/app";
import { getFirestore, Timestamp } from "firebase-admin/firestore";

const PASSWORD = "e2e-password-1";
let n = 0;
const run = Date.now().toString(36);

/** Admin access to the emulator, used only to move auction clocks forward. Refuses to touch a real project. */
export function emulatorDb() {
  process.env.FIRESTORE_EMULATOR_HOST ??= "127.0.0.1:8080";
  if (!getApps().length) initializeApp({ projectId: process.env.GCLOUD_PROJECT ?? "demo-farmconnect" });
  return getFirestore();
}

export async function endAuctionNow(auctionId: string) {
  await emulatorDb().collection("auctions").doc(auctionId).update({ endsAt: Timestamp.fromMillis(Date.now() - 1000) });
}

/** Registers a new account through the UI (register, then onboarding) and returns a signed-in page. */
export async function newAccount(browser: Browser, role: "farmer" | "buyer", name: string, viewport = { width: 1280, height: 900 }) {
  const page = await (await browser.newContext({ viewport })).newPage();
  const email = `e2e-${role}-${run}-${++n}@example.com`;
  await page.goto(`/register?role=${role}`);
  await page.fill("#displayName", name);
  await page.fill("#email", email);
  await page.fill("#password", PASSWORD);
  await page.fill("#confirm", PASSWORD);
  await page.check("input[name=accept]");
  await page.click("button[type=submit]");
  await page.waitForURL(/onboarding/);
  await page.fill("#phone", `98765${String(10000 + n).slice(-5)}`);
  await page.selectOption("#location-state", "Telangana");
  await page.fill("#location-district", "Warangal");
  if (role === "buyer") await page.fill("#org", `${name} Traders`).catch(() => undefined);
  await page.click("button[type=submit]");
  await page.waitForURL(new RegExp(`/${role}$`));
  return { page, email };
}

export async function signIn(browser: Browser, email: string, password = PASSWORD) {
  const page = await (await browser.newContext()).newPage();
  await page.goto("/login");
  await page.fill("#email", email);
  await page.fill("#password", password);
  await page.click("button[type=submit]");
  await page.waitForURL((u) => !u.pathname.startsWith("/login"));
  return page;
}

/** Creates and publishes a listing through the farmer UI. Returns the product page URL. */
export async function createListing(page: Page, name: string, priceRupees: string, quantity: string) {
  await page.goto("/farmer/products/new");
  await page.fill("#name", name);
  await page.waitForSelector("#categoryId option[value=cereals]", { state: "attached" });
  await page.selectOption("#categoryId", "cereals");
  await page.fill("#description", `${name}, sun dried, moisture under 14 percent. Inspection welcome.`);
  await page.fill("#price", priceRupees);
  await page.fill("#availableQuantity", quantity);
  await page.click("text=Publish listing");
  await page.waitForURL((u) => u.pathname.startsWith("/products/"));
  // Previously visited routes can stay mounted but hidden, so match the visible heading only.
  await expect(page.getByRole("heading", { level: 1, name })).toBeVisible();
  return page.url();
}

export async function placeBid(page: Page, rupees: string) {
  await page.fill("#bid-amount", rupees);
  await page.click('button:has-text("Review bid")');
  await page.click('[role=alertdialog] button:has-text("Place bid")');
}
