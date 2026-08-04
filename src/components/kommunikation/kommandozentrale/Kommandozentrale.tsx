"use client";

import React, { useState, useEffect, useCallback, useRef, useMemo } from "react";
import {
  ChevronLeft, X, CreditCard, FileText, Activity, AlertTriangle,
  MessageSquare, User, Edit3, Calendar, Paperclip, Package,
  Check, Send, Image as ImageIcon, Phone, Mail, Globe, Smartphone
} from "lucide-react";
import { useClientDossier, ClientDossier } from "./hooks/useClientDossier";
import { useTopicRelevance, TileKey } from "./hooks/useTopicRelevance";
import { MatchResult } from "@/app/kommunikation/smartMatcher";
import { useErfassung } from "@/components/erfassung/ErfassungProvider";
import dynamic from "next/dynamic";
import "./kommandozentrale.css";

const VerlaufBars = dynamic(() => import("./charts/VerlaufBars"), { ssr: false, loading: () => <div style={{ height: 180, display: "grid", placeItems: "center", color: "var(--kz-ink-mute)" }}>Lade Chart...</div> });
const TrendLine = dynamic(() => import("./charts/TrendLine"), { ssr: false, loading: () => <div style={{ height: 180, display: "grid", placeItems: "center", color: "var(--kz-ink-mute)" }}>Lade Chart...</div> });
const Donut = dynamic(() => import("./charts/Donut"), { ssr: false, loading: () => <div style={{ height: 180, display: "grid", placeItems: "center", color: "var(--kz-ink-mute)" }}>Lade Chart...</div> });

/* ═══════════════════════════════════════════════════════════
   TYPES
   ═══════════════════════════════════════════════════════════ */

interface ChatMessage {
  id: string;
  from: "customer" | "kreile" | "system";
  channel: "email" | "phone" | "whatsapp" | "website" | "system";
  text: string;
  time: string;
  date?: string;
  attachment?: { name: string; size: string };
}

interface KommandozentraleProps {
  open: boolean;
  onClose: () => void;
  customerName: string;
  customerId: string | null;
  customerInitials: string;
  customerCity?: string;
  messages: ChatMessage[];
  matchData: MatchResult | null;
}

/* ═══════════════════════════════════════════════════════════
   TILE ICON MAP
   ═══════════════════════════════════════════════════════════ */

const TILE_ICON: Record<TileKey, React.ReactNode> = {
  zahlung: <CreditCard size={13} />,
  auftraege: <FileText size={13} />,
  historie: <Activity size={13} />,
  reklas: <AlertTriangle size={13} />,
  komm: <MessageSquare size={13} />,
  stamm: <User size={13} />,
  notizen: <Edit3 size={13} />,
  kalender: <Calendar size={13} />,
  anhaenge: <Paperclip size={13} />,
  ware: <Package size={13} />,
};

const CHANNEL_ICON: Record<string, { icon: React.ReactNode; label: string }> = {
  email: { icon: <Mail size={10} />, label: "📧 E-Mail" },
  phone: { icon: <Phone size={10} />, label: "📞 Telefonnotiz" },
  whatsapp: { icon: <Smartphone size={10} />, label: "💬 WhatsApp" },
  website: { icon: <Globe size={10} />, label: "🌐 Website" },
  system: { icon: <Phone size={10} />, label: "📞 Telefonnotiz" },
};

/* ═══════════════════════════════════════════════════════════
   INLINE HIGHLIGHTING
   ═══════════════════════════════════════════════════════════ */

const HIGHLIGHT_PATTERNS: { regex: RegExp; cls: string; tileKey: TileKey }[] = [
  { regex: /\b(A-\d{4}-\d{4})\b/g, cls: "kz-hl kz-hl-auftrag", tileKey: "auftraege" },
  { regex: /\b(Herr\s+\w+|Frau\s+\w+)\b/g, cls: "kz-hl kz-hl-kunde", tileKey: "stamm" },
  { regex: /\b(morgen|abholen|abholung|Abholung|fertig|Termin)\b/gi, cls: "kz-hl kz-hl-zeit", tileKey: "kalender" },
  { regex: /\b(bar|Zahlung|Rechnung|offen|bezahlen|€)\b/gi, cls: "kz-hl kz-hl-zahlung", tileKey: "zahlung" },
];

function highlightText(
  text: string,
  onHighlightClick: (key: TileKey) => void
): React.ReactNode[] {
  // Build a combined pattern
  const allPatterns = HIGHLIGHT_PATTERNS.map(p => `(${p.regex.source})`).join("|");
  const combinedRegex = new RegExp(allPatterns, "gi");

  const parts: React.ReactNode[] = [];
  let lastIndex = 0;
  let match: RegExpExecArray | null;

  while ((match = combinedRegex.exec(text)) !== null) {
    // Add text before match
    if (match.index > lastIndex) {
      parts.push(text.slice(lastIndex, match.index));
    }

    // Find which pattern matched
    const matchedText = match[0];
    let cls = "kz-hl kz-hl-kunde";
    let tileKey: TileKey = "stamm";

    for (const p of HIGHLIGHT_PATTERNS) {
      if (new RegExp(p.regex.source, "gi").test(matchedText)) {
        cls = p.cls;
        tileKey = p.tileKey;
        break;
      }
    }

    parts.push(
      <span
        key={`hl-${match.index}`}
        className={cls}
        onClick={(e) => { e.stopPropagation(); onHighlightClick(tileKey); }}
      >
        {matchedText}
      </span>
    );

    lastIndex = match.index + matchedText.length;
  }

  if (lastIndex < text.length) {
    parts.push(text.slice(lastIndex));
  }

  return parts.length > 0 ? parts : [text];
}

