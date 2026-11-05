import { db } from "./admin";

/** Copies the farmer's public name and verification state onto their listings and open auctions. */
export async function syncFarmerOnListings(farmerId: string, fields: { farmerName?: string; farmerVerified?: boolean }): Promise<void> {
  const products = await db.collection("products").where("farmerId", "==", farmerId).get();
  const auctions = fields.farmerName
    ? await db.collection("auctions").where("farmerId", "==", farmerId).where("status", "in", ["draft", "scheduled", "live"]).get()
    : null;
  const writer = db.bulkWriter();
  products.docs.forEach((d) => writer.update(d.ref, fields));
  auctions?.docs.forEach((d) => writer.update(d.ref, { farmerName: fields.farmerName }));
  await writer.close();
}
