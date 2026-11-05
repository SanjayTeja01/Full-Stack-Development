import { describe, expect, it, beforeAll } from "vitest";
import { codeOf, createUser, ensureCategories, type TestUser } from "./helpers";

const base = {
  name: "Photo test",
  categoryId: "cereals",
  description: "Image validation test",
  unit: "quintal",
  pricePerUnit: 200_000,
  minOrderQuantity: 1,
  location: { state: "Telangana", district: "Warangal" },
  availableQuantity: 10,
  publish: false,
};

describe("product image validation (emulator)", () => {
  let farmer: TestUser, other: TestUser;
  beforeAll(async () => {
    await ensureCategories();
    [farmer, other] = await Promise.all([createUser("farmer"), createUser("farmer")]);
  });

  it("accepts photos in the farmer's own folder on Vercel Blob or Firebase Storage", async () => {
    const path = `products/${farmer.uid}/up1/maize.jpg`;
    const images = [
      { path, url: `https://abc123.public.blob.vercel-storage.com/${path}` },
      { path, url: `https://firebasestorage.googleapis.com/v0/b/demo.appspot.com/o/${encodeURIComponent(path)}?alt=media&token=t` },
    ];
    expect(await codeOf(farmer.call("createProduct", { ...base, images }))).toBe("ok");
  });

  it("rejects another farmer's folder, external links and mismatched URLs", async () => {
    const own = `products/${farmer.uid}/up2/a.jpg`;
    const theirs = `products/${other.uid}/up2/a.jpg`;
    const cases = [
      { path: theirs, url: `https://abc.public.blob.vercel-storage.com/${theirs}` },
      { path: own, url: "https://example.com/a.jpg" },
      { path: own, url: `https://abc.public.blob.vercel-storage.com/${theirs}` },
      { path: own, url: `http://abc.public.blob.vercel-storage.com/${own}` },
    ];
    for (const img of cases) expect(await codeOf(farmer.call("createProduct", { ...base, images: [img] }))).toBe("invalid-argument");
  });
});
