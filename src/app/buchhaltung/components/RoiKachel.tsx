
"use client";
import { useState, useEffect } from "react";
import { Calculator } from "lucide-react";
import { Tile } from "./Tile";
import { AnalysisOverlay } from "@/components/ui/AnalysisOverlay";
import { getSparzaehlerAnalysisAction } from "@/app/buchhaltung/analysis.actions";

export function RoiKachel() {
  const [open, setOpen] = useState(false);
  const [evidenceState, setEvidenceState] = useState<"loading" | "not_evidenced" | "error">("loading");
  const [loadError, setLoadError] = useState<string | null>(null);
  const [retryToken, setRetryToken] = useState(0);

  useEffect(() => {
    const fetchEvidenceState = async () => {
      const now = new Date();
      const von = `${now.getFullYear()}-01-01`;
      const bis = `${now.getFullYear()}-12-31`;

      try {
        const result = await getSparzaehlerAnalysisAction(von, bis);
        setEvidenceState(result.state);
        setLoadError(null);
      } catch {
        setEvidenceState("error");
        setLoadError("Der Nachweisstatus konnte nicht geladen werden.");
      }
    };
    void fetchEvidenceState();
  }, [retryToken]);

  const emptyState = loadError
    ? {
        title: "Nachweisstatus nicht geladen",
        description: loadError,
        actionLabel: "Erneut laden",
        onAction: () => {
          setEvidenceState("loading");
          setLoadError(null);
          setRetryToken((value) => value + 1);
        },
      }
    : evidenceState === "not_evidenced"
      ? {
          title: "Zeitersparnis nicht belegt",
          description: "Es fehlen gespeicherte Verarbeitungs- oder Arbeitszeitbelege. OCR-Confidence allein ist kein Nachweis für Automatisierung oder eingesparte Kosten.",
          actionLabel: "Buchhaltung öffnen",
          actionHref: "/buchhaltung",
        }
      : {
          title: "Nachweisstatus wird geladen",
          description: "Die App prüft den gespeicherten Fachstatus. Bis dahin wird kein ROI ausgewiesen.",
        };

  return (
    <>
      <Tile
        title="ROI & Kennzahlen"
        description="Return on Investment (ROI) der App-Nutzung."
        icon={<Calculator className="w-5 h-5 text-indigo-600" strokeWidth={1.8} />}
        iconColor="bg-indigo-50"
        onClick={() => setOpen(true)}
        kpi={evidenceState === "loading" ? "..." : "nicht berechenbar"}
        footer="Return on Investment"
        analyseLink={{ label: "Details", href: "#", onClick: () => setOpen(true) }}
      />
      
      <AnalysisOverlay
        open={open}
        onClose={() => setOpen(false)}
        title="Profit of Invest"
        subtitle={loadError
          ?? (evidenceState === "not_evidenced"
            ? "Zeitersparnis ist nicht durch gespeicherte Arbeitszeitbelege nachgewiesen."
            : "Daten werden geprüft...")}
        isEmpty
        emptyState={emptyState}
      />
    </>
  );
}
