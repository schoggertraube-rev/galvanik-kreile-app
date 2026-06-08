import React, { useState } from "react";
import { AnalysisOverlay } from "@/components/ui/AnalysisOverlay";
import {
  FlaskConical,
} from "lucide-react";

interface Props {
  perfData?: Record<string, any>;
  cmpOn?: boolean;
  cmpPer?: string;
  getDeltaText?: (rawDataset: string) => string | null;
}

export function BaederMaterialKachel({
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
          <div className="t-glow" style={{ background: "#FBBF24" }}></div>
          <div className="t-th">
            <div className="t-tl">
              <div className="t-ico" style={{ background: "var(--warnbg)" }}>
                <FlaskConical
                  className="w-5 h-5"
                  style={{ color: "var(--warn)" }}
                />
              </div>
              <div>
                <div className="t-name">Bäder und Material</div>
                <div className="t-sub">Metallpreise · Einkauf · Marge</div>
              </div>
            </div>
            <span className="t-pill t-pill-y">1 BEOBACHTEN</span>
          </div>
          <div className="metrics">
            <div className="m">
              <div className="ml">Metall-Marge (Mai)</div>
              <div className="mv pos">0 €</div>
              <div className="md pos">Gold +14% seit Badkauf</div>
              <div className={`delta d-pos ${cmpOn ? "show" : ""}`}>
                {getDeltaText(
                  "vormonat:+620 €|vorwoche:+180 €|vorquartal:+1.240 €|vorjahr:+2.100 €",
                )}
              </div>
            </div>
            <div className="m">
              <div className="ml">Einkauf-Ergebnis</div>
              <div className="mv sm pos">0 €</div>
              <div className="md" style={{ color: "var(--ink2)" }}>
                Marktwert &gt; Einkauf
              </div>
              <div className={`delta d-pos ${cmpOn ? "show" : ""}`}>
                {getDeltaText(
                  "vormonat:+380 €|vorwoche:+90 €|vorquartal:+840 €|vorjahr:0 €",
                )}
              </div>
            </div>
          </div>
          <div className="chips">
            <div className="chip">
              <span className="cdot" style={{ background: "#FBBF24" }}></span>
              Gold 68,40
            </div>
            <div className="chip">
              <span className="cdot" style={{ background: "#94A3B8" }}></span>
              Silber 0,98
            </div>
            <div className="chip">
              <span className="cdot" style={{ background: "#D97706" }}></span>
              Kupfer 8,78/kg
            </div>
            <div className="chip">
              <span className="cdot" style={{ background: "#86EFAC" }}></span>
              Nickel 15,90/kg
            </div>
          </div>
          <div className="t-arr">Details →</div>
        </div>
      </div>

      <AnalysisOverlay
        open={active}
        onClose={() => setActive(false)}
        title="Bäder & Material"
        subtitle="Metallpreise · Einkauf · Marge"
        icon={
          <FlaskConical className="w-5 h-5" style={{ color: "var(--warn)" }} />
        }
        accentBg="linear-gradient(180deg, var(--warnbg, rgba(251,191,36,0.12)), transparent)"
        tabs={[
          { id: "woche", label: "Woche" },
          { id: "monat", label: "Monat" },
          { id: "quartal", label: "Quartal" },
        ]}
        activeTab={activeTab}
        onTabChange={setActiveTab}
        hero={{
          kicker: "Metall-Marge (buchhalterisch)",
          value: "+ 1.250 €",
          changePill: { text: "Goldpreis +14%", variant: "amber" },
          meta: "Marktwert der Badfüllungen vs. historische Anschaffungskosten",
          sparkValues: [800, 950, 1050, 1100, 1250],
        }}
        trend={{
          title: "B · Goldpreis-Entwicklung (EUR/g)",
          readAs:
            "So liest du das: Die gelbe Fläche zeigt den tagesaktuellen Goldpreis. Die Linie markiert deinen durchschnittlichen Einkaufspreis.",
          chartData: [
            { name: "Feb", ist: 62.4, vorjahr: 58.0 },
            { name: "Mär", ist: 64.1, vorjahr: 58.0 },
            { name: "Apr", ist: 66.8, vorjahr: 58.0 },
            { name: "Mai", ist: 67.5, vorjahr: 58.0 },
            { name: "Jun", ist: 68.4, vorjahr: 58.0 },
          ],
        }}
        composition={{
          title: "C · Aktive Bäder (Top 4 nach Wert)",
          rows: [
            {
              avatar: "Au",
              avatarColor: "#FBBF24",
              name: "Goldbad 1",
              meta: "Konzentration: 1,8 g/l (Soll 2,0) · Wert: 42.000 €",
              amount: "Nachdosieren",
              previewText:
                "Das Goldbad ist der größte Werttreiber. Die Konzentration ist leicht unter dem Sollwert. Nächste Nachdosierung in 2 Tagen empfohlen.",
            },
            {
              avatar: "Ag",
              avatarColor: "#94A3B8",
              name: "Silberbad",
              meta: "Konzentration: 28 g/l (Soll 30) · Wert: 18.500 €",
              amount: "OK",
              previewText:
                "Silberbad läuft stabil. Keine Maßnahmen erforderlich.",
            },
            {
              avatar: "Ni",
              avatarColor: "#86EFAC",
              name: "Nickelbad 2",
              meta: "Konzentration: 85 g/l (Soll 80) · Wert: 4.200 €",
              amount: "Warnung",
              previewText:
                "Nickelkonzentration zu hoch. Es drohen raue Überzüge. Verdünnung oder Teil-Neuansatz prüfen.",
            },
            {
              avatar: "Cu",
              avatarColor: "#D97706",
              name: "Kupferbad (sauer)",
              meta: "Konzentration: 60 g/l (Soll 65) · Wert: 2.100 €",
              amount: "OK",
              previewText: "Kupferbad läuft stabil.",
            },
          ],
        }}
        crossKpi={[
          {
            label: "Materialkostenanteil",
            value: "28 %",
            delta: "▼ −2 %",
            deltaColor: "var(--pos)",
            accentColor: "var(--pos)",
          },
          {
            label: "Kapitalbindung (Bäder)",
            value: "66.800 €",
            delta: "▲ +1.200 €",
            deltaColor: "var(--text2)",
            accentColor: "var(--info)",
          },
          {
            label: "Lagerbestand Chemie",
            value: "14.500 €",
            delta: "Reicht für 45 T.",
            deltaColor: "var(--text2)",
            accentColor: "var(--info)",
          },
        ]}
        insight={{
          body: "<b>Beobachtung:</b> Der hohe Goldpreis sorgt für eine positive buchhalterische Marge der bestehenden Badfüllung.<br><b>Achtung:</b> Nickelbad 2 weicht deutlich vom Sollwert ab (85 g/l statt 80 g/l). Dies korreliert mit den steigenden Reklamationen wegen 'Maßabweichung'.<br><b>Empfehlung:</b> Goldbad in 2 Tagen um 50g nachdosieren (aktueller Preis: 68,40 €/g). Nickelbad umgehend verdünnen.",
          actions: [
            { label: "Gold Einkaufspreise prüfen" },
            { label: "Nickelbad Wartung" },
          ],
        }}
        linkedAreas={[
          {
            label: "Badregelkarten",
            href: "/baeder",
            previewText:
              "Die detaillierten Analysen aller Bäder der letzten 4 Wochen finden sich in den Badregelkarten.",
          },
          {
            label: "Lieferanten",
            href: "/lieferanten",
            previewText:
              "Hauptlieferant für Edelmetallsalze ist aktuell Heraeus. Rahmenvertrag läuft noch bis Jahresende.",
          },
        ]}
      />
    </>
  );
}