/* ═══════════════════════════════════════════════════════════
   TILE RENDERERS
   ═══════════════════════════════════════════════════════════ */

function TileChevron() {
  return (
    <svg className="kz-th-chev" width="7" height="11" viewBox="0 0 8 13" fill="none" stroke="currentColor" strokeWidth="2">
      <polyline points="1.5 1.5 6.5 6.5 1.5 11.5" />
    </svg>
  );
}

function renderTileContent(key: TileKey, dossier: ClientDossier): React.ReactNode {
  switch (key) {
    case "zahlung":
      return (
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end" }}>
          <div>
            <div className="kz-tile-big warn">{dossier.payments.openTotal} €</div>
            <div className="kz-tile-unit">offen · {dossier.payments.invoices[0]?.daysOpen || 0} Tage</div>
          </div>
          <div style={{ textAlign: "right" }}>
            <div style={{ fontSize: 12, fontWeight: 600, color: "var(--kz-green)" }}>{dossier.payments.paymentMoral}</div>
            <div style={{ fontSize: 10, color: "var(--kz-ink-mute)" }}>⌀ {dossier.payments.avgDays} T. · {dossier.payments.preferredMethod}</div>
          </div>
        </div>
      );

    case "auftraege":
      return (
        <div className="kz-tile-rows">
          {dossier.openOrders.slice(0, 3).map(o => (
            <div key={o.id} className="kz-tr">
              <span className="l" style={{ color: "var(--kz-violet)", fontWeight: 600 }}>
                {o.orderNumber} · {o.material}
              </span>
              <span className={`kz-pill ${o.statusLabel.toLowerCase().includes("fertig") ? "kz-pill-done" : "kz-pill-prog"}`}>
                {o.statusLabel}
              </span>
            </div>
          ))}
        </div>
      );

    case "historie":
      return (
        <>
          <div className="kz-tile-big">{dossier.orderStats.total}</div>
          <div className="kz-tile-unit">Aufträge gesamt</div>
          <div className="kz-mini-bars">
            {dossier.orderStats.yearlyTrend.map((y, i) => (
              <i key={i} style={{ height: `${(y.count / 10) * 100}%` }} className={i >= 4 ? "hi" : ""} />
            ))}
          </div>
        </>
      );

    case "reklas":
      return (
        <>
          <div className={`kz-tile-big ${dossier.complaints.count === 0 ? "good" : "warn"}`}>
            {dossier.complaints.count}
          </div>
          <div className="kz-tile-unit">{dossier.complaints.count === 0 ? "saubere Weste" : `in ${dossier.complaints.totalOrders} Aufträgen`}</div>
        </>
      );

    case "komm":
      return (
        <div className="kz-tile-rows">
          <div className="kz-tr"><span className="l">📧 E-Mail</span><span className="v">{dossier.commStats.email}</span></div>
          <div className="kz-tr"><span className="l">📞 Telefon</span><span className="v">{dossier.commStats.phone}</span></div>
          <div className="kz-tr"><span className="l">💬 WhatsApp</span><span className="v">{dossier.commStats.whatsapp}</span></div>
        </div>
      );

    case "stamm":
      return (
        <div className="kz-tile-rows">
          <div className="kz-tr"><span className="l">Telefon</span><span className="v">{dossier.stamm.phone}</span></div>
          <div className="kz-tr"><span className="l">Adresse</span><span className="v">{dossier.stamm.city}</span></div>
        </div>
      );

    case "notizen":
      return (
        <div style={{ fontSize: 12, color: "var(--kz-ink-mute)" }}>
          „{dossier.stamm.notes.slice(0, 80)}{dossier.stamm.notes.length > 80 ? "…" : ""}&quot;
        </div>
      );

    case "kalender":
      return (
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <div style={{ background: "var(--kz-green-bright)", color: "white", borderRadius: 9, padding: "7px 12px", textAlign: "center" }}>
            <div style={{ fontSize: 9, fontWeight: 700, opacity: 0.85 }}>DO</div>
            <div style={{ fontFamily: "'Fraunces',serif", fontSize: 19 }}>4</div>
          </div>
          <div>
            <div style={{ fontSize: 13, fontWeight: 600, color: "var(--kz-green)" }}>
              {dossier.calendar.requestedTime} frei ✓
            </div>
            <div style={{ fontSize: 11, color: "var(--kz-ink-mute)" }}>
              keine Kollision · Öffnungszeiten OK
            </div>
          </div>
        </div>
      );

    case "anhaenge":
      return (
        <div className="kz-tile-rows">
          {dossier.attachments.map((a, i) => (
            <div key={i} className="kz-tr">
              <span className="l">{a.type === "image" ? "🖼" : "📄"} {a.name}</span>
              <span className="v" style={{ fontSize: 10, color: "var(--kz-ink-mute)" }}>{a.date}</span>
            </div>
          ))}
        </div>
      );

    case "ware":
      return (
        <div className="kz-qa-grid">
          <button className="kz-qa-btn">
            <span className="kz-qa-ic" style={{ background: "var(--kz-blue-soft)", color: "var(--kz-blue)" }}>
              <Package size={10} />
            </span>
            Wo ist Ware?
          </button>
          <button className="kz-qa-btn">
            <span className="kz-qa-ic" style={{ background: "var(--kz-orange-soft)", color: "var(--kz-orange)" }}>
              <CreditCard size={10} />
            </span>
            Zahlung
          </button>
        </div>
      );

    default:
      return null;
  }
}

