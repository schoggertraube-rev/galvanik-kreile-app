import { FoundationUnavailable } from "@/components/foundation/FoundationUnavailable";

export default function MarketingLayout({ children: _children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <FoundationUnavailable
      title="Marketing ist noch nicht freigegeben"
      reason="Unterseiten dürfen erst sichtbar werden, wenn ihre Datenquellen, Einwilligungen und Ausführungswege nachweisbar vorhanden sind."
    />
  );
}
