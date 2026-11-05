/** Builds lower-case tokens and prefixes for Firestore `array-contains` keyword search. */
export function normalizeSearchText(text: string): string {
  return text
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[^\p{L}\p{N}\s]/gu, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export function buildSearchKeywords(...parts: (string | undefined | null)[]): string[] {
  const words = new Set<string>();
  for (const part of parts) {
    if (!part) continue;
    for (const word of normalizeSearchText(part).split(" ")) {
      if (word.length < 2) continue;
      for (let i = 2; i <= Math.min(word.length, 15); i++) words.add(word.slice(0, i));
    }
  }
  return Array.from(words).slice(0, 100);
}

/** The single token used to query: the first word of the search, capped to the indexed prefix length. */
export function searchToken(query: string): string | null {
  const first = normalizeSearchText(query).split(" ").find((w) => w.length >= 2);
  return first ? first.slice(0, 15) : null;
}
