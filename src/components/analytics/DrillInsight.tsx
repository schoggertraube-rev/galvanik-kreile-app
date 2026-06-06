"use client";

import { Sparkles } from "lucide-react";

/**
 * Section E — Insight stub (B5/B6).
 * Shows a placeholder in B1. Regelbasiert (B5) and LLM (B6) follow later.
 */
export function DrillInsight() {
  return (
    <div style={{ padding: "18px 22px", borderTop: "0.5px solid rgba(20,18,12,0.08)" }}>
      <div style={{
        background: "linear-gradient(180deg, #EEEDFD, #FAF8F3)",
        borderRadius: 10,
        padding: "16px 18px",
      }}>
        {/* Header */}
        <div style={{
          display: "flex",
          alignItems: "center",
          gap: 8,
          fontSize: 11,
          fontWeight: 700,
          letterSpacing: 0.5,
          textTransform: "uppercase",
          color: "#3C3489",
          marginBottom: 10,
        }}>
          <Sparkles style={{ width: 15, height: 15 }} />
          E · Was Claude dazu sagt
          <span style={{
            background: "#3C3489",
            color: "#fff",
            padding: "2px 7px",
            borderRadius: 20,
            fontSize: 9.5,
            letterSpacing: 0.3,
          }}>
            Pro
          </span>
        </div>

        {/* Stub content */}
        <div style={{ fontSize: 13.5, lineHeight: 1.65, color: "#1B1A16" }}>
          <p>
            <strong>Beobachtung:</strong> Gas +18 %, Strom +9 %, Umsatz nur +4 %.
          </p>
          <p style={{ marginTop: 6 }}>
            <strong>Vermutung:</strong> Galvanikbad 2 läuft seit 04.06. nachts durch
            (sollte 22–06 Uhr aus sein). Vielleicht ein Thermostatfehler.
          </p>
          <p style={{ marginTop: 6 }}>
            <strong>Vorschlag:</strong> Badregelkarte Bad 2 und das Nachtabschaltungs-Protokoll prüfen.
          </p>
        </div>

        {/* CTA buttons */}
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginTop: 13 }}>
          <button style={{
            display: "inline-flex",
            alignItems: "center",
            gap: 7,
            padding: "7px 12px",
            background: "#FFFFFF",
            border: "0.5px solid rgba(20,18,12,0.16)",
            borderRadius: 7,
            color: "#1B1A16",
            fontSize: 12.5,
            fontFamily: "inherit",
            cursor: "pointer",
          }}>
            🛁 Badregelkarte Bad 2
          </button>
          <button style={{
            display: "inline-flex",
            alignItems: "center",
            gap: 7,
            padding: "7px 12px",
            background: "#FFFFFF",
            border: "0.5px solid rgba(20,18,12,0.16)",
            borderRadius: 7,
            color: "#1B1A16",
            fontSize: 12.5,
            fontFamily: "inherit",
            cursor: "pointer",
          }}>
            🔍 Nachtabschaltung prüfen
          </button>
          <button style={{
            display: "inline-flex",
            alignItems: "center",
            gap: 7,
            padding: "7px 12px",
            background: "#FFFFFF",
            border: "0.5px solid rgba(20,18,12,0.16)",
            borderRadius: 7,
            color: "#1B1A16",
            fontSize: 12.5,
            fontFamily: "inherit",
            cursor: "pointer",
          }}>
            ✅ Als erledigt markieren
          </button>
        </div>
      </div>
    </div>
  );
}
