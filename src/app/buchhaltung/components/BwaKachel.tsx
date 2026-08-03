"use client";
import { useState, useEffect } from "react";
import { TrendingUp } from "lucide-react";
import { Tile } from "./Tile";
import { AnalysisOverlay } from "@/components/ui/AnalysisOverlay";
import { getBwaAnalysisAction } from "@/app/buchhaltung/analysis.actions";
import { getL7Daten } from "@/app/buchhaltung/actions";

type BwaData = Awaited<ReturnType<typeof getBwaAnalysisAction>>;
type L7Data = {
  affectedAccounts: { id: string; label: string }[];
  affectedCostCenters: { id: string; label: string }[];
  periodImpact: string;
  liquidityImpact: string;
  taxImpactEur: number;
};
type InsightAction = { label: string; href?: string };

export function BwaKachel() {
  const [open, setOpen] = useState(false);
  const [data, setData] = useState<BwaData | null>(null);
  const [l7Data, setL7Data] = useState<L7Data>();

  useEffect(() => {
    if (!open) return;
    if (!data) {
      const now = new Date();
      getBwaAnalysisAction(`${now.getFullYear()}-01-01`, `${now.getFullYear()}-12-31`).then(setData);
    }
    if (!l7Data) getL7Daten({}).then(setL7Data);
  }, [open, data, l7Data]);

  const props = !data ? { subtitle: "Daten werden live berechnet..." } : {
    icon: <TrendingUp className="w-6 h-6" />,
    datenherkunft: { belege: 142, rechnungen: 38, zeitbuchungen: 0, verbrauchsbuchungen: 0, periodeLabel: "06/2026", periodeStatus: "offen" },
    subtitle: "Betriebswirtschaftliche Auswertung",
    accentBg: "linear-gradient(180deg, var(--posbg), transparent)",
    tabs: [{ id: "gesamt", label: "Betriebsergebnis" }],
    
    hero: {
      kicker: "BETRIEBSERGEBNIS",
      value: `${data.betriebsergebnis?.toLocaleString("de-DE", { minimumFractionDigits: 2, maximumFractionDigits: 2 }) || 0} €`,
      changePill: { text: `Einnahmen: ${data.einnahmen?.toLocaleString("de-DE", { minimumFractionDigits: 2, maximumFractionDigits: 2 }) || 0} €`, variant: "teal" as const },
      meta: `Ausgaben: ${data.ausgabenGesamt?.toLocaleString("de-DE", { minimumFractionDigits: 2, maximumFractionDigits: 2 }) || 0} €`,
    },
    trend: { title: "Ergebnis Verlauf", chartType: "bar" as const, chartData: data.chartData || [] },
    insight: {
      body: (data.insights?.beobachtungen || []).map((b: string) => `<b>Beobachtung:</b> ${b}`).join('<br/>') + 
            ((data.insights?.vermutungen?.length || 0) > 0 ? '<br/><br/>' + data.insights.vermutungen.map((v: string) => `<b>Vermutung:</b> ${v}`).join('<br/>') : ''),
      actions: (data.insights?.vorschlaege || []).map((v: InsightAction) => ({ label: v.label, onClick: () => window.location.href = v.href as string }))
    },
    linkedAreas: [{ label: "Umsätze ansehen", href: "/performance/umsatz-marge" }],
    l7Data: l7Data
  };

  return (
    <>
      <Tile
        title="BWA / Monatsübersicht"
        description="Betriebswirtschaftliche Auswertung. Einnahmen, Ausgaben, Ergebnis."
        icon={<TrendingUp className="w-5 h-5 text-teal-600" strokeWidth={1.8} />}
        iconColor="bg-teal-50"
        href="/buchhaltung/bwa"
        kpi="+19.200 €"
        footer="Details"
        analyseLink={{ label: "Analyse", onClick: () => setOpen(true) }}
      />
       
          <AnalysisOverlay open={open} onClose={() => setOpen(false)} title="Analyse: BWA" activeTab={"gesamt"} onTabChange={() => {}} {...props} />
    </>
  );
}
