import { FoundationUnavailable } from "@/components/foundation/FoundationUnavailable";

export default function LiveTestSession() {
  return (
    <FoundationUnavailable
      title="Live-Testaufzeichnung ist noch nicht freigegeben"
      reason="Bildschirm- und Klickaufzeichnungen besitzen derzeit keinen serverseitigen Mandanten-, Einwilligungs- und Aufbewahrungsvertrag."
    />
  );
}
