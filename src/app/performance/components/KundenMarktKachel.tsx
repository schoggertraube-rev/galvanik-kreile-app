import React, { useState } from "react";
import { AnalysisOverlay } from "@/components/ui/AnalysisOverlay";
import {
  Users,
} from "lucide-react";

interface Props {
  perfData?: Record<string, any>;
  cmpOn?: boolean;
  cmpPer?: string;
  getDeltaText?: (rawDataset: string) => string | null;
}

export function KundenMarktKachel({
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
          <div className="t-glow" style={{ background: "#60A5FA" }}></div>
          <div className="t-th">
            <div className="t-tl">
              <div className="t-ico" style={{ background: "var(--infobg)" }}>
                <Users className="w-5 h-5" style={{ color: "var(--info)" }} />
              </div>
              <div>
                <div className="t-name">Kunden und Markt</div>
                <div className="t-sub">CLV · Zahlung · Regionen</div>
              </div>
            </div>
            <span className="t-pill t-pill-g">STABIL</span>
          </div>
          <div className="metrics">
            <div className="m">
              <div className="ml">Top-Kunde</div>
              <div className="mv sm">Museum Lenzburg</div>
              <div className="md" style={{ color: "var(--ink2)" }}>
                0 € · CLV 0 €
              </div>
              <div className={`delta d-neutral ${cmpOn ? "show" : ""}`}>
                {getDeltaText(
                  "vormonat:unverändert|vorwoche:unverändert|vorquartal:neu in Top 1|vorjahr:unverändert",
                )}
              </div>
            </div>
            <div className="m">
              <div className="ml">Zahlungsmoral</div>
              <div className="mv sm pos">Ø 18 T</div>
              <div className="md" style={{ color: "var(--ink2)" }}>
                82% pünktlich
              </div>
              <div className={`delta d-pos ${cmpOn ? "show" : ""}`}>
                {getDeltaText(
                  "vormonat:−2 T besser|vorwoche:−1 T|vorquartal:−3 T|vorjahr:−4 T besser",
                )}
              </div>
            </div>
          </div>
          <div className="custrow">
            <span>🚗 82% Abholung</span>
            <span>📦 18% Versand</span>
            <span>🌍 3 Länder</span>
          </div>
          <div className="t-arr">Details →</div>
        </div>
      </div>

      <AnalysisOverlay
        open={active}
        onClose={() => setActive(false)}
        title="Kunden & Markt"
        subtitle="CLV · Zahlung · Regionen"
        icon={<Users className="w-5 h-5" style={{ color: "var(--info)" }} />}
        accentBg="linear-gradient(180deg, var(--infobg, rgba(96,165,250,0.12)), transparent)"
        tabs={[
          { id: "woche", label: "Woche" },
          { id: "monat", label: "Monat" },
          { id: "quartal", label: "Quartal" },
          { id: "jahr", label: "Jahr" },
        ]}
        activeTab={activeTab}
        onTabChange={setActiveTab}
        hero={{
          kicker: "Top-Kunde",
          value: "Museum Lenzburg",
          changePill: { text: "CLV: 42.500 €", variant: "teal" },
          meta: "Stammkunde seit 2018 · Segment: Antiquitäten",
          sparkValues: [12000, 15000, 14000, 18000, 22000],
        }}
        trend={{
          title: "B · Customer Lifetime Value (Top 5)",
          readAs:
            "So liest du das: Die blauen Balken zeigen den Gesamtumsatz der Top-Kunden über ihre gesamte Historie.",
          chartData: [
            { name: "Museum", ist: 42500, vorjahr: 0 },
            { name: "Schmidt", ist: 38000, vorjahr: 0 },
            { name: "Meyer", ist: 32000, vorjahr: 0 },
            { name: "Huber", ist: 28000, vorjahr: 0 },
            { name: "Zürich", ist: 15000, vorjahr: 0 },
          ],
        }}
        composition={{
          title: "C · Kunden-Segmente",
          rows: [
            {
              avatar: "I",
              avatarColor: "#60A5FA",
              name: "Industrie & Maschinenbau",
              meta: "42 aktive Kunden · Ø CLV: 18.000 €",
              amount: "48%",
              previewText:
                "Stabiles Kernsegment. Rahmenverträge sichern hier den Grundumsatz.",
            },
            {
              avatar: "M",
              avatarColor: "#A78BFA",
              name: "Medizintechnik",
              meta: "12 aktive Kunden · Ø CLV: 35.000 €",
              amount: "22%",
              previewText:
                "Hohe Margen, hohe Anforderungen. Dieses Segment wächst am stärksten.",
            },
            {
              avatar: "H",
              avatarColor: "#34D399",
              name: "Handwerk & Schreinereien",
              meta: "85 aktive Kunden · Ø CLV: 4.500 €",
              amount: "18%",
              previewText:
                "Viele kleine Kunden. Unregelmäßige Aufträge, oft Eloxal.",
            },
            {
              avatar: "P",
              avatarColor: "#928F86",
              name: "Privatkunden",
              meta: "140 aktive Kunden · Ø CLV: 800 €",
              amount: "12%",
              previewText:
                "Einmalige Aufträge wie Oldtimer-Teile oder Antiquitäten.",
            },
          ],
        }}
        crossKpi={[
          {
            label: "Wiederkaufrate",
            value: "68 %",
            delta: "▲ +4 %",
            deltaColor: "var(--pos)",
            accentColor: "var(--pos)",
          },
          {
            label: "Abhängigkeitsindex",
            value: "18 %",
            delta: "Stabil",
            deltaColor: "var(--text2)",
            accentColor: "var(--info)",
          },
          {
            label: "Zahlungsmoral",
            value: "Ø 18 Tage",
            delta: "▼ −2 Tage",
            deltaColor: "var(--pos)",
            accentColor: "var(--pos)",
          },
        ]}
        insight={{
          body: "<b>Beobachtung:</b> 12 Stammkunden haben seit über 6 Monaten keinen Auftrag mehr platziert.<br><b>Potenzial:</b> Bei diesen inaktiven Kunden liegt ein theoretisches Reaktivierungspotenzial von ca. 24.000 €.<br><b>Empfehlung:</b> Starte eine Reaktivierungskampagne per E-Mail oder Telefon für das Segment 'Industrie & Maschinenbau'.",
          actions: [
            { label: "Inaktive Kunden filtern" },
            { label: "Kampagne starten" },
          ],
        }}
        linkedAreas={[
          {
            label: "Kundenstamm",
            href: "/kunden",
            previewText:
              "Im Kundenstamm kannst du nach 'Letzter Auftrag > 6 Monate' filtern, um inaktive Kunden zu identifizieren.",
          },
          {
            label: "Buchhaltung",
            href: "/buchhaltung",
            previewText:
              "Die Zahlungsmoral hat sich auf 18 Tage verbessert. Mahnläufe greifen.",
          },
        ]}
      />
    </>
  );
}
