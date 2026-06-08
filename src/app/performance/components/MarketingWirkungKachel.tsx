import React, { useState } from "react";
import { AnalysisOverlay } from "@/components/ui/AnalysisOverlay";
import { Sparkles } from "lucide-react";

interface Props {
  perfData?: Record<string, any>;
  cmpOn?: boolean;
  cmpPer?: string;
  getDeltaText?: (rawDataset: string) => string | null;
}

export function MarketingWirkungKachel({
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
        <div className="t-tile" style={{ borderColor: "rgba(251,191,36,0.3)" }}>
          <div className="t-glow" style={{ background: "#FBBF24" }}></div>
          <div className="t-th">
            <div className="t-tl">
              <div className="t-ico" style={{ background: "var(--warnbg)" }}>
                <Sparkles
                  className="w-5 h-5"
                  style={{ color: "var(--warn)" }}
                />
              </div>
              <div>
                <div className="t-name">Marketing & Kundenreaktivierung</div>
                <div className="t-sub">
                  Kandidaten · Segmente · Umsatzpotenzial
                </div>
              </div>
            </div>
            <span className="t-pill t-pill-y">DEMO-DATEN</span>
          </div>
          <div className="metrics">
            <div className="m">
              <div className="ml">Reaktivierungskandidaten</div>
              <div className="mv warn">6</div>
              <div className="md" style={{ color: "var(--ink2)" }}>
                Kunden ohne Folgeauftrag &gt; 6 Mon.
              </div>
            </div>
            <div className="m">
              <div className="ml">Segmentpotenzial</div>
              <div className="mv sm">Oldtimer / Schmuck</div>
              <div className="md" style={{ color: "var(--ink2)" }}>
                Stärkste Segmente
              </div>
            </div>
            <div className="m">
              <div className="ml">Reaktivierungswirkung</div>
              <div className="mv sm" style={{ color: "var(--ink3)" }}>
                – %
              </div>
              <div className="md" style={{ color: "var(--ink3)" }}>
                Noch keine Kampagne gestartet
              </div>
            </div>
            <div className="m">
              <div className="ml">Marge-Potenzial</div>
              <div className="mv sm" style={{ color: "var(--ink3)" }}>
                – €
              </div>
              <div className="md" style={{ color: "var(--ink3)" }}>
                Echte Kampagnendaten fehlen
              </div>
            </div>
          </div>
          <div
            className="alertbox"
            style={{
              background: "var(--warnbg)",
              fontSize: "10px",
              fontWeight: 500,
            }}
          >
            ⚠ Daten basieren auf Bestandskunden-Analyse (Demo). Echte
            Kampagnendaten werden erst nach E-Mail-Integration verfügbar.
          </div>
          <div className="t-arr">Details →</div>
        </div>
      </div>
      <AnalysisOverlay
        open={active}
        onClose={() => setActive(false)}
        title="Marketing & Reaktivierung"
        subtitle="Kampagnen · ROI · Segmente"
        icon={<Sparkles className="w-5 h-5" style={{ color: "var(--warn)" }} />}
        accentBg="linear-gradient(180deg, var(--warnbg, rgba(251,191,36,0.12)), transparent)"
        tabs={[
          { id: "monat", label: "Monat" },
          { id: "quartal", label: "Quartal" },
          { id: "jahr", label: "Jahr" },
        ]}
        activeTab={activeTab}
        onTabChange={setActiveTab}
        hero={{
          kicker: "Marketing-ROI (aktueller Monat)",
          value: "380 %",
          changePill: {
            text: "Stärkstes Segment: Industrie",
            variant: "amber",
          },
          meta: "14 Reaktivierungs-Kandidaten kontaktiert · 3 konvertiert",
          sparkValues: [120, 180, 250, 310, 380],
        }}
        trend={{
          title: "B · Attributions-Funnel",
          readAs:
            "So liest du das: Der Funnel zeigt den Weg von der Erstansprache bis zum Abschluss.",
          chartType: "bar",
          chartData: [
            { name: "Reichweite", ist: 450, vorjahr: 0 },
            { name: "Klicks", ist: 120, vorjahr: 0 },
            { name: "Anfragen", ist: 28, vorjahr: 0 },
            { name: "Angebote", ist: 14, vorjahr: 0 },
            { name: "Aufträge", ist: 8, vorjahr: 0 },
          ],
        }}
        composition={{
          title: "C · Letzte Aktionen & Kampagnen",
          rows: [
            {
              avatar: "E",
              avatarColor: "#60A5FA",
              name: "E-Mail Reaktivierung (Industrie)",
              meta: "Kosten: 120 € · Leads: 4",
              amount: "2.400 €",
              previewText:
                "Personalisierte E-Mail-Kampagne an 45 inaktive Industriekunden. 4 Anfragen erhalten, davon 2 Aufträge im Wert von 2.400 € abgeschlossen.",
            },
            {
              avatar: "I",
              avatarColor: "#D14F3D",
              name: "Instagram Ads (Oldtimer)",
              meta: "Kosten: 350 € · Leads: 18",
              amount: "1.250 €",
              previewText:
                "Performance-Kampagne für Oldtimer-Verchromung. Hohe Klickrate, aber geringe Conversion. Viele kleine Aufträge.",
            },
            {
              avatar: "P",
              avatarColor: "#A78BFA",
              name: "Printanzeige Fachmagazin",
              meta: "Kosten: 800 € · Leads: 2",
              amount: "In Prüfung",
              previewText:
                "Ganze Seite im 'Metallbau Magazin'. Bisher 2 Anfragen, noch keine Abschlüsse.",
            },
          ],
        }}
        crossKpi={[
          {
            label: "Kosten / Anfrage (CPL)",
            value: "45 €",
            delta: "▼ −12 €",
            deltaColor: "var(--pos)",
            accentColor: "var(--pos)",
          },
          {
            label: "ROI E-Mail",
            value: "2.000 %",
            delta: "Höchster Wert",
            deltaColor: "var(--pos)",
            accentColor: "var(--pos)",
          },
          {
            label: "ROI Instagram",
            value: "357 %",
            delta: "Stabil",
            deltaColor: "var(--text2)",
            accentColor: "var(--info)",
          },
        ]}
        insight={{
          body: "<b>Beobachtung:</b> E-Mail-Reaktivierung von Bestandskunden im B2B-Segment (Industrie) hat mit Abstand den höchsten ROI.<br><b>Achtung:</b> Printanzeigen verbrennen aktuell Budget ohne messbaren Return.<br><b>Empfehlung:</b> Print-Budget (800€) stoppen und in gezielte LinkedIn-Ansprache für Medizintechnik-Einkäufer umschichten.",
          actions: [
            { label: "LinkedIn-Kampagne erstellen" },
            { label: "Print-Budget pausieren" },
          ],
        }}
        linkedAreas={[
          {
            label: "Marketing-Studio",
            href: "/marketing",
            previewText:
              "Im Marketing-Studio können Kampagnen budgets verwaltet und Anzeigenmotive getestet werden.",
          },
          {
            label: "Kundenstamm",
            href: "/kunden",
            previewText:
              "Filtere nach 'Inaktiv', um Zielgruppen für die nächste E-Mail-Kampagne zu exportieren.",
          },
        ]}
      />
    </>
  );
}
