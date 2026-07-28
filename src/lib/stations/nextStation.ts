import {
  getNextOperationalProcessStation,
  normalizeOperationalProcessStation,
} from "@/lib/orders/processContract";

export function getNextStation(currentSlug: string): string | null {
  const currentStation = normalizeOperationalProcessStation(currentSlug);
  return currentStation ? getNextOperationalProcessStation(currentStation) : null;
}
