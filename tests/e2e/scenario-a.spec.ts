import { test, expect } from "@playwright/test";
import { createListing, newAccount } from "./fixtures";

test("Scenario A: list, discover, chat, offer, counteroffer, accept, stock committed", async ({ browser }) => {
  const product = `E2E Maize ${Date.now().toString(36)}`;
  const { page: farmer } = await newAccount(browser, "farmer", "E2E Farmer A");
  const productUrl = await createListing(farmer, product, "2150", "120");

  const { page: buyer } = await newAccount(browser, "buyer", "E2E Buyer A");
  await buyer.goto(`/marketplace?q=${encodeURIComponent("E2E Maize")}`);
  await buyer.getByRole("link", { name: product }).first().click();
  await expect(buyer).toHaveURL(productUrl);
  await buyer.click("text=Make an offer");
  await buyer.waitForURL(/\/messages\//);
  await buyer.fill("#o-qty", "50");
  await buyer.fill("#o-price", "2000");
  await buyer.click('button:has-text("Send offer")');
  await expect(buyer.getByText("Offer sent.")).toBeVisible();
  await buyer.fill("#chat-input", "Is the moisture under 14%?");
  await buyer.press("#chat-input", "Enter");
  await expect(buyer.getByRole("paragraph").filter({ hasText: "Is the moisture under 14%?" })).toBeVisible();
  const convUrl = buyer.url().split("?")[0];

  await farmer.goto(convUrl);
  await expect(farmer.getByRole("paragraph").filter({ hasText: "Is the moisture under 14%?" })).toBeVisible();
  await farmer.click('button:has-text("Counter")');
  await farmer.fill("#o-price", "2100");
  await farmer.click('button:has-text("Send counteroffer")');
  await expect(farmer.getByText("Counteroffer sent.")).toBeVisible();

  await buyer.click('button:has-text("Accept")');
  await buyer.click('button:has-text("Accept and record agreement")');
  await expect(buyer.getByText("Offer accepted. Agreement recorded.")).toBeVisible();
  await buyer.click("text=View agreement and contact details");
  await buyer.click("text=Show contact details");
  await expect(buyer.getByText(/\+9198765/)).toBeVisible();

  await farmer.goto("/farmer/products");
  const row = farmer.locator("li, tr, article").filter({ hasText: product }).first();
  await expect(row).toContainText("Available 70 quintals");
  await expect(row).toContainText("Committed 50 quintals");
});
