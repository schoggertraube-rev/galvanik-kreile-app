/* eslint-disable @typescript-eslint/no-explicit-any */
"use client";
import { useState, useEffect } from "react";
import { PieChart } from "lucide-react";
import { Tile } from "./Tile";
import { AnalysisOverlay } from "@/components/ui/AnalysisOverlay";
import { getAusgabenAnalysisAction } from "@/app/buchhaltung/analysis.actions";

export function VariableKostenKachel({ summe }: { summe: number }) {
  const [open, setOpen] = useState(false);
  const [tab, setTab] = useState("variabel");
  const [data, setData] = useState<any>(null);

  useEffect(() => {
    if (!open || data) return;
    getAusgabenAnalysisAction("2026-06-01", "2026-06-30").then(setData);
  }, [open, data]);

  const props = !data ? { subtitle: "Daten werden live berechnet..." } : {
    // same props block as Fixkosten
    icon: <PieChart className="w-6 h-6" />,
    subtitle: "Laufende Kosten für den aktuellen Monat",
    accentBg: "linear-gradient(180deg, var(--posbg), transparent)",
    tabs: [{ id: "gesamt", label: "Ausgaben Gesamt" }, { id: "fix", label: "Fixkosten" }, { id: "variabel", label: "Variable Kosten" }],
    
    hero: {
      kicker: "GESAMTAUSGABEN",
      value: `${data.gesamt.toLocaleString("de-DE", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} €`,
      changePill: { text: "Datenqualität: 95 %", variant: "teal" as const },
      meta: `Fixkosten: ${data.fix.toLocaleString("de-DE", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} € · Variable Kosten: ${data.variabel.toLocaleString("de-DE", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} €`,
    },
    trend: { title: "Kostenentwicklung", chartType: "bar" as const, chartData: data.chartData },
    insight: {
      body: data.insightsGesamt.beobachtungen.map((b: string) => `<b>Beobachtung:</b> ${b}`).join('<br/>'),
      actions: data.insightsGesamt.vorschlaege.map((v: any) => ({ label: v.label, onClick: () => window.location.href = v.href }))
    },
    linkedAreas: [{ label: "Ausgaben nach Kategorie analysieren", href: "/buchhaltung/ausgaben" }]
  };

  return (
    <>
      <Tile
        datenherkunft={{ belege: 142, rechnungen: 38, zeitbuchungen: 0, verbrauchsbuchungen: 0, periodeLabel: "06/2026", periodeStatus: "offen" }}
        title="Variable Kosten"
        description="Laufende Ausgaben & Belege des Monats nach Kategorie."
        icon={<PieChart className="w-5 h-5 text-emerald-600" strokeWidth={1.8} />}
        iconColor="bg-emerald-50"
        href="/buchhaltung/ausgaben"
        kpi={`${summe.toLocaleString("de-DE")} €`}
        footer="Auswertung"
        analyseLink={{ label: "Analyse", onClick: () => { setTab("variabel"); setOpen(true); } }}
      />
          <AnalysisOverlay open={open} onClose={() => setOpen(false)} title="Analyse: Variable Kosten" activeTab={tab} onTabChange={setTab} {...props} />
    </>
  );
}



