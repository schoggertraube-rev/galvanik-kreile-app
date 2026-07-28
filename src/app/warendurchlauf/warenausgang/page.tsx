import { FoundationUnavailable } from "@/components/foundation/FoundationUnavailable";

export default function WarenausgangPage() {
  return (
    <FoundationUnavailable
      title="Warenausgang ist noch nicht freigegeben"
      reason="Versand, Zahlungsstatus, Terminal und Rechnungsversand besitzen derzeit keinen gemeinsam belegten Daten- und Receipt-Vertrag. Die App zeigt deshalb keinen Zahlungs- oder Versandstatus an."
    />
  );
}
