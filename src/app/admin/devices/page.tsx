import { FoundationUnavailable } from "@/components/foundation/FoundationUnavailable";

export default function AdminDevicesPage() {
  return (
    <FoundationUnavailable
      title="Geräte- und Sitzungsverwaltung ist noch nicht freigegeben"
      reason="Die bisherige Ansicht zeigte feste Geräte und lokale Freigabe- oder Sperraktionen ohne einen belegten Sitzungs- und Gerätevertrag."
    />
  );
}
