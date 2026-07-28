import { FoundationUnavailable } from "@/components/foundation/FoundationUnavailable";

export default function PerformanceLayout({ children: _children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <FoundationUnavailable
      title="Performance-Auswertung ist noch nicht freigegeben"
      reason="Auch die Detailansichten enthalten feste historische Verläufe, Auslastungen und Empfehlungen ohne belegte Quelle. Sie bleiben bis zum vollständigen Kennzahlen- und Evidenzvertrag gesperrt."
    />
  );
}
