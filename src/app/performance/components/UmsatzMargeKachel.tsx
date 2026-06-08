import React, { useState } from "react";
import { AnalysisOverlay } from "@/components/ui/AnalysisOverlay";
import {
  Banknote,
} from "lucide-react";

interface Props {
  perfData?: Record<string, any>;
  cmpOn?: boolean;
  cmpPer?: string;
  getDeltaText?: (rawDataset: string) => string | null;
}

export function UmsatzMargeKachel({
  perfData = {},
  cmpOn,
  cmpPer,
  getDeltaText = () => null,
}: Props) {
  const [active, setActive] = useState(false);
  const [activeTab, setActiveTab] = useState("monat");

  return (
    <>
      <div
        onClick={() => setActive(true)}
        style={{ textDecoration: "none", color: "inherit", cursor: "pointer" }}
      >
        <div className="t-tile">
          <div className="t-glow" style={{ background: "#34D399" }}></div>
          <div className="t-th">
            <div className="t-tl">
              <div className="t-ico" style={{ background: "var(--posbg)" }}>
                <Banknote className="w-5 h-5" style={{ color: "var(--pos)" }} />
              </div>
              <div>
                <div className="t-name">Umsatz und Marge</div>
                <div className="t-sub">Finanzen · Forecast · Controlling</div>
              </div>
            </div>
            <span className="t-pill t-pill-g">STABIL</span>
          </div>
          <div className="metrics">
            <div className="m">
              <div className="ml">Umsatz netto</div>
              <div className="mv">
                {perfData.totalRevenue.toLocaleString("de-DE")} €
              </div>
              <div className="md pos">▲ +7,2% vs. Vj.</div>
              <div className={`delta d-pos ${cmpOn ? "show" : ""}`}>
                {getDeltaText(
                  "vormonat:+3.120 €|vorwoche:+820 €|vorquartal:+4.580 €|vorjahr:+2.860 €",
                )}
              </div>
            </div>
            <div className="m">
              <div className="ml">Deckungsbeitrag</div>
              <div className="mv sm">
                {(perfData.totalRevenue * 0.279).toLocaleString("de-DE")} €
              </div>
              <div className="md" style={{ color: "var(--ink2)" }}>
                {perfData.totalRevenue > 0 ? "27,9% Marge" : "0% Marge"}
              </div>
              <div className={`delta d-pos ${cmpOn ? "show" : ""}`}>
                {getDeltaText(
                  "vormonat:+940 €|vorwoche:+210 €|vorquartal:+1.240 €|vorjahr:+680 €",
                )}
              </div>
            </div>
          </div>
          <div className="spk">
            <svg viewBox="0 0 140 28" width="140" height="28">
              <defs>
                <linearGradient id="sg" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="var(--pos)" stopOpacity="0.22" />
                  <stop offset="100%" stopColor="var(--pos)" stopOpacity="0" />
                </linearGradient>
              </defs>
              <path
                d="M0,22 L16,19 L32,20 L48,16 L64,14 L80,13 L96,11 L112,10 L128,7 L140,5 L140,28 L0,28 Z"
                fill="url(#sg)"
              />
              <polyline
                points="0,22 16,19 32,20 48,16 64,14 80,13 96,11 112,10 128,7 140,5"
                fill="none"
                stroke="var(--pos)"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          </div>
          <div className="t-arr">Details →</div>
        </div>
      </div>
      <AnalysisOverlay
        open={active}
        onClose={() => setActive(false)}
        title="Umsatz & Marge"
        subtitle="Finanzen · Forecast · Controlling"
        icon={<Banknote className="w-5 h-5" style={{ color: "var(--pos)" }} />}
        accentBg="linear-gradient(180deg, var(--posbg, rgba(52,211,153,0.12)), transparent)"
        tabs={[
          { id: "woche", label: "Woche" },
          { id: "monat", label: "Monat" },
          { id: "quartal", label: "Quartal" },
          { id: "jahr", label: "Jahr" },
        ]}
        activeTab={activeTab}
        onTabChange={setActiveTab}
        hero={{
          kicker: "Umsatz netto (aktueller Monat)",
          value: "42.500 €",
          changePill: { text: "▲ +7,2% vs. Vormonat", variant: "teal" },
          meta: "Juni 2026 · Deckungsbeitrag: 27,9% (11.850 €)",
          sparkValues: [38000, 39500, 41200, 40800, 42500],
        }}
        trend={{
          title: "B · Umsatz im Zeitverlauf",
          readAs:
            "So liest du das: Die grüne Fläche ist der generierte Umsatz. Die graue gestrichelte Linie ist der Umsatz des Vorjahres.",
          chartData: [
            { name: "Feb", ist: 38000, vorjahr: 36000 },
            { name: "Mär", ist: 39500, vorjahr: 38000 },
            { name: "Apr", ist: 41200, vorjahr: 40000 },
            { name: "Mai", ist: 40800, vorjahr: 42000 },
            { name: "Jun", ist: 42500, vorjahr: 39600 },
          ],
        }}
        composition={{
          title: "C · Top 5 Kunden in diesem Zeitraum",
          rows: [
            {
              avatar: "AM",
              avatarColor: "#34D399",
              name: "Autohaus Meier",
              meta: "Umsatzanteil: 18%",
              amount: "7.650 €",
              previewText:
                "Autohaus Meier ist unser umsatzstärkster Kunde in diesem Monat. Der Schwerpunkt liegt auf der Verchromung von Kleinteilen.",
            },
            {
              avatar: "M",
              avatarColor: "#60A5FA",
              name: "Maschinenbau Schmidt",
              meta: "Umsatzanteil: 15%",
              amount: "6.375 €",
              previewText:
                "Stabiler Großkunde. Wir haben kürzlich neue Rahmenverträge für die Vernickelung abgeschlossen.",
            },
            {
              avatar: "W",
              avatarColor: "#A78BFA",
              name: "Werkzeug Meyer",
              meta: "Umsatzanteil: 11%",
              amount: "4.675 €",
              previewText: "Guter DB (32%). Hauptsächlich Eloxal-Aufträge.",
            },
            {
              avatar: "S",
              avatarColor: "#FBBF24",
              name: "Schreinerei Huber",
              meta: "Umsatzanteil: 8%",
              amount: "3.400 €",
              previewText:
                "Unregelmäßige Aufträge, aber hohe Marge bei Spezialbeschichtungen.",
            },
            {
              avatar: "D",
              avatarColor: "#928F86",
              name: "Diverse (Long-Tail)",
              meta: "Umsatzanteil: 48%",
              amount: "20.400 €",
              previewText:
                "Der restliche Umsatz verteilt sich auf 42 weitere Kunden.",
            },
          ],
        }}
        crossKpi={[
          {
            label: "Deckungsbeitrag / Auftrag",
            value: "245 €",
            delta: "▲ +12 €",
            deltaColor: "var(--pos)",
            accentColor: "var(--pos)",
          },
          {
            label: "Umsatz / Mitarbeiter",
            value: "8.500 €",
            delta: "Unverändert",
            deltaColor: "var(--text2)",
            accentColor: "var(--info)",
          },
          {
            label: "Forecast (Monatsende)",
            value: "88.000 €",
            delta: "▲ Über Plan",
            deltaColor: "var(--pos)",
            accentColor: "var(--pos)",
          },
        ]}
        insight={{
          body: "<b>Beobachtung:</b> Der Umsatz ist stabil und leicht steigend. Die Top 3 Kunden machen bereits 44% des Gesamtumsatzes aus.<br><b>Risiko:</b> Leichtes Klumpenrisiko bei 'Autohaus Meier'. Ein Ausfall hätte direkte Auswirkungen auf die Auslastung der Galvanikbäder.<br><b>Empfehlung:</b> Vertriebsmaßnahmen zur Neukundengewinnung im Segment 'Medizintechnik' intensivieren, um das Portfolio zu diversifizieren.",
          actions: [
            { label: "Vertriebs-Dashboard" },
            { label: "Kundenanalyse öffnen" },
          ],
        }}
        linkedAreas={[
          {
            label: "Buchhaltung",
            href: "/buchhaltung",
            previewText:
              "In der Buchhaltung warten derzeit 12 Rechnungen auf Freigabe. Die offene-Posten-Liste der Kunden beträgt 18.500 €.",
          },
          {
            label: "Kundenstamm",
            href: "/kunden",
            previewText: "Im Kundenstamm sind 142 aktive Kunden gelistet.",
          },
        ]}
      />
    </>
  );
}
