"use client";
import { useState, useEffect } from "react";
import { Fuel, Activity } from "lucide-react";
import { Tile } from "./Tile";
import { AnalysisOverlay } from "@/components/ui/AnalysisOverlay";
import { getAusgabenAnalysisAction } from "@/app/buchhaltung/analysis.actions";
import { getL7Daten } from "@/app/buchhaltung/actions";

type InsightAction = { label: string; href?: string };
type KraftstoffData = {
  gesamtKosten?: number;
  anzahlTankungen?: number;
  maxKosten?: number;
  chartData?: unknown[];
  insights?: {
    beobachtungen?: string[];
    vermutungen?: string[];
    vorschlaege?: InsightAction[];
  };
};
type L7Data = {
  affectedAccounts: { id: string; label: string }[];
  affectedCostCenters: { id: string; label: string }[];
  periodImpact: string;
  liquidityImpact: string;
  taxImpactEur: number;
};

export function KraftstoffKachel() {
  const [open, setOpen] = useState(false);
  const [data, setData] = useState<KraftstoffData | null>(null);
  const [l7Data, setL7Data] = useState<L7Data>();

  useEffect(() => {
    if (!open) return;
    if (!data) getAusgabenAnalysisAction("2026-06-01", "2026-06-30").then((result) => setData(result));
    if (!l7Data) getL7Daten({ kategorieId: "kraftstoff" }).then(setL7Data);
  }, [open, data, l7Data]);

  const props = !data ? { subtitle: "Daten werden live berechnet..." } : {
    icon: <Activity className="w-6 h-6" />,
    subtitle: "Tankkosten und Ausreißer",
    accentBg: "linear-gradient(180deg, var(--posbg), transparent)",
    tabs: [{ id: "gesamt", label: "Tankkosten Gesamt" }],
    
    hero: {
      kicker: "TANKKOSTEN DIESER MONAT",
      value: `${data.gesamtKosten?.toLocaleString("de-DE", { minimumFractionDigits: 2, maximumFractionDigits: 2 }) || 0} €`,
      changePill: { text: `${data.anzahlTankungen || 0} Tankungen`, variant: "teal" as const },
      meta: `Maximaler Tankwert: ${data.maxKosten?.toLocaleString("de-DE", { minimumFractionDigits: 2, maximumFractionDigits: 2 }) || 0} €`,
    },
    trend: { title: "Tankkosten Verlauf", chartType: "bar" as const, chartData: data.chartData || [] },
    insight: {
      body: (data.insights?.beobachtungen || []).map((b: string) => `<b>Beobachtung:</b> ${b}`).join('<br/>') + 
            ((data.insights?.vermutungen?.length || 0) > 0 ? '<br/><br/>' + (data.insights?.vermutungen || []).map((v: string) => `<b>Vermutung:</b> ${v}`).join('<br/>') : ''),
      actions: (data.insights?.vorschlaege || []).map((v: InsightAction) => ({ label: v.label, onClick: () => window.location.href = v.href as string }))
    },
    linkedAreas: [{ label: "Ausgaben nach Kategorie analysieren", href: "/buchhaltung/ausgaben" }],
    l7Data: l7Data
  };

  return (
    <>
      <Tile
        datenherkunft={{ belege: 142, rechnungen: 38, zeitbuchungen: 0, verbrauchsbuchungen: 0, periodeLabel: "06/2026", periodeStatus: "offen" }}
        title="Kraftstoff & Kfz"
        description="Diesel auf einen Blick: 18 Tankungen, Ø 1,71 €/l. Filterbar nach Ort & Zeit."
        icon={<Fuel className="w-5 h-5 text-blue-600" strokeWidth={1.8} />}
        iconColor="bg-blue-50"
        href="/buchhaltung/kraftstoff"
        kpi="1.240 €"
        footer="Auswertung"
      />
       
          <AnalysisOverlay open={open} onClose={() => setOpen(false)} title="Analyse: Kraftstoff" activeTab={"gesamt"} onTabChange={() => {}} {...props} />
    </>
  );
}