/* ═══════════════════════════════════════════════════════════
   TILE CONFIG
   ═══════════════════════════════════════════════════════════ */

interface TileConfig {
  key: TileKey;
  title: string;
  defaultSpan: 1 | 2;
  hasChevron: boolean;
}

const LEFT_TILES: TileConfig[] = [
  { key: "zahlung", title: "Zahlung", defaultSpan: 2, hasChevron: true },
  { key: "auftraege", title: "Offene Aufträge", defaultSpan: 2, hasChevron: true },
  { key: "historie", title: "Verlauf", defaultSpan: 1, hasChevron: false },
  { key: "reklas", title: "Reklas", defaultSpan: 1, hasChevron: false },
  { key: "komm", title: "Kommunikation", defaultSpan: 2, hasChevron: true },
  { key: "stamm", title: "Stammdaten", defaultSpan: 2, hasChevron: true },
  { key: "notizen", title: "Notizen & Tags", defaultSpan: 2, hasChevron: false },
];

const RIGHT_TILES: TileConfig[] = [
  { key: "kalender", title: "Wunschtermin: morgen", defaultSpan: 2, hasChevron: true },
  { key: "anhaenge", title: "Anhänge dieses Klienten", defaultSpan: 2, hasChevron: true },
  { key: "ware", title: "Schnellzugriff", defaultSpan: 2, hasChevron: false },
];

/* ═══════════════════════════════════════════════════════════
   DETAIL OVERLAY (simplified for Phase A, extended in Phase C)
   ═══════════════════════════════════════════════════════════ */

function DetailOverlay({
  tileKey, dossier, onClose,
}: {
  tileKey: TileKey;
  dossier: ClientDossier;
  onClose: () => void;
}) {
  const DETAIL_INFO: Record<TileKey, { title: string; subtitle: string; bgClass: string }> = {
    zahlung: { title: "Zahlung", subtitle: `${dossier.stamm.name} · alle Belege`, bgClass: "kz-orange-soft" },
    auftraege: { title: "Aufträge", subtitle: `${dossier.openOrders.length} offen · ${dossier.orderStats.total} gesamt`, bgClass: "kz-violet-soft" },
    historie: { title: "Auftragsverlauf", subtitle: `${dossier.orderStats.total} Aufträge seit 2018`, bgClass: "kz-blue-soft" },
    reklas: { title: "Reklamationen", subtitle: dossier.stamm.name, bgClass: "kz-green-soft" },
    komm: { title: "Kommunikation", subtitle: `${dossier.commStats.total} Kontakte über alle Kanäle`, bgClass: "kz-green-soft" },
    stamm: { title: "Stammdaten", subtitle: dossier.stamm.name, bgClass: "kz-cream-3" },
    notizen: { title: "Notizen & Tags", subtitle: dossier.stamm.name, bgClass: "kz-cream-3" },
    kalender: { title: "Wunschtermin prüfen", subtitle: "Abholung Müller · morgen", bgClass: "kz-orange-soft" },
    anhaenge: { title: "Anhänge", subtitle: `alle Dateien ${dossier.stamm.name}`, bgClass: "kz-cream-3" },
    ware: { title: "Wo ist die Ware?", subtitle: "A-2026-0042", bgClass: "kz-blue-soft" },
  };

  const info = DETAIL_INFO[tileKey];
  const bgColorMap: Record<string, string> = {
    "kz-orange-soft": "background: var(--kz-orange-soft); color: var(--kz-orange);",
    "kz-violet-soft": "background: var(--kz-violet-soft); color: var(--kz-violet);",
    "kz-blue-soft": "background: var(--kz-blue-soft); color: var(--kz-blue);",
    "kz-green-soft": "background: var(--kz-green-soft); color: var(--kz-green);",
    "kz-cream-3": "background: var(--kz-cream-3); color: var(--kz-ink-soft);",
  };

  return (
    <div className="kz-det-bd" onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="kz-det">
        <div className="kz-det-head">
          <div className="kz-det-head-left">
            <div className="kz-det-icon" style={Object.fromEntries((bgColorMap[info.bgClass] || "").split(";").filter(Boolean).map(s => { const [k,v] = s.split(":"); return [k.trim(), v?.trim()]; }))}>
              {TILE_ICON[tileKey]}
            </div>
            <div>
              <h2>{info.title}</h2>
              <div className="ds">{info.subtitle}</div>
            </div>
          </div>
          <button className="kz-close" onClick={onClose}>
            <X size={14} />
          </button>
        </div>
        <div className="kz-det-body">
          {renderDetailBody(tileKey, dossier)}
        </div>
        <div className="kz-det-foot">
          <button className="kz-dbtn" onClick={onClose}>Schließen</button>
          {renderDetailActions(tileKey).map((a, i) => (
            <button key={i} className={`kz-dbtn ${i === 0 ? "primary" : ""}`}>{a}</button>
          ))}
        </div>
      </div>
    </div>
  );
}

