import { test, expect } from "@playwright/test";
import { createListing, endAuctionNow, newAccount, placeBid } from "./fixtures";

test("Scenario B: auction with two buyers, outbid, result recorded and stock committed", async ({ browser }) => {
  const product = `E2E Paddy ${Date.now().toString(36)}`;
  const { page: farmer } = await newAccount(browser, "farmer", "E2E Farmer B");
  await createListing(farmer, product, "2000", "100");

  await farmer.goto("/farmer/auctions/new");
  await farmer.waitForSelector(`#productId option:has-text("${product}")`, { state: "attached" });
  const value = await farmer.$eval("#productId", (s, name) => [...(s as HTMLSelectElement).options].find((o) => o.text.includes(name as string))!.value, product);
  await farmer.selectOption("#productId", value);
  await farmer.fill("#quantity", "20");
  await farmer.fill("#startingPrice", "2150");
  await farmer.fill("#minimumIncrement", "50");
  await farmer.selectOption("#duration", String(60 * 60_000));
  await farmer.check("input[name=acceptRules]");
  await farmer.click('button:has-text("Publish auction")');
  await farmer.waitForURL((u) => u.pathname.startsWith("/auctions/"), { timeout: 30_000 });
  const auctionUrl = farmer.url();
  const auctionId = auctionUrl.split("/").pop()!;
  await expect(farmer.getByText("Your auction", { exact: true })).toBeVisible();

  const { page: b1 } = await newAccount(browser, "buyer", "E2E Buyer B1");
  const { page: b2 } = await newAccount(browser, "buyer", "E2E Buyer B2");
  // Buyers see it among live auctions.
  await b1.goto("/buyer/auctions");
  await expect(b1.getByRole("link", { name: new RegExp(product) }).first()).toBeVisible();
  await b1.goto(auctionUrl);
  await b2.goto(auctionUrl);

  await placeBid(b1, "2150");
  await expect(b1.getByText("You hold the highest bid")).toBeVisible();
  await expect(b2.getByText("₹2,200/qtl").first()).toBeVisible();

  // Below the minimum increment: refused before it reaches the server.
  await b2.fill("#bid-amount", "2180");
  await b2.click('button:has-text("Review bid")');
  await expect(b2.locator("#bid-amount-error")).toContainText("₹2,200");
  await placeBid(b2, "2200");
  await expect(b2.getByText("You hold the highest bid")).toBeVisible();
  await expect(b1.getByText("You have been outbid")).toBeVisible();
  await placeBid(b1, "2250");
  await expect(b1.getByText("You hold the highest bid")).toBeVisible();
  await expect(farmer.getByText("can only be cancelled by an administrator")).toBeVisible();

  await endAuctionNow(auctionId);
  await expect(b1.getByText("You won this auction")).toBeVisible({ timeout: 30_000 });
  await expect(b2.getByText("Won by Bidder 1")).toBeVisible();
  await b1.click("text=Open agreement");
  await expect(b1.getByText("Show contact details")).toBeVisible();

  await farmer.goto("/farmer/products");
  const row = farmer.locator("li, tr, article").filter({ hasText: product }).first();
  await expect(row).toContainText("Available 80 quintals");
  await expect(row).toContainText("Committed 20 quintals");
});
