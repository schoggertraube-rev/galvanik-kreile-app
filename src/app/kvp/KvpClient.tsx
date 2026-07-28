"use client";

import { FoundationUnavailable } from "@/components/foundation/FoundationUnavailable";

/**
 * Historical KVP state lived only in browser storage and mixed it with demo
 * measures. Keep the public component name, but never present that state as
 * a product workflow.
 */
export function KvpClient() {
  return (
    <FoundationUnavailable
      title="KVP ist noch nicht freigegeben"
      reason="Maßnahmen, Fortschritt und Freigaben brauchen einen belegten Daten- und Berechtigungsvertrag."
    />
  );
}
