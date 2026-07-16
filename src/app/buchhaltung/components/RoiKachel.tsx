
"use client";
import { useState, useEffect } from "react";
import { Calculator } from "lucide-react";
import { Tile } from "./Tile";
import { AnalysisOverlay } from "@/components/ui/AnalysisOverlay";
import { getSparzaehlerAnalysisAction } from "@/app/buchhaltung/analysis.actions";
import { getL7Daten } from "@/app/buchhaltung/actions";

type RoiData = {
  invest: null;
  returnVal: number;
  roi: null;
  payback: null;
  ersparnisBetrag: number;
  anzahlBelege: number;
  periodLabel: string;
};

type L7Data = Awaited<ReturnType<typeof getL7Daten>>;

export function RoiKachel() {
  const [open, setOpen] = useState(false);
  const [data, setData] = useState<RoiData | null>(null);
  const [l7Data, setL7Data] = useState<L7Data | null>(null);

  useEffect(() => {
    if (!open || l7Data) return;
    void getL7Daten({}).then(setL7Data);
  }, [open, l7Data]);

  useEffect(() => {
    if (data) return;
    const fetchRoi = async () => {
      const now = new Date();
      const von = `${now.getFullYear()}-01-01`;
      const bis = `${now.getFullYear()}-12-31`;
      
      const spar = await getSparzaehlerAnalysisAction(von, bis);
      setData({
        invest: null,
        returnVal: spar.ersparnisBetrag,
        roi: null,
        payback: null,
        ersparnisBetrag: spar.ersparnisBetrag,
        anzahlBelege: spar.anzahlGesamt,
        periodLabel: String(now.getFullYear()),
      });
    };
    void fetchRoi();
  }, [data]);

  const kpi = data ? "nicht berechenbar" : "...";

  const props = !data ? { subtitle: "Daten werden live berechnet..." } : {
    icon: <Calculator className="w-6 h-6" />,
    subtitle: "Profit of Invest (ROI)",
    accentBg: "linear-gradient(180deg, var(--posbg), transparent)",
    tabs: [{ id: "gesamt", label: "Investition & Return" }],
    
    hero: {
      kicker: "ROI-DATENQUALITÄT",
      value: "nicht berechenbar",
      changePill: { text: `Nachgewiesene Zeitersparnis: ${data.returnVal.toLocaleString("de-DE", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} €`, variant: "teal" as const },
      meta: "Für einen ROI fehlen gespeicherte Lizenz-, Einrichtungs- und Betriebskosten der App.",
    },
    
    crossKpis: [
      { label: "Ersparnis (Zeit)", value: `${data.ersparnisBetrag.toLocaleString("de-DE", { maximumFractionDigits: 0 })} €`, info: "Buchhaltungsautomatisierung" },
      { label: "Datenbasis", value: `${data.anzahlBelege} Belege`, info: "Nicht stornierte Belege im Zeitraum" },
      { label: "Investitionsbasis", value: "fehlt", info: "Noch keine belastbar gespeicherten App-Kosten" }
    ],
    
    insight: {
      body: "Ein ROI wird erst ausgewiesen, wenn App-Kosten und nachgewiesener Nutzen in derselben Periode vollständig vorliegen. Bis dahin zeigt die Kachel ausschließlich die aus echten OCR-Belegen und konfigurierten Zeitwerten berechnete Ersparnis."
    },
    
    linkedAreas: [
      { label: "Sparzähler", href: "/buchhaltung" },
      { label: "Marketing & Performance", href: "/marketing" },
      { label: "App-Einstellungen", href: "/einstellungen" }
    ],
    l7Data: l7Data ?? undefined
  };

  return (
    <>
      <Tile
        datenherkunft={{ belege: data?.anzahlBelege || 0, rechnungen: 0, zeitbuchungen: 0, verbrauchsbuchungen: 0, periodeLabel: data?.periodLabel || String(new Date().getFullYear()), periodeStatus: "offen" }}
        title="ROI & Kennzahlen"
        description="Return on Investment (ROI) der App-Nutzung."
        icon={<Calculator className="w-5 h-5 text-indigo-600" strokeWidth={1.8} />}
        iconColor="bg-indigo-50"
        onClick={() => setOpen(true)}
        kpi={kpi}
        footer="Return on Investment"
        analyseLink={{ label: "Details", href: "#", onClick: () => setOpen(true) }}
      />
      
      <AnalysisOverlay
        open={open}
        onClose={() => setOpen(false)}
        title="Profit of Invest"
        {...props}
      />
    </>
  );
}
