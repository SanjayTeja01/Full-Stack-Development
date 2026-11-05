import { test, expect } from "@playwright/test";

const PAGES = ["/", "/marketplace", "/auctions", "/help", "/terms", "/login", "/register"];

for (const path of PAGES) {
  test(`no horizontal scrolling at phone width: ${path}`, async ({ browser }) => {
    const page = await (await browser.newContext({ viewport: { width: 375, height: 812 } })).newPage();
    await page.goto(path);
    await page.waitForLoadState("load");
    await page.waitForTimeout(500);
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
    expect(overflow).toBeLessThanOrEqual(0);
  });
}
