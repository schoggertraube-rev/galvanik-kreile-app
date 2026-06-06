/**
 * KPI Registry v2 — metadata + config only, NO hardcoded data.
 * All data comes from analyticsDataService.ts at runtime.
 */

import type { PeriodType } from "./plainLanguage";

export type KpiId = string;

export interface LinkedArea {
  label: string;
  href: string;
  icon: string;
  status?: "future";
}

export interface KpiDefinition {
  id: KpiId;
  label: string;
  subtitle: string;
  icon: string;
  accentGradient: string;     // CSS gradient for header
  accentColor: string;        // single color token
  source: "accounting" | "performance" | "operations";

  plainMeaning: string;
  infoKey: string;

  chartType: "donut" | "bar" | "horizontal-bar" | "sparkline" | "gauge";
  compositionLabel: string;   // "Belege" / "Aufträge" / "Reklamationen"

  linkedAreas: LinkedArea[];

  // Periods this KPI supports
  periods: PeriodType[];
}

// ── Registry ─────────────────────────────────────────────────────────

export const KPI_REGISTRY: Record<KpiId, KpiDefinition> = {
  energie: {
    id: "energie",
    label: "Energie",
    subtitle: "Strom \u00B7 Gas \u00B7 Heizung \u2014 Kostenkategorie der Buchhaltung",
    icon: "zap",
    accentGradient: "linear-gradient(135deg, var(--accent-orange), var(--gold-500))",
    accentColor: "var(--accent-orange)",
    source: "accounting",
    plainMeaning: "Was kostet dich Energie",
    infoKey: "energie",
    chartType: "sparkline", // Uses our new Line/Area chart
    compositionLabel: "Belege",
    periods: ["monat", "quartal"],
    linkedAreas: [
      { label: "BWA \u00B7 Position Energie", href: "/buchhaltung/bwa", icon: "bar-chart-3" },
      { label: "Ausgaben nach Kategorie", href: "/buchhaltung/ausgaben", icon: "wallet" },
      { label: "Kraftstoff & Kfz", href: "/buchhaltung/kraftstoff", icon: "fuel" },
    ],
  },

  kosten_kategorien: {
    id: "kosten_kategorien",
    label: "Ausgaben & Kosten",
    subtitle: "Alle Ausgaben gruppiert nach Kategorie \u2014 Buchhaltung",
    icon: "wallet",
    accentGradient: "linear-gradient(135deg, var(--accent-orange), var(--gold-500))",
    accentColor: "var(--accent-orange)",
    source: "accounting",
    plainMeaning: "Was gibst du aus",
    infoKey: "kosten_kategorien",
    chartType: "donut",
    compositionLabel: "Kategorien",
    periods: ["monat", "quartal"],
    linkedAreas: [
      { label: "BWA", href: "/buchhaltung/bwa", icon: "bar-chart-3" },
      { label: "Belege", href: "/buchhaltung/belege", icon: "receipt" },
      { label: "Kraftstoff", href: "/buchhaltung/kraftstoff", icon: "fuel" },
      { label: "Steuerprofil", href: "/buchhaltung/steuerprofil", icon: "banknote" },
    ],
  },

  bwa_ergebnis: {
    id: "bwa_ergebnis",
    label: "BWA / Betriebsergebnis",
    subtitle: "Einnahmen, Ausgaben, Ergebnis \u2014 Monats\u00FCbersicht",
    icon: "trending-up",
    accentGradient: "linear-gradient(135deg, var(--success-green), #7AB86E)",
    accentColor: "var(--success-green)",
    source: "accounting",
    plainMeaning: "Was bleibt am Ende \u00FCbrig",
    infoKey: "bwa_ergebnis",
    chartType: "horizontal-bar",
    compositionLabel: "Positionen",
    periods: ["monat", "quartal"],
    linkedAreas: [
      { label: "Ausgaben", href: "/buchhaltung/ausgaben", icon: "wallet" },
      { label: "Rechnungen", href: "/buchhaltung/rechnungen", icon: "file-check" },
      { label: "Export", href: "/buchhaltung/export", icon: "download" },
    ],
  },

  offene_posten: {
    id: "offene_posten",
    label: "Offene Posten",
    subtitle: "\u00DCberf\u00E4llige und offene Rechnungen \u2014 Forderungsmanagement",
    icon: "alert-circle",
    accentGradient: "linear-gradient(135deg, var(--danger-red), #E8704A)",
    accentColor: "var(--danger-red)",
    source: "accounting",
    plainMeaning: "Wer schuldet dir noch Geld",
    infoKey: "offene_posten",
    chartType: "horizontal-bar",
    compositionLabel: "Rechnungen",
    periods: ["monat"],
    linkedAreas: [
      { label: "Rechnungen", href: "/buchhaltung/rechnungen", icon: "file-check" },
      { label: "Zahlungsbereich", href: "/buchhaltung/zahlung", icon: "credit-card" },
    ],
  },

  on_time_rate: {
    id: "on_time_rate",
    label: "Termintreue",
    subtitle: "P\u00FCnktlich gelieferte Auftr\u00E4ge \u2014 Werkstatt-Performance",
    icon: "clock",
    accentGradient: "linear-gradient(135deg, var(--navy-900), var(--navy-500))",
    accentColor: "var(--navy-900)",
    source: "performance",
    plainMeaning: "Wie p\u00FCnktlich lieferst du",
    infoKey: "on_time_rate",
    chartType: "gauge",
    compositionLabel: "Gef\u00E4hrdete Auftr\u00E4ge",
    periods: ["monat"],
    linkedAreas: [
      { label: "Auftragsbuch", href: "/orders", icon: "package" },
      { label: "Warendurchlauf", href: "/warendurchlauf", icon: "activity" },
      { label: "Qualit\u00E4t", href: "/kontrolle", icon: "shield-check" },
    ],
  },

  reklamationen: {
    id: "reklamationen",
    label: "Reklamationen",
    subtitle: "Kundenbeschwerden nach Grund \u2014 Qualit\u00E4tsmanagement",
    icon: "alert-triangle",
    accentGradient: "linear-gradient(135deg, var(--danger-red), var(--accent-orange))",
    accentColor: "var(--danger-red)",
    source: "operations",
    plainMeaning: "Wie oft beschweren sich Kunden",
    infoKey: "reklamationen",
    chartType: "donut",
    compositionLabel: "Reklamationen",
    periods: ["monat", "quartal"],
    linkedAreas: [
      { label: "Auftragsbuch", href: "/orders", icon: "package" },
      { label: "Qualit\u00E4t", href: "/kontrolle", icon: "shield-check" },
    ],
  },

  kraftstoff: {
    id: "kraftstoff",
    label: "Kraftstoff & Kfz",
    subtitle: "Tankkosten, Verbrauch, Preisentwicklung",
    icon: "fuel",
    accentGradient: "linear-gradient(135deg, #2563EB, #60A5FA)",
    accentColor: "#2563EB",
    source: "accounting",
    plainMeaning: "Was kostet dich Sprit",
    infoKey: "kraftstoff",
    chartType: "bar",
    compositionLabel: "Standorte",
    periods: ["monat", "quartal"],
    linkedAreas: [
      { label: "Kraftstoff-Detail", href: "/buchhaltung/kraftstoff", icon: "fuel" },
      { label: "Ausgaben", href: "/buchhaltung/ausgaben", icon: "wallet" },
    ],
  },
};
