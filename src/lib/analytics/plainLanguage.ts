/**
 * Plain-language strings for the Analytics Drill Drawer.
 * Every number gets explained. No jargon. §2 P2/P3.
 */

// ── Meaning Pill texts ────────────────────────────────────────────────

export type MeaningLevel = "gut" | "beobachten" | "kritisch";

export const MEANING_LABELS: Record<MeaningLevel, string> = {
  gut: "im grünen Bereich",
  beobachten: "beobachten",
  kritisch: "auffällig hoch",
};

export const MEANING_ICONS: Record<MeaningLevel, string> = {
  gut: "check",
  beobachten: "alert-triangle",
  kritisch: "alert-triangle",
};

// ── "So liest du das" texts for trend charts ─────────────────────────

export function trendReadAs(kpiLabel: string, periodType: string): string {
  const periodName =
    periodType === "tag" ? "Tag" :
    periodType === "woche" ? "Kalenderwoche" :
    periodType === "quartal" ? "Quartal" : "Monat";

  return `So liest du das: Die orange Linie sind deine ${kpiLabel}-Kosten pro ${periodName}. Die gestrichelte Linie war letztes Jahr. Liegt Orange darüber, zahlst du mehr als damals.`;
}

// ── Cross-KPI explanation ────────────────────────────────────────────

export function crossKpiReadAs(kpiLabel: string): string {
  return `So liest du das: Diese Karten setzen die ${kpiLabel}-Kosten ins Verh\u00E4ltnis \u2014 z.\u00A0B. \u201Evon jedem Euro Umsatz gehen 23 Cent in ${kpiLabel}\u201C. Steigt der Wert, frisst ${kpiLabel} mehr von deiner Marge.`;
}

// ── Info popover content ─────────────────────────────────────────────

export interface InfoContent {
  title: string;
  formula?: string;
  explanation: string;
  colorLogic: string;
}

export const INFO_TEXTS: Record<string, InfoContent> = {
  energy_costs: {
    title: "Energiekosten gesamt",
    formula: 'Σ Belege Kategorie \u201EEnergie\u201C',
    explanation: "Summe aller erfassten Energiebelege im Zeitraum (Strom, Gas, Heizöl).",
    colorLogic: 'Rot/\u201Eauff\u00E4llig\u201C = mehr als +10 % gegen\u00FCber Vorperiode.',
  },
  energy_per_revenue: {
    title: "Energie je Umsatz-Euro",
    formula: "Energiekosten ÷ Umsatz netto",
    explanation: "Von jedem Euro Umsatz gehen X Cent in Energie.",
    colorLogic: "Gelb ab 15 %, rot ab 20 %.",
  },
  energy_per_order: {
    title: "Energie je Auftrag",
    formula: "Energiekosten ÷ Anzahl Aufträge",
    explanation: "Wie viel Energie ein durchschnittlicher Auftrag kostet.",
    colorLogic: "Trend-getrieben: steigt der Wert, wird es teurer.",
  },
  energy_per_db: {
    title: "Anteil am Deckungsbeitrag",
    formula: "Energiekosten ÷ (Umsatz − variable Kosten)",
    explanation: "Wie viel von deiner Marge nach variablen Kosten in Energie fließt.",
    colorLogic: "Gelb ab 70 %, rot ab 85 %.",
  },
  on_time_rate: {
    title: "Termintreue",
    formula: "P\u00FCnktliche Auftr\u00E4ge \u00F7 Alle abgeschlossenen Auftr\u00E4ge \u00D7 100",
    explanation: "Wie viel Prozent aller Auftr\u00E4ge p\u00FCnktlich zum vereinbarten Termin fertig werden.",
    colorLogic: "Gr\u00FCn ab 90 %, Gelb ab 80 %, Rot unter 80 %.",
  },
  kosten_kategorien: {
    title: "Ausgaben nach Kategorie",
    formula: "\u03A3 aller Belege, gruppiert nach zugewiesener Kategorie",
    explanation: "Summe aller erfassten Ausgaben im Zeitraum, aufgeteilt in Kategorien wie Material, Kraftstoff, Miete usw.",
    colorLogic: "Beobachten ab +10 % gegen\u00FCber Vorperiode. Bewertung pro Kategorie.",
  },
  bwa_ergebnis: {
    title: "Betriebsergebnis (BWA)",
    formula: "Umsatzerl\u00F6se \u2212 Materialaufwand \u2212 Fremdleistungen \u2212 Fixkosten",
    explanation: "Was am Ende des Monats \u00FCbrig bleibt, nachdem alle Kosten abgezogen sind.",
    colorLogic: "Gr\u00FCn: positives Ergebnis \u00FC\u0062er 15 % Marge. Rot: negatives Ergebnis.",
  },
  offene_posten: {
    title: "Offene Posten",
    formula: "\u03A3 aller unbezahlten Ausgangsrechnungen",
    explanation: "Wie viel Geld Kunden dir noch schulden. \u00DCberf\u00E4llige Posten sind rot markiert.",
    colorLogic: "Rot bei \u00FCberf\u00E4lligen Rechnungen. Gelb bei hoher Forderungsquote (\u00FC\u0062er 15 % vom Umsatz).",
  },
  reklamationen: {
    title: "Reklamationen",
    formula: "Anzahl aller Kundenbeschwerden im Zeitraum",
    explanation: "Wie h\u00E4ufig Kunden sich beschweren und aus welchen Gr\u00FCnden.",
    colorLogic: "Beobachten ab 3 pro Monat. Kritisch ab 5 pro Monat.",
  },
  kraftstoff: {
    title: "Kraftstoff & Kfz",
    formula: "\u03A3 aller Tankbelege im Zeitraum",
    explanation: "Gesamtkosten f\u00FCr Kraftstoff inkl. Verbrauch in Litern und Durchschnittspreis.",
    colorLogic: "Beobachten bei steigendem Durchschnittspreis. Kritisch bei Verbrauchsanstieg \u00FC\u0062er 15 %.",
  },
};

// ── Period labels ────────────────────────────────────────────────────

export type PeriodType = "tag" | "woche" | "monat" | "quartal";

export const PERIOD_LABELS: Record<PeriodType, string> = {
  tag: "Tag",
  woche: "Woche",
  monat: "Monat",
  quartal: "Quartal",
};
