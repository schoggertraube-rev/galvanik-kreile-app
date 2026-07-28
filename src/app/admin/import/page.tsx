import { FoundationUnavailable } from "@/components/foundation/FoundationUnavailable";
import { requireAdminOrDeveloper } from "@/lib/auth/permissions";

export default async function AdminImportPage() {
  await requireAdminOrDeveloper();

  return (
    <FoundationUnavailable
      title="Administrativer Import ist noch nicht freigegeben"
      reason="Die bisherige Oberfläche stellte Cloud-OCR, KI-Auswertung und Datenbankimport als aktiv dar, obwohl kein belegter Ausführungsweg vorhanden war."
    />
  );
}
