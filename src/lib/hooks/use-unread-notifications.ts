"use client";

import * as React from "react";
import { collection, limit, onSnapshot, query, where } from "firebase/firestore";
import { firebase } from "@/lib/firebase/client";

/** Live count of unread notifications for the signed-in user (capped at 99). */
export function useUnreadNotificationCount(uid: string | null | undefined): number {
  const [count, setCount] = React.useState(0);
  React.useEffect(() => {
    if (!uid) return;
    const q = query(collection(firebase().db, "notifications"), where("recipientId", "==", uid), where("readAt", "==", null), limit(99));
    return onSnapshot(
      q,
      (snap) => setCount(snap.size),
      () => setCount(0),
    );
  }, [uid]);
  return uid ? count : 0;
}
