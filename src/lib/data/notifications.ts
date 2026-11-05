import { collection, doc, getDocs, limit, onSnapshot, orderBy, query, serverTimestamp, updateDoc, where, writeBatch } from "firebase/firestore";
import { firebase } from "@/lib/firebase/client";
import type { AppNotification } from "@shared/types";

export function subscribeNotifications(uid: string, max: number, cb: (n: AppNotification[]) => void, onError: (e: Error) => void) {
  const q = query(collection(firebase().db, "notifications"), where("recipientId", "==", uid), orderBy("createdAt", "desc"), limit(max));
  return onSnapshot(q, (s) => cb(s.docs.map((d) => d.data() as AppNotification)), onError);
}

export function markNotificationRead(id: string) {
  return updateDoc(doc(firebase().db, "notifications", id), { readAt: serverTimestamp() });
}

/** Marks every unread notification as read, in batches. */
export async function markAllNotificationsRead(uid: string): Promise<number> {
  const { db } = firebase();
  let total = 0;
  for (;;) {
    const snap = await getDocs(query(collection(db, "notifications"), where("recipientId", "==", uid), where("readAt", "==", null), limit(400)));
    if (snap.empty) return total;
    const batch = writeBatch(db);
    snap.docs.forEach((d) => batch.update(d.ref, { readAt: serverTimestamp() }));
    await batch.commit();
    total += snap.size;
    if (snap.size < 400) return total;
  }
}
