const FLOW = ["wareneingang", "entmetallisierung", "schleiferei", "beschichtung", "warenausgang"] as const;

export function getNextStation(currentSlug: string): string | null {
  const idx = FLOW.indexOf(currentSlug as typeof FLOW[number]);
  if (idx === -1 || idx === FLOW.length - 1) return null;
  return FLOW[idx + 1];
}
