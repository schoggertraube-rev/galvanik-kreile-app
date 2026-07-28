import { FoundationUnavailable } from "@/components/foundation/FoundationUnavailable";

export default function SettingsPage() {
  return (
    <FoundationUnavailable
      title="Einstellungen sind noch nicht freigegeben"
      reason="Die bisherige Konsole verband Benutzer-, Rollen-, Diagnose- und Datenbankfunktionen ohne vollständig belegte Mandanten- und Auditgrenzen. Bis diese Verträge geprüft sind, werden keine Verwaltungs- oder Schreibtest-Aktionen angeboten."
    />
  );
}
