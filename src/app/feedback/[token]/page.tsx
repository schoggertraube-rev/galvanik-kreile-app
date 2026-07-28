import { FoundationUnavailable } from "@/components/foundation/FoundationUnavailable";

export default function FeedbackPage() {
  return (
    <FoundationUnavailable
      title="Kundenfeedback ist noch nicht freigegeben"
      reason="Die frühere Seite bestätigte eine Übermittlung, ohne die Bewertung tokengebunden und dauerhaft zu speichern. Deshalb wird keine Erfolgsmeldung simuliert."
      returnHref="/"
      returnLabel="Zur Startseite"
    />
  );
}
