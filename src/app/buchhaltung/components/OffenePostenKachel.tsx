"use client";
import { useState, useEffect } from "react";
import { AlertCircle } from "lucide-react";
import { Tile } from "./Tile";
import { AnalysisOverlay } from "@/components/ui/AnalysisOverlay";
import { getOffenePostenAnalysisAction } from "@/app/buchhaltung/analysis.actions";
import { getL7Daten } from "@/app/buchhaltung/actions";

export function OffenePostenKachel() {
  const [open, setOpen] = useState(false);
  const [tab, setTab] = useState("gesamt");
  const [data, setData] = useState<any>(null);
  const [l7Data, setL7Data] = useState<any>(null);

  useEffect(() => {
    if (!open) return;
    if (!data) {
      const now = new Date();
      getOffenePostenAnalysisAction(`${now.getFullYear()}-01-01`, `${now.getFullYear()}-12-31`).then(setData);
    }
    if (!l7Data) getL7Daten({ belegart: "ausgangsrechnung" }).then(setL7Data);
  }, [open, data, l7Data]);

  const props = !data ? { subtitle: "Daten werden live berechnet..." } : {
    icon: <AlertCircle className="w-6 h-6" />,
    subtitle: "Unbezahlte und überfällige Rechnungen",
    accentBg: "linear-gradient(180deg, var(--posbg), transparent)",
    tabs: [{ id: "gesamt", label: "Gesamtrückstände" }, { id: "ueberfaellig", label: "Überfällig" }],
    
    hero: {
      kicker: "OFFENE SUMME GESAMT",
      value: `${data.offeneSumme?.toLocaleString("de-DE", { minimumFractionDigits: 2, maximumFractionDigits: 2 }) || 0} €`,
      changePill: { text: `${data.offeneCount || 0} Rechnungen`, variant: "teal" as const },
      meta: `Überfällig: ${data.ueberfaelligSumme?.toLocaleString("de-DE", { minimumFractionDigits: 2, maximumFractionDigits: 2 }) || 0} € (${data.ueberfaelligCount || 0} Stk)`,
    },
    trend: { title: "Rückstände Verlauf", chartType: "bar" as const, chartData: data.chartData || [] },
    insight: {
      body: (data.insights?.beobachtungen || []).map((b: string) => `<b>Beobachtung:</b> ${b}`).join('<br/>') + 
            ((data.insights?.vermutungen?.length || 0) > 0 ? '<br/><br/>' + data.insights.vermutungen.map((v: string) => `<b>Vermutung:</b> ${v}`).join('<br/>') : ''),
      actions: (data.insights?.vorschlaege || []).map((v: any) => ({ label: v.label, onClick: () => window.location.href = v.href }))
    },
    linkedAreas: [{ label: "Rechnungen verwalten", href: "/buchhaltung/rechnungen" }],
    l7Data: l7Data
  };

  return (
    <>
      <Tile
        datenherkunft={{ belege: 142, rechnungen: 38, zeitbuchungen: 0, verbrauchsbuchungen: 0, periodeLabel: "06/2026", periodeStatus: "offen" }}
        title="Offene Posten"
        description="3 Zahlungen überfällig. Mahnstufen & Zahlungserinnerung automatisch."
        icon={<AlertCircle className="w-5 h-5 text-red-500" strokeWidth={1.8} />}
        iconColor="bg-red-50"
        href="/buchhaltung/rechnungen?filter=offen"
        kpi="12.450 €"
        status={{ label: "3 überfällig", variant: "action" }}
        footer="Details"
      />
          <AnalysisOverlay open={open} onClose={() => setOpen(false)} title="Analyse: Offene Posten" activeTab={tab} onTabChange={setTab} {...props} />
    </>
  );
}


