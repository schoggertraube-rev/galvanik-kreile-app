import { FoundationUnavailable } from "@/components/foundation/FoundationUnavailable";

export default function JahresplanPage() {
  return (
    <FoundationUnavailable
      title="Jahresplan nicht freigegeben"
      reason="Der Jahresplan ist noch nicht an einen tenant- und rollenbelegten Finanzvertrag gebunden. Es werden keine Planwerte gelesen oder geschrieben."
      returnHref="/cockpit"
      returnLabel="Zum Cockpit"
    />
  );
}
