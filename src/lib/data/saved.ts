"use client";

import * as React from "react";
import { collection, deleteDoc, doc, onSnapshot, orderBy, query, serverTimestamp, setDoc } from "firebase/firestore";
import { firebase } from "@/lib/firebase/client";
import type { Ts } from "@shared/types";

export interface SavedProduct {
  productId: string;
  productName: string;
  savedAt: Ts;
}
export interface SavedFarmer {
  farmerId: string;
  farmerName: string;
  savedAt: Ts;
}

export function saveProduct(uid: string, productId: string, productName: string) {
  return setDoc(doc(firebase().db, "users", uid, "savedProducts", productId), { productId, productName: productName.slice(0, 120), savedAt: serverTimestamp() });
}
export function unsaveProduct(uid: string, productId: string) {
  return deleteDoc(doc(firebase().db, "users", uid, "savedProducts", productId));
}
export function saveFarmer(uid: string, farmerId: string, farmerName: string) {
  return setDoc(doc(firebase().db, "users", uid, "savedFarmers", farmerId), { farmerId, farmerName: farmerName.slice(0, 120), savedAt: serverTimestamp() });
}
export function unsaveFarmer(uid: string, farmerId: string) {
  return deleteDoc(doc(firebase().db, "users", uid, "savedFarmers", farmerId));
}

export function useSaved<T>(uid: string | undefined, kind: "savedProducts" | "savedFarmers") {
  const [items, setItems] = React.useState<T[] | null>(null);
  const [error, setError] = React.useState<string | null>(null);
  React.useEffect(() => {
    if (!uid) return;
    return onSnapshot(
      query(collection(firebase().db, "users", uid, kind), orderBy("savedAt", "desc")),
      (s) => setItems(s.docs.map((d) => d.data() as T)),
      (e) => setError(e.message),
    );
  }, [uid, kind]);
  return { items, error };
}

export function useIsSaved(uid: string | undefined, kind: "savedProducts" | "savedFarmers", id: string) {
  const [saved, setSaved] = React.useState(false);
  React.useEffect(() => {
    if (!uid) return;
    return onSnapshot(
      doc(firebase().db, "users", uid, kind, id),
      (s) => setSaved(s.exists()),
      () => setSaved(false),
    );
  }, [uid, kind, id]);
  return uid ? saved : false;
}
