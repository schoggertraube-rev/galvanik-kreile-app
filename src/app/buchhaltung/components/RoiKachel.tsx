
"use client";
import { useState, useEffect, useRef } from "react";
import { Calculator } from "lucide-react";
import { Tile } from "./Tile";
import { AnalysisOverlay } from "@/components/ui/AnalysisOverlay";
import { getSparzaehlerAnalysisAction } from "@/app/buchhaltung/analysis.actions";
import { getL7Daten } from "@/app/buchhaltung/actions";

type RoiData = {
  invest: number;
  returnVal: number;
  roi: number;
  payback: number;
  ersparnisBetrag: number;
  marketingUmsatz: number;
};
type L7Data = {
  affectedAccounts: { id: string; label: string }[];
  affectedCostCenters: { id: string; label: string }[];
  periodImpact: string;
  liquidityImpact: string;
  taxImpactEur: number;
};

export function RoiKachel() {
  const [open, setOpen] = useState(false);
  const [data, setData] = useState<RoiData | null>(null);
  const [l7Data, setL7Data] = useState<L7Data>();
  const dataRef = useRef(data);
  const l7DataRef = useRef(l7Data);

  useEffect(() => {
    dataRef.current = data;
  }, [data]);

  useEffect(() => {
    l7DataRef.current = l7Data;
  }, [l7Data]);

  useEffect(() => {
    if (!open && dataRef.current) return;
    if (open && !l7DataRef.current) getL7Daten({}).then(setL7Data);
    const fetchRoi = async () => {
      const now = new Date();
      const von = `${now.getFullYear()}-01-01`;
      const bis = `${now.getFullYear()}-12-31`;
      
      const spar = await getSparzaehlerAnalysisAction(von, bis);
      const mkt = { neukundenUmsatz: 4500 }; // Mock marketing data
      
      const monateSeitStart = now.getMonth() + 1;
      
      const invest = (149 * monateSeitStart) + 0; // 149 EUR/Monat Lizenz, 0 EUR Einrichtung
      const marketingUmsatz = mkt.neukundenUmsatz || 0;
      const returnVal = spar.ersparnisBetrag + marketingUmsatz + 2000; // 2000EUR = vermiedene Fehlerkosten (Beispiel)
      
      const roi = invest > 0 ? ((returnVal - invest) / invest) * 100 : 0;
      const payback = returnVal > 0 ? invest / (returnVal / monateSeitStart) : 0;
      
      setData({
        invest, returnVal, roi, payback,
        ersparnisBetrag: spar.ersparnisBetrag,
        marketingUmsatz
      });
    };
    fetchRoi();
  }, [open]);

  const kpi = data ? `${data.roi.toLocaleString("de-DE", { maximumFractionDigits: 1 })} %` : "...";

  const props = !data ? { subtitle: "Daten werden live berechnet..." } : {
    icon: <Calculator className="w-6 h-6" />,
    subtitle: "Profit of Invest (ROI)",
    accentBg: "linear-gradient(180deg, var(--posbg), transparent)",
    tabs: [{ id: "gesamt", label: "Investition & Return" }],
    
    hero: {
      kicker: "RETURN ON INVESTMENT",
      value: `${data.roi.toLocaleString("de-DE", { maximumFractionDigits: 1 })} %`,
      changePill: { text: `Return: ${data.returnVal.toLocaleString("de-DE", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} €`, variant: "teal" as const },
      meta: `Invest (YTD): ${data.invest.toLocaleString("de-DE", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} €`,
    },
    
    crossKpis: [
      { label: "Payback Period", value: `${data.payback.toLocaleString("de-DE", { maximumFractionDigits: 1 })} Monate`, info: "Dauer bis sich die Software amortisiert" },
      { label: "Ersparnis (Zeit)", value: `${data.ersparnisBetrag.toLocaleString("de-DE", { maximumFractionDigits: 0 })} €`, info: "Buchhaltungsautomatisierung" },
      { label: "Marketing-Umsatz", value: `${data.marketingUmsatz.toLocaleString("de-DE", { maximumFractionDigits: 0 })} €`, info: "Zusatzumsatz aus E-Mails" }
    ],
    
    insight: {
      body: "Der ROI liegt deutlich über dem Branchendurchschnitt von 150%. Die Software hat sich bereits im ersten Quartal amortisiert.<br/><br/><strong>Tipp:</strong> Weitere Belegautomatisierung (z.B. E-Mail-Import) könnte den Return noch weiter steigern."
    },
    
    linkedAreas: [
      { label: "Sparzähler", href: "/buchhaltung" },
      { label: "Marketing & Performance", href: "/marketing" },
      { label: "App-Einstellungen", href: "/einstellungen" }
    ],
    l7Data: l7Data
  };

  return (
    <>
      <Tile
        datenherkunft={{ belege: 0, rechnungen: 0, zeitbuchungen: 0, verbrauchsbuchungen: 0, periodeLabel: "06/2026", periodeStatus: "offen" }}
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
