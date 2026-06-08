import React, { useState } from "react";
import { AnalysisOverlay } from "@/components/ui/AnalysisOverlay";
import {
  Activity,
} from "lucide-react";

interface Props {
  perfData?: Record<string, any>;
  cmpOn?: boolean;
  cmpPer?: string;
  getDeltaText?: (rawDataset: string) => string | null;
}

export function WerkstattPulsKachel({
  perfData = {},
  cmpOn,
  cmpPer,
  getDeltaText = () => null,
}: Props) {
  const [active, setActive] = useState(false);
  const [activeTab, setActiveTab] = useState("woche");

  return (
    <>
      <div
        onClick={() => setActive(true)}
        style={{ textDecoration: "none", color: "inherit", cursor: "pointer" }}
      >
        <div className="t-tile t-hero">
          <div className="t-glow" style={{ background: "#22D3EE" }}></div>
          <div className="t-th">
            <div className="t-tl">
              <div
                className="t-ico"
                style={{ background: "rgba(34,211,238,.12)" }}
              >
                <Activity
                  className="w-5 h-5"
                  style={{ color: "var(--cyan)" }}
                />
              </div>
              <div>
                <div className="t-name">Werkstatt-Puls</div>
                <div className="t-sub">Durchsatz · Stationen · Wochenziel</div>
              </div>
            </div>
            <span className="t-pill t-pill-y">HANDLUNGSBEDARF</span>
          </div>
          <div className="hero-body">
            <div className="hero-left">
              <div className="metrics">
                <div className="m">
                  <div className="ml">Termintreue</div>
                  <div className="mv neg">76 %</div>
                  <div className="md neg">▼ −9 Pkt. vs. Vj.</div>
                  <div className={`delta d-neg ${cmpOn ? "show" : ""}`}>
                    {getDeltaText(
                      "vormonat:−4 Pkt.|vorwoche:−2 Pkt.|vorquartal:−7 Pkt.|vorjahr:−9 Pkt.",
                    )}
                  </div>
                </div>
                <div className="m">
                  <div className="ml">Ø Durchlaufzeit</div>
                  <div className="mv warn">9,4 T</div>
                  <div className="md warn">▲ +1,2 T vs. Vj.</div>
                  <div className={`delta d-warn ${cmpOn ? "show" : ""}`}>
                    {getDeltaText(
                      "vormonat:+0,6 Tage|vorwoche:+0,2 Tage|vorquartal:+1,0 Tage|vorjahr:+1,2 Tage",
                    )}
                  </div>
                </div>
                <div className="m">
                  <div className="ml">Wochenziel</div>
                  <div className="mv">
                    23
                    <span
                      style={{
                        fontSize: "14px",
                        fontWeight: 400,
                        color: "var(--ink2)",
                      }}
                    >
                      {" "}
                      / 25
                    </span>
                  </div>
                  <div className="wgoal">
                    <div className="wprog">
                      <div className="wpf" style={{ width: "92%" }}></div>
                    </div>
                    <span
                      style={{
                        fontSize: "10px",
                        fontWeight: 600,
                        color: "var(--pos)",
                      }}
                    >
                      92%
                    </span>
                  </div>
                  <div className={`delta d-pos ${cmpOn ? "show" : ""}`}>
                    {getDeltaText(
                      "vormonat:+3 mehr|vorwoche:+1 mehr|vorquartal:+5 mehr|vorjahr:+2 mehr",
                    )}
                  </div>
                </div>
              </div>
              <div className="mbars">
                <div className="mbar">
                  <div
                    className="mbar-f"
                    style={{
                      background: "linear-gradient(to top,var(--neg),#fb7185)",
                      height: "94%",
                    }}
                  ></div>
                </div>
                <div className="mbar">
                  <div
                    className="mbar-f"
                    style={{
                      background: "linear-gradient(to top,var(--warn),#fcd34d)",
                      height: "78%",
                    }}
                  ></div>
                </div>
                <div className="mbar">
                  <div
                    className="mbar-f"
                    style={{
                      background: "linear-gradient(to top,var(--pos),#6ee7b7)",
                      height: "62%",
                    }}
                  ></div>
                </div>
                <div className="mbar">
                  <div
                    className="mbar-f"
                    style={{
                      background: "linear-gradient(to top,var(--pos),#6ee7b7)",
                      height: "54%",
                    }}
                  ></div>
                </div>
                <div className="mbar">
                  <div
                    className="mbar-f"
                    style={{
                      background: "linear-gradient(to top,var(--info),#93c5fd)",
                      height: "41%",
                    }}
                  ></div>
                </div>
              </div>
              <div className="mbar-labels">
                <span>Schleifen</span>
                <span>Politur</span>
                <span>Galvanik</span>
                <span>Vorber.</span>
                <span>QK/Vers.</span>
              </div>
            </div>
            <div style={{ display: "flex", alignItems: "center" }}>
              <div className="ring">
                <svg
                  width="80"
                  height="80"
                  viewBox="0 0 80 80"
                  style={{ transform: "rotate(-90deg)" }}
                >
                  <defs>
                    <linearGradient id="rg" x1="0" y1="0" x2="1" y2="0">
                      <stop offset="0%" stopColor="#06B6D4" />
                      <stop offset="100%" stopColor="#A78BFA" />
                    </linearGradient>
                  </defs>
                  <circle
                    cx="40"
                    cy="40"
                    r="32"
                    fill="none"
                    stroke="var(--bd)"
                    strokeWidth="6"
                  />
                  <circle
                    cx="40"
                    cy="40"
                    r="32"
                    fill="none"
                    stroke="url(#rg)"
                    strokeWidth="6"
                    strokeLinecap="round"
                    strokeDasharray="201"
                    strokeDashoffset={201 * (1 - 0.64)}
                  />
                </svg>
                <div className="rval">64%</div>
              </div>
            </div>
          </div>
          <div className="t-arr">Details →</div>
        </div>
      </div>
      <AnalysisOverlay
        open={active}
        onClose={() => setActive(false)}
        title="WerkstattPuls · Termintreue"
        subtitle="Pünktlich gelieferte Aufträge — Werkstatt-Performance"
        icon={<Activity className="w-5 h-5" style={{ color: "var(--neg)" }} />}
        accentBg="linear-gradient(180deg, var(--negbg, rgba(248,113,113,0.12)), transparent)"
        tabs={[
          { id: "tag", label: "Tag" },
          { id: "woche", label: "Woche" },
          { id: "monat", label: "Monat" },
          { id: "quartal", label: "Quartal" },
        ]}
        activeTab={activeTab}
        onTabChange={setActiveTab}
        hero={{
          kicker: "Wie pünktlich lieferst du",
          value: "76 %",
          changePill: { text: "▼ −9 Pkt. vs. Vorjahr", variant: "red" },
          meta: "KW22 · Tendenz fallend seit 4 Wochen",
          sparkValues: [85, 82, 79, 76],
        }}
        trend={{
          title: "B · Termintreue im Zeitverlauf",
          readAs:
            "So liest du das: Die blaue Fläche zeigt die aktuelle Termintreue in %. Die gestrichelte Linie ist das Vorjahr. Liegt die Fläche unter der Linie, hast du dich verschlechtert.",
          chartData: [
            { name: "KW19", ist: 85, vorjahr: 70 },
            { name: "KW20", ist: 82, vorjahr: 72 },
            { name: "KW21", ist: 79, vorjahr: 75 },
            { name: "KW22", ist: 76, vorjahr: 78 },
          ],
        }}
        composition={{
          title: "C · Durchlaufzeit pro Station · 5 Stationen",
          rows: [
            {
              avatar: "S",
              avatarColor: "#D14F3D",
              name: "Schleifen",
              meta: "2,8 Tage · Engpass: 14 Aufträge im Stau",
              amount: "2,8 T",
              previewText:
                "Schleifen ist aktuell der absolute Engpass. 14 Aufträge stauen sich hier, weil Maschine 2 in Wartung ist und der Krankenstand hoch ist. Es wird dringend empfohlen, die 2. Schicht zu aktivieren.",
            },
            {
              avatar: "P",
              avatarColor: "#FBBF24",
              name: "Politur",
              meta: "2,3 Tage · Wartung fällig in 3 Tagen",
              amount: "2,3 T",
              previewText:
                "Die Politur läuft an der Kapazitätsgrenze. Eine geplante Wartung an Poliermaschine 1 steht in 3 Tagen an.",
            },
            {
              avatar: "G",
              avatarColor: "#34D399",
              name: "Galvanik",
              meta: "1,9 Tage · Stabil, Nickelbad beobachten",
              amount: "1,9 T",
              previewText:
                "Galvanik läuft im Plan. Nickelbad 2 hat jedoch eine leicht abweichende Konzentration, bitte Parameter auf der Badregelkarte prüfen.",
            },
            {
              avatar: "V",
              avatarColor: "#60A5FA",
              name: "Vorbereitung",
              meta: "1,2 Tage · Unterausgelastet — Express möglich",
              amount: "1,2 T",
              previewText:
                "Vorbereitung ist aktuell unterausgelastet. Hier könnten Express-Chargen vorgezogen werden, um Leerlauf zu vermeiden.",
            },
            {
              avatar: "Q",
              avatarColor: "#A78BFA",
              name: "QK und Versand",
              meta: "1,2 Tage · Stabil",
              amount: "1,2 T",
              previewText:
                "Qualitätskontrolle und Versand laufen ohne besondere Vorkommnisse.",
            },
          ],
        }}
        crossKpi={[
          {
            label: "KW22 vs. Vorjahr",
            value: "−9 Pkt.",
            delta: "85% → 76%",
            deltaColor: "var(--neg)",
            accentColor: "var(--neg)",
          },
          {
            label: "Überfällige Aufträge",
            value: "8",
            delta: "Station Schleifen",
            deltaColor: "var(--neg)",
            accentColor: "var(--neg)",
          },
          {
            label: "Prognose",
            value: "72 %",
            delta: "Ohne Gegenmaßnahme",
            deltaColor: "var(--neg)",
            accentColor: "var(--warn)",
          },
        ]}
        insight={{
          body: "<b>Beobachtung:</b> Termintreue seit 4 Wochen rückläufig (85% → 76%). Hauptgrund: Engpass bei Schleifen (14 Aufträge) und verzögerte Zulieferungen.<br><b>Prognose:</b> Ohne Gegenmaßnahme sinkt die Termintreue bis Monatsende auf ca. 72%.<br><b>Empfehlung:</b> 2. Schicht Schleifen aktivieren. Express-Aufträge temporär auf Politur umleiten.",
          actions: [
            { label: "2. Schicht aktivieren" },
            { label: "Engpass-Aufträge anzeigen" },
          ],
        }}
        linkedAreas={[
          {
            label: "Auftragsbuch",
            href: "/orders",
            previewText:
              "Im Auftragsbuch sind aktuell 112 Aufträge im Umlauf. Davon haben 8 ein akutes Terminrisiko. Klicken Sie auf Vollständig öffnen, um die Liste zu filtern.",
          },
          {
            label: "Warendurchlauf",
            href: "/warendurchlauf",
            previewText:
              "Der Warendurchlauf zeigt einen massiven Rückstau an Station Schleifen. 94% Auslastung blockieren den Flow für nachgelagerte Stationen.",
          },
          { label: "Qualitätskontrolle", href: "/kontrolle" },
        ]}
      />
    </>
  );
}
