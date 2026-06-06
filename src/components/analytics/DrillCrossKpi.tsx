"use client";

import { Info } from "lucide-react";

interface DrillCrossKpiProps {
  inputs: Record<string, number | null>;
  kpiLabel: string;
}

interface CrossKpiCard {
  label: string;
  value: string;
  description: string;
  level: "gut" | "beobachten" | "kritisch" | "missing";
}

/**
 * Section D — computes cross-KPI ratios from REAL inputs.
 * If an input is null, the card shows "fehlt" with CTA.
 */
export function DrillCrossKpi({ inputs, kpiLabel }: DrillCrossKpiProps) {
  const cards = computeCards(inputs);

  if (cards.length === 0) return null;

  const LEVEL_BORDER: Record<string, string> = {
    gut: "var(--success-green, #5A8F4D)",
    beobachten: "var(--accent-orange, #E8943C)",
    kritisch: "var(--danger-red, #D14F3D)",
    missing: "var(--neutral-gray-300, #C8C2B5)",
  };

  return (
    <div style={{ padding: "18px 22px", borderTop: "0.5px solid var(--neutral-gray-100, #ECE6D9)" }}>
      <div style={{
        fontSize: 10.5, fontWeight: 600, letterSpacing: 0.7,
        textTransform: "uppercase", color: "var(--navy-700, #1A2845)",
        display: "flex", alignItems: "center", gap: 5,
      }}>
        D \u00B7 Verh\u00E4ltniszahlen
      </div>

      <div style={{ display: "flex", gap: 12, marginTop: 11, overflowX: "auto", paddingBottom: 4 }}>
        {cards.map((card) => (
          <div
            key={card.label}
            style={{
              flex: "0 0 200px",
              background: card.level === "missing"
                ? "repeating-linear-gradient(45deg, var(--bg-app-soft, #FAF6EC), var(--bg-app-soft) 10px, var(--surface-tinted-soft, #F2E9D8) 10px, var(--surface-tinted-soft) 20px)"
                : "var(--surface-card, #FFFFFF)",
              borderRadius: "var(--radius-sm, 8px)",
              padding: "13px 14px",
              boxShadow: "var(--shadow-card)",
              borderTop: `3px solid ${LEVEL_BORDER[card.level]}`,
            }}
          >
            <div style={{
              fontSize: 11.5, color: "var(--text-muted, #7A7466)",
              marginBottom: 5,
            }}>
              {card.label}
            </div>

            <div style={{
              fontSize: 23, fontWeight: 680, letterSpacing: -0.3,
              color: card.level === "missing" ? "var(--text-muted)" : "var(--navy-900)",
            }}>
              {card.value}
            </div>

            <div style={{
              fontSize: 11.5, marginTop: 4,
              color: card.level === "kritisch" ? "var(--danger-red)" : card.level === "beobachten" ? "var(--accent-orange)" : "var(--text-muted)",
              fontWeight: card.level === "missing" ? 400 : 600,
            }}>
              {card.description}
            </div>
          </div>
        ))}
      </div>

      {/* Explanation */}
      <div style={{
        fontSize: 12.5, color: "#0C447C",
        background: "#E7F1FB", borderRadius: 7,
        padding: "9px 12px", marginTop: 10,
        display: "flex", gap: 8, alignItems: "flex-start", lineHeight: 1.55,
      }}>
        <Info style={{ width: 15, height: 15, flexShrink: 0, marginTop: 1 }} />
        <span>
          So liest du das: Diese Karten setzen die {kpiLabel}-Werte ins Verh\u00E4ltnis.
          Steigt ein Wert, frisst dieser Bereich mehr von deiner Marge.
          Fehlende Karten bedeuten, dass Eingangsdaten fehlen.
        </span>
      </div>
    </div>
  );
}

/**
 * Compute cross-KPI cards from real inputs.
 * Never invents numbers — if an input is null, marks as "missing".
 */
function computeCards(inputs: Record<string, number | null>): CrossKpiCard[] {
  const cards: CrossKpiCard[] = [];

  const umsatz = inputs.umsatz;
  const gesamtausgaben = inputs.gesamtausgaben;
  const deckungsbeitrag = inputs.deckungsbeitrag;
  const betriebsergebnis = inputs.betriebsergebnis;
  const auftraegeGesamt = inputs.auftraegeGesamt;
  const offenePosten = inputs.offenePosten;

  // Kostenquote: Gesamtausgaben / Umsatz
  if (gesamtausgaben !== undefined) {
    if (umsatz && umsatz > 0) {
      const ratio = (gesamtausgaben ?? 0) / umsatz;
      const pct = Math.round(ratio * 100);
      cards.push({
        label: "Kostenquote",
        value: `${pct} %`,
        description: pct > 80 ? "Kritisch: > 80 % des Umsatzes" : pct > 60 ? "Beobachten" : "Im Rahmen",
        level: pct > 80 ? "kritisch" : pct > 60 ? "beobachten" : "gut",
      });
    } else if (umsatz === null) {
      cards.push({
        label: "Kostenquote",
        value: "\u2014",
        description: "Umsatzdaten fehlen f\u00FCr diese Berechnung",
        level: "missing",
      });
    }
  }

  // Deckungsbeitrag-Marge
  if (deckungsbeitrag !== undefined && deckungsbeitrag !== null && umsatz && umsatz > 0) {
    const marge = Math.round((deckungsbeitrag / umsatz) * 100);
    cards.push({
      label: "DB-Marge",
      value: `${marge} %`,
      description: marge < 50 ? "Kritisch: < 50 %" : marge < 70 ? "Beobachten" : "Gesund",
      level: marge < 50 ? "kritisch" : marge < 70 ? "beobachten" : "gut",
    });
  }

  // Ergebnis-Marge
  if (betriebsergebnis !== undefined && betriebsergebnis !== null && umsatz && umsatz > 0) {
    const marge = Math.round((betriebsergebnis / umsatz) * 100);
    cards.push({
      label: "Ergebnis-Marge",
      value: `${marge} %`,
      description: marge < 5 ? "Kritisch: < 5 %" : marge < 15 ? "Beobachten" : "Gut",
      level: marge < 5 ? "kritisch" : marge < 15 ? "beobachten" : "gut",
    });
  }

  // Offene Posten vs. Umsatz
  if (offenePosten !== undefined && offenePosten !== null && umsatz && umsatz > 0) {
    const ratio = Math.round((offenePosten / umsatz) * 100);
    cards.push({
      label: "Forderungsquote",
      value: `${ratio} %`,
      description: ratio > 30 ? "Kritisch hoch" : ratio > 15 ? "Beobachten" : "Normal",
      level: ratio > 30 ? "kritisch" : ratio > 15 ? "beobachten" : "gut",
    });
  }

  // Kosten pro Auftrag
  if (gesamtausgaben !== undefined && gesamtausgaben !== null && auftraegeGesamt && auftraegeGesamt > 0) {
    const perOrder = Math.round(gesamtausgaben / auftraegeGesamt);
    cards.push({
      label: "Kosten je Auftrag",
      value: `${perOrder.toLocaleString("de-DE")} \u20AC`,
      description: perOrder > 300 ? "Hoch" : perOrder > 150 ? "Mittel" : "Niedrig",
      level: perOrder > 300 ? "kritisch" : perOrder > 150 ? "beobachten" : "gut",
    });
  }

  return cards;
}
