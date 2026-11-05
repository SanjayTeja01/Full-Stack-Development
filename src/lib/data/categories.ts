"use client";

import * as React from "react";
import { collection, onSnapshot, orderBy, query } from "firebase/firestore";
import { firebase } from "@/lib/firebase/client";
import type { Category } from "@shared/types";

let cache: Category[] | null = null;

/** Categories are administered in Firestore; nothing in the UI hardcodes the list. */
export function useCategories(includeInactive = false) {
  const [categories, setCategories] = React.useState<Category[] | null>(cache);
  const [error, setError] = React.useState<string | null>(null);
  React.useEffect(() => {
    const q = query(collection(firebase().db, "categories"), orderBy("sortOrder"));
    return onSnapshot(
      q,
      (snap) => {
        cache = snap.docs.map((d) => d.data() as Category);
        setCategories(cache);
      },
      (e) => setError(e.message),
    );
  }, []);
  const visible = React.useMemo(
    () => (categories ? categories.filter((c) => includeInactive || c.active) : null),
    [categories, includeInactive],
  );
  const byId = React.useMemo(() => new Map((categories ?? []).map((c) => [c.id, c])), [categories]);
  return { categories: visible, byId, error, loading: categories === null && !error };
}
