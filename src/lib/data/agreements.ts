import { collection, doc, limit, onSnapshot, orderBy, query, where } from "firebase/firestore";
import { firebase } from "@/lib/firebase/client";
import type { Agreement } from "@shared/types";

export function subscribeMyAgreements(uid: string, cb: (a: Agreement[]) => void, onError: (e: Error) => void) {
  const q = query(collection(firebase().db, "agreements"), where("participantIds", "array-contains", uid), orderBy("createdAt", "desc"), limit(200));
  return onSnapshot(q, (s) => cb(s.docs.map((d) => d.data() as Agreement)), onError);
}

export function subscribeAgreement(id: string, cb: (a: Agreement | null) => void, onError: (e: Error) => void) {
  return onSnapshot(doc(firebase().db, "agreements", id), (s) => cb(s.exists() ? (s.data() as Agreement) : null), onError);
}

export interface CounterpartyContact {
  userId: string;
  role: string;
  displayName: string;
  organizationName: string | null;
  district: string;
  state: string;
  phone: string | null;
  email: string | null;
  whatsappEnabled: boolean;
}
