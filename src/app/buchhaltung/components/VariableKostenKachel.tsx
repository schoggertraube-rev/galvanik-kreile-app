"use client";
import { useState, useEffect } from "react";
import { PieChart } from "lucide-react";
import { Tile } from "./Tile";
import { AnalysisOverlay } from "@/components/ui/AnalysisOverlay";
import { getAusgabenAnalysisAction } from "@/app/buchhaltung/analysis.actions";
import { getL7Daten } from "@/app/buchhaltung/actions";

type AusgabenData = Awaited<ReturnType<typeof getAusgabenAnalysisAction>>;
type L7Data = {
  affectedAccounts: { id: string; label: string }[];
  affectedCostCenters: { id: string; label: string }[];
  periodImpact: string;
  liquidityImpact: string;
  taxImpactEur: number;
};
type InsightAction = { label: string; href?: string };

export function VariableKostenKachel({ summe }: { summe: number }) {
  const [open, setOpen] = useState(false);
  const [tab, setTab] = useState("variabel");
  const [data, setData] = useState<AusgabenData | null>(null);
  const [l7Data, setL7Data] = useState<L7Data>();

  useEffect(() => {
    if (!open) return;
    if (!data) getAusgabenAnalysisAction("2026-06-01", "2026-06-30").then(setData);
    if (!l7Data) getL7Daten({ kategorieId: "variable_kosten" }).then(setL7Data);
  }, [open, data, l7Data]);

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
      actions: data.insightsGesamt.vorschlaege.map((v: InsightAction) => ({ label: v.label, onClick: () => window.location.href = v.href as string }))
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
          <AnalysisOverlay open={open} onClose={() => setOpen(false)} title="Analyse: Variable Kosten" activeTab={tab} onTabChange={setTab} l7Data={l7Data} {...props} />
    </>
  );
}
