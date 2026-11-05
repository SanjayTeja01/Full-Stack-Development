import {
  collection,
  doc,
  getDoc,
  getDocs,
  limit,
  onSnapshot,
  orderBy,
  query,
  startAfter,
  where,
  type QueryConstraint,
  type QueryDocumentSnapshot,
  type DocumentData,
} from "firebase/firestore";
import { firebase } from "@/lib/firebase/client";
import type { Product } from "@shared/types";
import type { UnitId } from "@shared/units";
import { searchToken } from "@shared/search";

export type ProductSort = "newest" | "price_asc" | "price_desc";

export interface ProductFilters {
  q?: string;
  categoryId?: string;
  state?: string;
  district?: string;
  minPrice?: number | null; // paise per quintal (normalized)
  maxPrice?: number | null;
  minQuantity?: number | null; // kg
  grade?: string;
  harvestedAfter?: string;
  verifiedOnly?: boolean;
  sort?: ProductSort;
}

/**
 * Firestore runs the indexed part of the query (status, category, keyword, sort).
 * Filters that would need a composite index per combination (location, price range, quantity,
 * grade, harvest date, verification) are applied to each fetched page. See README "Search".
 */
function serverConstraints(f: ProductFilters): QueryConstraint[] {
  const c: QueryConstraint[] = [where("listingStatus", "==", "active")];
  if (f.categoryId) c.push(where("categoryId", "==", f.categoryId));
  const token = f.q ? searchToken(f.q) : null;
  if (token) c.push(where("keywords", "array-contains", token));
  if (f.sort === "price_asc") c.push(orderBy("normalizedPricePerQuintal", "asc"));
  else if (f.sort === "price_desc") c.push(orderBy("normalizedPricePerQuintal", "desc"));
  else c.push(orderBy("createdAt", "desc"));
  return c;
}

const UNIT_KG: Record<UnitId, number> = { kg: 1, quintal: 100, tonne: 1000 };

export function matchesClientFilters(p: Product, f: ProductFilters): boolean {
  if (f.state && p.location.state !== f.state) return false;
  if (f.district && !p.location.district.toLowerCase().includes(f.district.toLowerCase())) return false;
  if (f.minPrice != null && p.normalizedPricePerQuintal < f.minPrice) return false;
  if (f.maxPrice != null && p.normalizedPricePerQuintal > f.maxPrice) return false;
  if (f.minQuantity != null && p.availableQuantity * UNIT_KG[p.unit] < f.minQuantity) return false;
  if (f.grade && p.qualityGrade !== f.grade) return false;
  if (f.harvestedAfter && (!p.harvestDate || p.harvestDate < f.harvestedAfter)) return false;
  if (f.verifiedOnly && !p.farmerVerified) return false;
  if (f.q) {
    // Every additional word must also match; the first word was matched by the index.
    const words = f.q.toLowerCase().split(/\s+/).filter((w) => w.length >= 2).slice(1);
    if (!words.every((w) => p.keywords.includes(w.slice(0, 15)))) return false;
  }
  return true;
}

export interface ProductPage {
  items: Product[];
  cursor: QueryDocumentSnapshot<DocumentData> | null;
  exhausted: boolean;
}

/** Fetches until `pageSize` matching items are found or up to 5 raw batches have been scanned. */
export async function searchProducts(f: ProductFilters, cursor: QueryDocumentSnapshot<DocumentData> | null, pageSize = 24): Promise<ProductPage> {
  const { db } = firebase();
  const items: Product[] = [];
  let last = cursor;
  let exhausted = false;
  for (let batch = 0; batch < 5 && items.length < pageSize; batch++) {
    const constraints = [...serverConstraints(f), limit(48)];
    if (last) constraints.push(startAfter(last));
    const snap = await getDocs(query(collection(db, "products"), ...constraints));
    for (const d of snap.docs) {
      const p = d.data() as Product;
      if (matchesClientFilters(p, f)) items.push(p);
    }
    if (snap.docs.length) last = snap.docs[snap.docs.length - 1];
    if (snap.docs.length < 48) {
      exhausted = true;
      break;
    }
  }
  return { items, cursor: last, exhausted };
}

export function subscribeLatestProducts(count: number, cb: (items: Product[]) => void, onError: (e: Error) => void) {
  const q = query(collection(firebase().db, "products"), where("listingStatus", "==", "active"), orderBy("createdAt", "desc"), limit(count));
  return onSnapshot(q, (s) => cb(s.docs.map((d) => d.data() as Product)), onError);
}

export function subscribeProduct(id: string, cb: (p: Product | null) => void, onError: (e: Error) => void) {
  return onSnapshot(doc(firebase().db, "products", id), (s) => cb(s.exists() ? (s.data() as Product) : null), onError);
}

export async function getProduct(id: string): Promise<Product | null> {
  const s = await getDoc(doc(firebase().db, "products", id));
  return s.exists() ? (s.data() as Product) : null;
}

export function subscribeFarmerProducts(farmerId: string, cb: (items: Product[]) => void, onError: (e: Error) => void, publicOnly = false) {
  const constraints: QueryConstraint[] = [where("farmerId", "==", farmerId)];
  if (publicOnly) constraints.push(where("listingStatus", "in", ["active", "paused", "sold_out"]));
  constraints.push(orderBy("updatedAt", "desc"));
  return onSnapshot(query(collection(firebase().db, "products"), ...constraints), (s) => cb(s.docs.map((d) => d.data() as Product)), onError);
}
