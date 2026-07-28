import { FoundationUnavailable } from "@/components/foundation/FoundationUnavailable";

export default function SuppliersLayout({ children: _children }: { children: React.ReactNode }) {
  return (
    <FoundationUnavailable
      title="Lieferantenverwaltung ist noch nicht freigegeben"
      reason="Stammdaten und Belege besitzen hier keinen belegten gemeinsamen Datenvertrag. Leere Platzhalter werden deshalb nicht als fehlende Lieferanten- oder Belegdaten ausgegeben."
    />
  );
}
