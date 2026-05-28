// src/lib/search/recent.ts
// Letzte 10 Sucheingaben per Nutzer (localStorage)

const STORAGE_KEY = "kreile_recent_searches";
const MAX_ENTRIES = 10;

export function getRecentSearches(): string[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

export function addRecentSearch(term: string): void {
  if (typeof window === "undefined") return;
  const trimmed = term.trim();
  if (!trimmed || trimmed.length < 2) return;
  try {
    const existing = getRecentSearches().filter((s) => s !== trimmed);
    const updated = [trimmed, ...existing].slice(0, MAX_ENTRIES);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
  } catch {
    // ignore
  }
}

export function clearRecentSearches(): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.removeItem(STORAGE_KEY);
  } catch {
    // ignore
  }
}
