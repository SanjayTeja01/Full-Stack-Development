import { test, expect } from "@playwright/test";
import { newAccount } from "./fixtures";

test("signed-out visitors are sent to sign in from protected pages", async ({ page }) => {
  await page.goto("/farmer/products");
  await page.waitForURL(/\/login\?next=%2Ffarmer%2Fproducts/);
  await expect(page.getByRole("heading", { name: /sign in/i })).toBeVisible();
});

test("registration with a role leads to the right dashboard, and other roles' areas are refused", async ({ browser }) => {
  const { page } = await newAccount(browser, "buyer", "E2E Buyer");
  await expect(page.getByRole("heading", { name: /Welcome, E2E Buyer/ })).toBeVisible();
  await page.goto("/farmer/products");
  await expect(page.getByText("This area is not available for your account")).toBeVisible();
  await page.goto("/admin");
  await expect(page.getByText("This area is not available for your account")).toBeVisible();
});

test("wrong password shows a clear error", async ({ page }) => {
  await page.goto("/login");
  await page.fill("#email", "nobody-here@example.com");
  await page.fill("#password", "not-the-password");
  await page.click("button[type=submit]");
  await expect(page.getByRole("alert").filter({ hasText: /password|account|email/i })).toBeVisible();
  await expect(page).toHaveURL(/\/login/);
});
