import React, { useState } from "react";
import { AnalysisOverlay } from "@/components/ui/AnalysisOverlay";
import {
  AlertTriangle,
} from "lucide-react";

interface Props {
  perfData?: Record<string, any>;
  cmpOn?: boolean;
  cmpPer?: string;
  getDeltaText?: (rawDataset: string) => string | null;
}

export function QualitaetRisikoKachel({
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
                <AlertTriangle
                  className="w-5 h-5"
                  style={{ color: "var(--warn)" }}
                />
              </div>
              <div>
                <div className="t-name">Qualität und Risiko</div>
                <div className="t-sub">Reklamationen · Frühwarnungen</div>
              </div>
            </div>
            <span className="t-pill t-pill-y">2 AKTIV</span>
          </div>
          <div className="metrics">
            <div className="m">
              <div className="ml">Reklamationen</div>
              <div className="mv warn">
                {perfData.reklas}{" "}
                <span
                  style={{
                    fontSize: "13px",
                    fontWeight: 400,
                    color: "var(--ink2)",
                  }}
                >
                  von {perfData.totalOrders}
                </span>
              </div>
              <div className="md neg">▲ +1 vs. Vj. · 7,1%</div>
              <div className={`delta d-neg ${cmpOn ? "show" : ""}`}>
                {getDeltaText(
                  "vormonat:+1 mehr|vorwoche:±0|vorquartal:+1 mehr|vorjahr:+1 mehr",
                )}
              </div>
            </div>
            <div className="m">
              <div className="ml">Frühwarnungen</div>
              <div className="mv sm neg">{perfData.activeWarnings} aktiv</div>
              <div className="md" style={{ color: "var(--ink2)" }}>
                Nickelbad: 4 Tage
              </div>
              <div className={`delta d-warn ${cmpOn ? "show" : ""}`}>
                {getDeltaText(
                  "vormonat:neu|vorwoche:neu|vorquartal:+1 neu|vorjahr:+1 neu",
                )}
              </div>
            </div>
          </div>
          <div className="alertbox" style={{ background: "var(--negbg)" }}>
            <span style={{ fontWeight: 600 }}>A-2026-0042:</span> 0% Risiko · 0
            Kunden überfällig (0 €)
          </div>
          <div className="t-arr">Details →</div>
        </div>
      </div>

      <AnalysisOverlay
        open={active}
        onClose={() => setActive(false)}
        title="Qualität & Risiko"
        subtitle="Reklamationen · Frühwarnungen"
        icon={
          <AlertTriangle className="w-5 h-5" style={{ color: "var(--warn)" }} />
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
          kicker: "Reklamationsquote (aktueller Monat)",
          value: "7,1 %",
          changePill: { text: "▲ +1,2% vs. Vormonat", variant: "amber" },
          meta: "Juni 2026 · 8 Reklamationen bei 112 Aufträgen",
          sparkValues: [4.2, 3.8, 5.1, 5.9, 7.1],
        }}
        trend={{
          title: "B · Reklamationen im Zeitverlauf",
          readAs:
            "So liest du das: Die rote Fläche zeigt die Reklamationsquote. Die gestrichelte Linie ist der Zielwert (max. 4%).",
          chartData: [
            { name: "Feb", ist: 4.2, vorjahr: 4.0 },
            { name: "Mär", ist: 3.8, vorjahr: 4.0 },
            { name: "Apr", ist: 5.1, vorjahr: 4.0 },
            { name: "Mai", ist: 5.9, vorjahr: 4.0 },
            { name: "Jun", ist: 7.1, vorjahr: 4.0 },
          ],
        }}
        composition={{
          title: "C · Aktive Reklamationen",
          rows: [
            {
              avatar: "AM",
              avatarColor: "#D14F3D",
              name: "Autohaus Meier (A-0104)",
              meta: "Grund: Maßabweichung (Schichtdicke)",
              amount: "Nacharbeit",
              previewText:
                "Kunde meldet Maßabweichungen an 12 Teilen (Schichtdicke zu hoch). Nacharbeit wurde eingeleitet.",
            },
            {
              avatar: "S",
              avatarColor: "#FBBF24",
              name: "Schreinerei Huber (A-0089)",
              meta: "Grund: Optischer Mangel (Flecken)",
              amount: "Teilgutschrift",
              previewText:
                "Kunde beanstandet optische Flecken auf Eloxal-Oberfläche. Teilgutschrift in Höhe von 150 € wurde angeboten.",
            },
            {
              avatar: "D",
              avatarColor: "#60A5FA",
              name: "Diverse (Long-Tail)",
              meta: "6 weitere kleinere Fälle",
              amount: "In Prüfung",
              previewText:
                "6 kleinere Fälle befinden sich noch in der Prüfung.",
            },
          ],
        }}
        crossKpi={[
          {
            label: "Kosten / Reklamation",
            value: "345 €",
            delta: "▲ +45 €",
            deltaColor: "var(--neg)",
            accentColor: "var(--neg)",
          },
          {
            label: "Qualitätskosten / Umsatz",
            value: "3,2 %",
            delta: "▲ +0,8 %",
            deltaColor: "var(--warn)",
            accentColor: "var(--warn)",
          },
          {
            label: "Durchlaufzeit (Nacharbeit)",
            value: "2,4 T",
            delta: "Stabil",
            deltaColor: "var(--text2)",
            accentColor: "var(--info)",
          },
        ]}
        insight={{
          body: "<b>Beobachtung:</b> Die Reklamationsquote steigt seit April kontinuierlich an und liegt deutlich über dem Zielwert (4%). Hauptgrund ist 'Maßabweichung' im Galvanikbad 2.<br><b>Ursache:</b> Die Badregelkarte für Galvanikbad 2 zeigt seit Wochen starke Schwankungen bei der Nickel-Konzentration.<br><b>Empfehlung:</b> Galvanikbad 2 außerplanmäßig analysieren und neu ansetzen. Teile aus diesem Bad einer 100%-Prüfung unterziehen.",
          actions: [
            { label: "Badregelkarte Bad 2 öffnen" },
            { label: "100%-Prüfung anweisen" },
          ],
        }}
        linkedAreas={[
          {
            label: "Badregelkarten",
            href: "/baeder",
            previewText:
              "Galvanikbad 2 (Nickel) zeigt kritische Abweichungen. Die Konzentration weicht um 15% vom Soll ab.",
          },
          {
            label: "Qualitätskontrolle",
            href: "/kontrolle",
            previewText:
              "In der Qualitätskontrolle warten 12 Chargen auf Freigabe. 2 Chargen aus Galvanikbad 2 wurden bereits gesperrt.",
          },
        ]}
      />
    </>
  );
}