function renderDetailActions(key: TileKey): string[] {
  const map: Record<TileKey, string[]> = {
    zahlung: ["Zahlungserinnerung", "Als bezahlt markieren"],
    auftraege: ["Auftrag öffnen"],
    historie: [],
    reklas: [],
    komm: [],
    stamm: ["Bearbeiten"],
    notizen: ["Notiz bearbeiten"],
    kalender: ["Termin eintragen"],
    anhaenge: ["Alle herunterladen"],
    ware: ["Etikett drucken"],
  };
  return map[key] || [];
}

function renderDetailBody(key: TileKey, dossier: ClientDossier): React.ReactNode {
  switch (key) {
    case "zahlung":
      return (
        <>
          <div className="kz-scorecards">
            <div className="kz-scorecard"><div className="sc-num warn">{dossier.payments.openTotal} €</div><div className="sc-lbl">offen</div></div>
            <div className="kz-scorecard"><div className="sc-num good">{dossier.payments.avgDays}</div><div className="sc-lbl">⌀ Tage bis Zahlung</div></div>
            <div className="kz-scorecard"><div className="sc-num good">{dossier.payments.paymentQuote} %</div><div className="sc-lbl">Quote 12 Mon.</div></div>
          </div>
          <div className="kz-chart-card">
            <div className="kz-chart-title">Zahlungsverlauf (6 Monate)</div>
            <VerlaufBars data={dossier.payments.monthlyHistory} />
            <div className="kz-legend" style={{ justifyContent: "center" }}>
              <div className="kz-legend-item"><div className="kz-legend-dot" style={{ background: "var(--kz-green-soft)" }}/>Bezahlt</div>
              <div className="kz-legend-item"><div className="kz-legend-dot" style={{ background: "var(--kz-orange)" }}/>Offen</div>
            </div>
          </div>
          <div className="kz-chart-card">
            <div className="kz-chart-title">Offene Belege</div>
            <table className="kz-data-table">
              <thead><tr><th>Rechnung</th><th>Datum</th><th>Betrag</th><th>Status</th></tr></thead>
              <tbody>
                {dossier.payments.invoices.map(inv => (
                  <tr key={inv.number}><td>{inv.number}</td><td>{inv.date}</td><td>{inv.amount} €</td><td><span className="kz-pill kz-pill-open">offen · {inv.daysOpen} T.</span></td></tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      );

    case "auftraege":
      return (
        <>
          <div className="kz-chart-card">
            <div className="kz-chart-title">Auftragsvolumen (Trend)</div>
            <TrendLine data={dossier.orderStats.yearlyTrend} />
          </div>
          <div className="kz-chart-card">
            <div className="kz-chart-title">Aktuell offen</div>
            <table className="kz-data-table">
              <thead><tr><th>Nr.</th><th>Beschr.</th><th>Material</th><th>Status</th><th>Termin</th></tr></thead>
              <tbody>
                {dossier.openOrders.map(o => (
                  <tr key={o.id}>
                    <td><b>{o.orderNumber}</b></td><td>{o.description}</td><td>{o.material}</td>
                    <td><span className={`kz-pill ${o.statusLabel.toLowerCase().includes("fertig") ? "kz-pill-done" : "kz-pill-prog"}`}>{o.statusLabel}</span></td>
                    <td>{o.dueDate}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      );

    case "historie":
      return (
        <>
          <div className="kz-scorecards">
            <div className="kz-scorecard"><div className="sc-num">{dossier.orderStats.total}</div><div className="sc-lbl">Aufträge</div></div>
            <div className="kz-scorecard"><div className="sc-num">~{dossier.orderStats.revenue} €</div><div className="sc-lbl">Umsatz</div></div>
            <div className="kz-scorecard"><div className="sc-num good">{dossier.orderStats.vsLastYear}</div><div className="sc-lbl">vs. Vorjahr</div></div>
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
            <div className="kz-chart-card">
              <div className="kz-chart-title">Material-Verteilung</div>
              <Donut 
                data={dossier.orderStats.materialBreakdown} 
                centerLabel="Aufträge"
                centerValue={dossier.orderStats.total}
              />
              <div className="kz-legend">
                {dossier.orderStats.materialBreakdown.map((m, i) => (
                  <div key={i} className="kz-legend-item"><div className="kz-legend-dot" style={{ background: m.color }}/>{m.label} ({m.value}%)</div>
                ))}
              </div>
            </div>
            <div className="kz-chart-card">
              <div className="kz-chart-title">Volumen nach Jahr</div>
              <TrendLine data={dossier.orderStats.yearlyTrend} />
            </div>
          </div>
        </>
      );

    case "komm":
      return (
        <>
          <div className="kz-chart-card">
            <div className="kz-chart-title">Kontaktverlauf (6 Monate)</div>
            <VerlaufBars data={dossier.commStats.monthlyHistory.map(m => ({ month: m.month, paid: m.count, open: 0 }))} />
          </div>
          <div className="kz-chart-card">
            <div className="kz-chart-title">Kanäle</div>
            <table className="kz-data-table">
              <tbody>
                <tr><td style={{ color: "var(--kz-ink-mute)" }}>📧 E-Mail</td><td><b>{dossier.commStats.email}</b></td></tr>
                <tr><td style={{ color: "var(--kz-ink-mute)" }}>📞 Telefon</td><td><b>{dossier.commStats.phone}</b></td></tr>
                <tr><td style={{ color: "var(--kz-ink-mute)" }}>💬 WhatsApp</td><td><b>{dossier.commStats.whatsapp}</b></td></tr>
              </tbody>
            </table>
          </div>
        </>
      );

    case "stamm":
      return (
        <div className="kz-chart-card">
          <table className="kz-data-table">
            <tbody>
              <tr><td style={{ color: "var(--kz-ink-mute)", width: "35%" }}>Name</td><td><b>{dossier.stamm.name}</b></td></tr>
              <tr><td style={{ color: "var(--kz-ink-mute)" }}>Telefon</td><td>{dossier.stamm.phone}</td></tr>
              <tr><td style={{ color: "var(--kz-ink-mute)" }}>E-Mail</td><td>{dossier.stamm.email}</td></tr>
              <tr><td style={{ color: "var(--kz-ink-mute)" }}>Adresse</td><td>{dossier.stamm.address}, {dossier.stamm.city}</td></tr>
              <tr><td style={{ color: "var(--kz-ink-mute)" }}>Seit</td><td>{dossier.stamm.since}</td></tr>
              <tr><td style={{ color: "var(--kz-ink-mute)" }}>Kanal</td><td>{dossier.stamm.preferredChannel} bevorzugt</td></tr>
              <tr><td style={{ color: "var(--kz-ink-mute)" }}>Zahlart</td><td>{dossier.stamm.paymentMethod}</td></tr>
            </tbody>
          </table>
        </div>
      );

    case "reklas":
      return (
        <div className="kz-chart-card" style={{ textAlign: "center", padding: "30px 18px" }}>
          <div style={{ width: 56, height: 56, borderRadius: "50%", background: "var(--kz-green-soft)", color: "var(--kz-green)", display: "grid", placeItems: "center", margin: "0 auto 14px" }}>
            <Check size={26} />
          </div>
          <div style={{ fontFamily: "'Fraunces',serif", fontSize: 20 }}>Keine Reklamationen</div>
          <div style={{ fontSize: 12, color: "var(--kz-ink-mute)", marginTop: 5 }}>0 in {dossier.complaints.totalOrders} Aufträgen · A-Kunde</div>
        </div>
      );

    case "kalender":
      return (
        <>
          <div className="kz-chart-card">
            <div className="kz-chart-title">{dossier.calendar.requestedDate}</div>
            <div style={{ display: "flex", flexDirection: "column", gap: 5 }}>
              {dossier.calendar.daySlots.map((slot, i) => (
                <div key={i} style={{ display: "flex", gap: 8, alignItems: "center" }}>
                  <div style={{ width: 44, fontSize: 10, color: "var(--kz-ink-mute)" }}>{slot.time}</div>
                  <div style={{
                    flex: 1, height: 28, borderRadius: 5, display: "flex", alignItems: "center", padding: "0 10px", fontSize: 10, fontWeight: 600,
                    background: slot.status === "suggested" ? "var(--kz-green-soft)" : slot.status === "booked" ? "var(--kz-red-soft)" : "var(--kz-cream-2)",
                    color: slot.status === "suggested" ? "var(--kz-green)" : slot.status === "booked" ? "var(--kz-red)" : "transparent",
                  }}>
                    {slot.label}
                  </div>
                </div>
              ))}
            </div>
          </div>
          {dossier.calendar.isFree && (
            <div className="kz-chart-card" style={{ background: "var(--kz-green-soft)", borderColor: "var(--kz-green-soft)" }}>
              <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                <Check size={18} style={{ color: "var(--kz-green)" }} />
                <div style={{ fontSize: 12, color: "var(--kz-green)", fontWeight: 600 }}>
                  {dossier.calendar.requestedTime} frei · keine Kollision · innerhalb Öffnungszeiten · niemand abwesend
                </div>
              </div>
            </div>
          )}
        </>
      );

    case "anhaenge":
      return (
        <div className="kz-chart-card">
          <table className="kz-data-table">
            <thead><tr><th>Datei</th><th>Auftrag</th><th>Datum</th></tr></thead>
            <tbody>
              {dossier.attachments.map((a, i) => (
                <tr key={i}><td>{a.type === "image" ? "🖼" : "📄"} {a.name}</td><td>{a.orderId}</td><td>{a.date}</td></tr>
              ))}
            </tbody>
          </table>
        </div>
      );

    case "ware":
      return (
        <>
          <div className="kz-chart-card">
            <div className="kz-chart-title">Aktueller Standort</div>
            <div style={{ display: "flex", alignItems: "center", gap: 6, margin: "4px 0" }}>
              <div style={{ flex: 1, textAlign: "center" }}>
                <div style={{ width: 30, height: 30, borderRadius: "50%", background: "var(--kz-green-soft)", color: "var(--kz-green)", display: "grid", placeItems: "center", margin: "0 auto" }}>
                  <Check size={13} />
                </div>
                <div style={{ fontSize: 9, marginTop: 3 }}>Bad 3 Zink</div>
              </div>
              <div style={{ flex: 1, height: 2, background: "var(--kz-green-bright)" }} />
              <div style={{ flex: 1, textAlign: "center" }}>
                <div style={{ width: 30, height: 30, borderRadius: "50%", background: "var(--kz-blue-soft)", color: "var(--kz-blue)", display: "grid", placeItems: "center", margin: "0 auto", border: "2px solid var(--kz-blue-mid)" }}>
                  <Package size={13} />
                </div>
                <div style={{ fontSize: 9, marginTop: 3, fontWeight: 600 }}>Verpackung</div>
              </div>
              <div style={{ flex: 1, height: 2, background: "var(--kz-cream-3)" }} />
              <div style={{ flex: 1, textAlign: "center", opacity: 0.5 }}>
                <div style={{ width: 30, height: 30, borderRadius: "50%", background: "var(--kz-cream-2)", display: "grid", placeItems: "center", margin: "0 auto" }}>
                  <Check size={13} />
                </div>
                <div style={{ fontSize: 9, marginTop: 3 }}>Übergabe</div>
              </div>
            </div>
          </div>
          <div className="kz-chart-card">
            <table className="kz-data-table">
              <tbody>
                <tr><td style={{ color: "var(--kz-ink-mute)" }}>Bad 3 abgeschlossen</td><td><b>heute 11:02</b></td></tr>
                <tr><td style={{ color: "var(--kz-ink-mute)" }}>Bereit zur Übergabe</td><td><b>ab 14:00</b></td></tr>
                <tr><td style={{ color: "var(--kz-ink-mute)" }}>Versandetikett</td><td><b>noch nicht gedruckt</b></td></tr>
              </tbody>
            </table>
          </div>
        </>
      );

    case "notizen":
      return (
        <>
          <div className="kz-chart-card">
            <div style={{ fontSize: 13, color: "var(--kz-ink-soft)", lineHeight: 1.6 }}>
              „{dossier.stamm.notes}&quot;
            </div>
          </div>
          <div className="kz-chart-card">
            <div className="kz-chart-title">Tags</div>
            <div style={{ display: "flex", gap: 5, flexWrap: "wrap" }}>
              {dossier.stamm.tags.map(t => (
                <span key={t} className={`kz-htag ${t === "A-Kunde" ? "gold" : ""}`}>{t}</span>
              ))}
              <span className="kz-htag">Sammler</span>
            </div>
          </div>
        </>
      );

    default:
      return <div style={{ padding: 20, color: "var(--kz-ink-mute)" }}>Detail wird geladen…</div>;
  }
}

/* ═══════════════════════════════════════════════════════════
   MAIN COMPONENT
   ═══════════════════════════════════════════════════════════ */

export function Kommandozentrale({
  open, onClose, customerName, customerId, customerInitials, customerCity, messages, matchData,
}: KommandozentraleProps) {
  const [mode, setMode] = useState<"smart" | "alles">("smart");
  const [activeDetail, setActiveDetail] = useState<TileKey | null>(null);
  const [actionsApplied, setActionsApplied] = useState(false);
  const [showToast, setShowToast] = useState(false);
  const [composerOverride, setComposerOverride] = useState<string | null>(null);
  const chatEndRef = useRef<HTMLDivElement>(null);
  const { openErfassung } = useErfassung();

  const dossier = useClientDossier(customerId, matchData);
  const composerText = composerOverride ?? dossier.suggestedAnswer;
  const messageTexts = useMemo(() => messages.map(m => m.text), [messages]);
  const { relevantKeys } = useTopicRelevance(messageTexts, matchData);

  // Auto-scroll chat
  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages.length]);

  const handleClose = useCallback(() => {
    if (!actionsApplied && dossier.preparedActions.length > 0) {
      // Anti-Sackgasse: show toast
      setShowToast(true);
      setTimeout(() => {
        setShowToast(false);
        onClose();
      }, 2500);
    } else {
      onClose();
    }
  }, [actionsApplied, dossier.preparedActions.length, onClose]);

  // ESC handler — layer-aware
  useEffect(() => {
    if (!open) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        if (activeDetail) {
          setActiveDetail(null);
        } else {
          handleClose();
        }
      }
    };
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, [open, activeDetail, handleClose]);

  const handleApplyAll = useCallback(() => {
    // Phase 4: Route to central flow for quotes
    if (customerId) {
      openErfassung({
        mode: "order",
        intent: "create_quote",
        customerId: customerId,
        source: "inquiry",
        sourceRef: `inquiry_${Date.now()}`,
        prefill: {
          customer: matchData?.matchedCustomer || { id: customerId, name: customerName, city: customerCity },
          order: matchData?.matchedOrder || null,
        }
      });
    } else {
      openErfassung({
        mode: "gate",
        intent: "create_quote",
        source: "inquiry",
        sourceRef: `inquiry_${Date.now()}`,
        prefill: {
          rawText: messages.map(m => m.text).join('\n')
        }
      });
    }
    setActionsApplied(true);
  }, [openErfassung, matchData, customerId, customerName, customerCity, messages]);

  const handleHighlightClick = useCallback((key: TileKey) => {
    setActiveDetail(key);
  }, []);

  if (!open) return null;

  // Sort tiles: relevant first in smart mode
  const sortTiles = (tiles: TileConfig[]) => {
    if (mode === "alles") return tiles;
    return [...tiles].sort((a, b) => {
      const aRel = relevantKeys.has(a.key) ? 0 : 1;
      const bRel = relevantKeys.has(b.key) ? 0 : 1;
      return aRel - bRel;
    });
  };

  return (
    <div className="kz-overlay" data-testid="kommandozentrale-overlay">
      <div className="kz">

        {/* ═══ HEADER ═══ */}
        <header className="kz-head">
          <div className="kz-left">
            <button className="kz-back" onClick={handleClose}>
              <ChevronLeft size={16} />
              Zurück
            </button>
            <div className="kz-sep" />
            <div className="kz-ava">{customerInitials}</div>
            <div className="kz-info">
              <h1>{customerName}</h1>
              <div className="kz-tags">
                <span className="kz-htag gold">A-Kunde</span>
                <span className="kz-htag">{customerCity || "—"} · seit {dossier.stamm.since}</span>
                <span className="kz-htag good">{dossier.orderStats.total} Aufträge</span>
              </div>
            </div>
          </div>
          <div className="kz-right">
            <div className="kz-mode-pill">
              <button className={`kz-mode-opt ${mode === "smart" ? "active" : ""}`} onClick={() => setMode("smart")}>Smart</button>
              <button className={`kz-mode-opt ${mode === "alles" ? "active" : ""}`} onClick={() => setMode("alles")}>Alles</button>
            </div>
            <button className="kz-close" onClick={handleClose}>
              <X size={15} />
            </button>
          </div>
        </header>

        {/* ═══ BODY: 3 COLUMNS ═══ */}
        <div className="kz-body">

          {/* ── LEFT: Klient ── */}
          <div className="kz-bento" data-testid="kz-bento-left">
            <div className="kz-bento-label">Klient</div>
            {sortTiles(LEFT_TILES).map(tile => {
              const isRelevant = relevantKeys.has(tile.key);
              const isDim = mode === "smart" && !isRelevant;
              const span = isRelevant ? 2 : tile.defaultSpan;
              return (
                <div
                  key={tile.key}
                  className={`kz-tile ${span === 2 ? "span2" : ""} ${isRelevant ? "relevant" : ""} ${isDim ? "dim" : ""}`}
                  onClick={() => setActiveDetail(tile.key)}
                  data-testid={`kz-tile-${tile.key}`}
                >
                  <div className="kz-th">
                    <div className="kz-th-icon">{TILE_ICON[tile.key]}</div>
                    <div className="kz-th-title">{tile.title}</div>
                    {tile.hasChevron && <TileChevron />}
                  </div>
                  {renderTileContent(tile.key, dossier)}
                </div>
              );
            })}
          </div>

          {/* ── CENTER: Chat ── */}
          <div className="kz-chat" data-testid="kz-chat-center">
            <div className="kz-cc-stream">
              {messages.map(msg => (
                <React.Fragment key={msg.id}>
                  {msg.date && (
                    <div className="kz-date-div"><span>{msg.date}</span></div>
                  )}

                  {msg.attachment ? (
                    <div className={`kz-cb in att`} onClick={() => setActiveDetail("anhaenge")}>
                      <div className="kz-att-thumb">
                        <ImageIcon size={16} />
                      </div>
                      <div className="kz-att-meta">
                        <div className="an">{msg.attachment.name}</div>
                        <div className="as">📎 {msg.attachment.size}</div>
                      </div>
                    </div>
                  ) : msg.from === "system" ? (
                    <div className={`kz-cb in`}>
                      <div className="chan">
                        {CHANNEL_ICON[msg.channel]?.label || msg.channel.toUpperCase()} · {msg.time}
                      </div>
                      {highlightText(msg.text, handleHighlightClick)}
                      <span className="bt">{msg.time}</span>
                    </div>
                  ) : msg.from === "kreile" ? (
                    <div className="kz-cb out">
                      {msg.text}
                      <span className="bt">{msg.time}</span>
                    </div>
                  ) : (
                    <div className="kz-cb in">
                      <div className="chan">
                        {CHANNEL_ICON[msg.channel]?.label || msg.channel.toUpperCase()} · {customerName.split("·")[0].trim().split(" ").pop()}
                      </div>
                      {highlightText(msg.text, handleHighlightClick)}
                      <span className="bt">{msg.time}</span>
                    </div>
                  )}
                </React.Fragment>
              ))}
              <div ref={chatEndRef} style={{ height: 1 }} />
            </div>

            {/* Composer */}
            <div className="kz-cc-comp">
              <button className="kz-cc-icon" title="Anhang">
                <Paperclip size={15} />
              </button>
              <input
                className="kz-cc-input"
                value={composerText}
                onChange={e => setComposerOverride(e.target.value)}
                placeholder="Antwort schreiben…"
              />
              <button className="kz-cc-send">
                <Send size={15} />
              </button>
            </div>
          </div>

          {/* ── RIGHT: Dieser Vorgang ── */}
          <div className="kz-bento" data-testid="kz-bento-right">
            <div className="kz-bento-label">Dieser Vorgang</div>

            {/* Prepared Actions (dark card) */}
            <div className="kz-sug" data-testid="kz-prepared-actions">
              {!actionsApplied ? (
                <>
                  <div className="sl">Vorbereitet — ein Klick</div>
                  <div className="kz-act">
                    {dossier.preparedActions.map(a => (
                      <div key={a.id} className="kz-act-i">
                        <div className={`kz-act-t ${a.tag === "prüfen" ? "warn" : ""}`}>
                          {a.tag === "prüfen" ? <AlertTriangle size={8} /> : <Check size={8} />}
                        </div>
                        <span style={{ color: "rgba(250,246,238,.9)" }}>{a.label}</span>
                        <span className={`kz-at ${a.tag === "auto" ? "kz-at-auto" : "kz-at-warn"}`}>{a.tag}</span>
                      </div>
                    ))}
                  </div>
                  <div className="kz-sug-actions">
                    <button className="kz-sug-btn primary" onClick={handleApplyAll}>Alle anwenden</button>
                    <button className="kz-sug-btn">Einzeln</button>
                  </div>
                </>
              ) : (
                <div style={{ display: "flex", alignItems: "center", gap: 10, justifyContent: "center", padding: 6 }}>
                  <div style={{ width: 30, height: 30, borderRadius: "50%", background: "var(--kz-green-bright)", color: "white", display: "grid", placeItems: "center" }}>
                    <Check size={15} />
                  </div>
                  <div>
                    <div style={{ fontWeight: 700 }}>Erledigt</div>
                    <div style={{ fontSize: 11, color: "rgba(250,246,238,.6)" }}>{dossier.preparedActions.length} Aktionen verteilt</div>
                  </div>
                </div>
              )}
            </div>

            {/* Kalender tile */}
            {sortTiles(RIGHT_TILES).map(tile => {
              const isRelevant = relevantKeys.has(tile.key);
              const isDim = mode === "smart" && !isRelevant;
              return (
                <div
                  key={tile.key}
                  className={`kz-tile span2 ${isRelevant ? "relevant" : ""} ${isDim ? "dim" : ""}`}
                  onClick={() => setActiveDetail(tile.key)}
                  data-testid={`kz-tile-${tile.key}`}
                >
                  <div className="kz-th">
                    <div className="kz-th-icon">{TILE_ICON[tile.key]}</div>
                    <div className="kz-th-title">{tile.title}</div>
                    {tile.hasChevron && <TileChevron />}
                  </div>
                  {renderTileContent(tile.key, dossier)}
                </div>
              );
            })}

            {/* Answer suggestion (cream card) */}
            <div className="kz-sug cream" data-testid="kz-answer-suggestion">
              <div className="sl">Antwort-Vorschlag</div>
              <p>„{dossier.suggestedAnswer}&quot;</p>
              <div className="kz-sug-actions">
                <button className="kz-sug-btn primary" onClick={() => setComposerOverride(dossier.suggestedAnswer)}>Übernehmen</button>
              </div>
            </div>
          </div>
        </div>

        {/* ═══ DETAIL OVERLAY ═══ */}
        {activeDetail && (
          <DetailOverlay
            tileKey={activeDetail}
            dossier={dossier}
            onClose={() => setActiveDetail(null)}
          />
        )}

        {/* ═══ TOAST ═══ */}
        <div className={`kz-toast ${showToast ? "show" : ""}`}>
          <span className="tt"><b>Zwischengespeichert.</b> Offene Aktion im Tagesfokus.</span>
          <button onClick={() => { setShowToast(false); onClose(); }}>OK</button>
        </div>
      </div>
    </div>
  );
}
