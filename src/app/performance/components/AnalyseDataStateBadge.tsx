import type { AnalyseDataState } from "@/lib/analyse/dataContracts";

const LABELS: Record<Exclude<AnalyseDataState, "ready">, string> = {
  confirmed_empty: "BESTÄTIGT LEER",
  partial: "TEILWEISE",
  missing_input: "EINGABE FEHLT",
  not_configured: "NICHT EINGERICHTET",
  unavailable: "NICHT VERFÜGBAR",
};

export function AnalyseDataStateBadge({ state }: { state: AnalyseDataState }) {
  if (state === "ready") return null;

  return (
    <span className="t-pill bg-gray-200 text-gray-600">
      {LABELS[state]}
    </span>
  );
}
