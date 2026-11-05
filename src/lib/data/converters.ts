import type { DocumentData, QueryDocumentSnapshot, DocumentSnapshot } from "firebase/firestore";

/** Firestore documents carry their id in a field as well; this keeps typing in one place. */
export function fromSnap<T>(snap: QueryDocumentSnapshot<DocumentData> | DocumentSnapshot<DocumentData>): T {
  return snap.data() as T;
}
