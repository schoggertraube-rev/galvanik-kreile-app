import { FoundationUnavailable } from "@/components/foundation/FoundationUnavailable";

export default function ScanPage() {
  return (
    <FoundationUnavailable
      title="Scan-Erfassung nicht freigegeben"
      reason="Upload, OCR und Zuordnung werden erst wieder aktiviert, wenn private Originale, serverseitige Rollenprüfung, Tenant-Ableitung und persistente Receipts gemeinsam belegt sind. Es wird kein lokaler oder angeblicher KI-Erfolg gezeigt."
      returnHref="/"
      returnLabel="Zur Startseite"
    />
  );
}
