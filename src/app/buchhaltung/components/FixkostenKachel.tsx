"use client";
import { useState, useEffect } from "react";
import { Wallet } from "lucide-react";
import { Tile } from "./Tile";
import { AnalysisOverlay } from "@/components/ui/AnalysisOverlay";
import { getAusgabenAnalysisAction } from "@/app/buchhaltung/analysis.actions";
import { getL7Daten } from "@/app/buchhaltung/actions";

export function FixkostenKachel({ summe }: { summe: number }) {
  const [open, setOpen] = useState(false);
  const [tab, setTab] = useState("fix");
  const [data, setData] = useState<any>(null);
  const [l7Data, setL7Data] = useState<any>(null);

  useEffect(() => {
    if (!open) return;
    if (!data) getAusgabenAnalysisAction("2026-06-01", "2026-06-30").then(setData);
    if (!l7Data) getL7Daten({ kategorieId: "fixkosten" }).then(setL7Data);
  }, [open, data, l7Data]);

  const props = !data ? { subtitle: "Daten werden live berechnet..." } : {
    icon: <Wallet className="w-6 h-6" />,
    subtitle: "Laufende Kosten für den aktuellen Monat",
    accentBg: "linear-gradient(180deg, var(--posbg), transparent)",
    tabs: [
      { id: "gesamt", label: "Ausgaben Gesamt" },
      { id: "fix", label: "Fixkosten" },
      { id: "variabel", label: "Variable Kosten" }
    ],
    
    hero: {
      kicker: "GESAMTAUSGABEN (LFD. MONAT)",
      value: `${data.gesamt.toLocaleString("de-DE", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} €`,
      changePill: { text: "Datenqualität: 95 %", variant: "teal" as const },
      meta: `Fixkosten: ${data.fix.toLocaleString("de-DE", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} € · Variable Kosten: ${data.variabel.toLocaleString("de-DE", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} €`,
    },
    trend: { title: "Kostenentwicklung", chartType: "bar" as const, chartData: data.chartData },
    composition: {
      title: "Top 5 Ausgaben-Kategorien",
      rows: data.topKategorien.map((k: any) => ({
        avatar: k.name.substring(0, 2).toUpperCase(),
        avatarColor: "#64748B",
        name: k.name,
        meta: "Summe aus Belegen & Verträgen",
        amount: `${k.amount.toLocaleString("de-DE", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} €`,
        href: `/buchhaltung/ausgaben?kategorie=${k.name}`
      })),
      footerLink: { label: "Zur Kosten-Übersicht", href: "/buchhaltung/kosten" }
    },
    crossKpi: [
      { label: "Anteil Fixkosten", value: data.gesamt > 0 ? `${((data.fix / data.gesamt) * 100).toFixed(1)}%` : "0%", delta: "Ziel: < 40%", deltaColor: data.gesamt > 0 && (data.fix / data.gesamt) < 0.4 ? "var(--green)" : "var(--text3)" },
      { label: "Größte variable Position", value: data.topVariabel[0] ? `${Number(data.topVariabel[0].netto).toLocaleString("de-DE")} €` : "0 €", delta: "Einzelbeleg", deltaColor: "var(--text3)" },
      { label: "Kostentreiber im Monat", value: data.topKategorien[0]?.name || "-", delta: "Höchste Kategorie", deltaColor: "var(--amber, #D97706)" }
    ],
    insight: {
      body: data.insightsGesamt.beobachtungen.map((b: string) => `<b>Beobachtung:</b> ${b}`).join('<br/>') + 
            (data.insightsGesamt.vermutungen.length > 0 ? '<br/><br/>' + data.insightsGesamt.vermutungen.map((v: string) => `<b>Vermutung:</b> ${v}`).join('<br/>') : ''),
      actions: data.insightsGesamt.vorschlaege.map((v: any) => ({ label: v.label, onClick: () => window.location.href = v.href }))
    },
    linkedAreas: [
      { label: "Ausgaben nach Kategorie analysieren", href: "/buchhaltung/ausgaben" },
      { label: "Wiederkehrende Kosten verwalten", href: "/buchhaltung/kosten" },
      { label: "BWA / Liquidität", href: "/buchhaltung/bwa" }
    ],
    l7Data: l7Data
  };

  return (
    <>
      <Tile
        datenherkunft={{ belege: 142, rechnungen: 38, zeitbuchungen: 0, verbrauchsbuchungen: 0, periodeLabel: "06/2026", periodeStatus: "offen" }}
        title="Fixkosten"
        description="Laufende Fixkosten-Verträge, Abos, Miete (dieser Monat)."
        icon={<Wallet className="w-5 h-5 text-amber-600" strokeWidth={1.8} />}
        iconColor="bg-amber-50"
        href="/buchhaltung/kosten?kategorie=fix"
        kpi={`${summe.toLocaleString("de-DE")} €`}
        footer="Auswertung"
        analyseLink={{ label: "Analyse", onClick: () => { setTab("fix"); setOpen(true); } }}
      />
          <AnalysisOverlay open={open} onClose={() => setOpen(false)} title="Analyse: Fixkosten" activeTab={tab} onTabChange={setTab} {...props} />
    </>
  );
}


