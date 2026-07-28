import { FoundationUnavailable } from "@/components/foundation/FoundationUnavailable";

/**
 * Finance is a single capability boundary, not a collection of independent
 * dashboards. Until its records have an enforceable tenant/ownership contract,
 * every nested route must fail closed as well.
 */
export default function BuchhaltungLayout({ children: _children }: { children: React.ReactNode }) {
void _children;
  return (
    <FoundationUnavailable
      title="Buchhaltung ist noch nicht freigegeben"
      reason="Belege, Rechnungen, Exporte und Kennzahlen besitzen aktuell keinen durchgängig belegten Mandanten- und Berechtigungsvertrag. Deshalb werden weder Finanzdaten noch Erfolgsmeldungen oder Exportzustände angezeigt."
    />
  );
}
