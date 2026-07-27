/**
 * Analytics Data Service — fetches REAL data from existing providers.
 *
 * RULE: Never invent a number. If a data source doesn't exist,
 * return { status: 'missing', reason: '...' }.
 */

import { getBuchhaltungProvider } from "@/lib/buchhaltung";
import { ordersRepository, type Order } from "@/lib/repositories/ordersRepository";
import { complaintsRepository, type Complaint } from "@/lib/repositories/complaintsRepository";
import type {
  KategorieSumme, Bwa, KraftstoffReport, CostItem,
  Ausgangsrechnung, Beleg, Ersparnis,
} from "@/lib/buchhaltung/types";

// ── Types ────────────────────────────────────────────────────────────

export type DataStatus = "ok" | "loading" | "error" | "missing";

export interface DataResult<T> {
  status: DataStatus;
  data: T | null;
  message?: string;
}

export interface KpiSnapshot {
  // Core value
  value: number | null;
  unit: string;
  label: string;

  // Change vs previous period
  changePct: number | null;
  changeText: string | null;

  // Context
  meta: string;

  // Chart data (varies by KPI)
  chartData: unknown;
  chartType: "donut" | "bar" | "horizontal-bar" | "sparkline" | "gauge";

  // Composition items
  compositionItems: CompositionRow[];
  compositionType: "belege" | "auftraege" | "reklamationen";

  // Cross-KPI raw inputs
  crossInputs: Record<string, number | null>;
}

export interface CompositionRow {
  id: string;
  date: string;
  label: string;
  sublabel: string;
  amount: number;
  href: string;
  avatarInitial: string;
  avatarColor: string;
}

// ── Zeitraum helpers ──────────────────────────────────────────────────

function currentMonthRange(): { von: string; bis: string } {
  const now = new Date();
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, "0");
  const lastDay = new Date(y, now.getMonth() + 1, 0).getDate();
  return { von: `${y}-${m}-01`, bis: `${y}-${m}-${lastDay}` };
}

function formatMonth(): string {
  return new Date().toLocaleDateString("de-DE", { month: "long", year: "numeric" });
}

// ── Avatar color from string hash ────────────────────────────────────

const AVATAR_COLORS = ["#E8943C", "#5A8F4D", "#B8923F", "#D14F3D", "#2E3A55", "#C9A661"];

function avatarColor(str: string): string {
  let hash = 0;
  for (let i = 0; i < str.length; i++) hash = str.charCodeAt(i) + ((hash << 5) - hash);
  return AVATAR_COLORS[Math.abs(hash) % AVATAR_COLORS.length];
}

// ── Fetchers ─────────────────────────────────────────────────────────

export async function fetchKostenKategorien(): Promise<DataResult<KategorieSumme[]>> {
  try {
    const provider = getBuchhaltungProvider();
    const data = await provider.getAusgabenNachKategorie(currentMonthRange());
    return { status: "ok", data };
  } catch (e) {
    return { status: "error", data: null, message: e instanceof Error ? e.message : "Unbekannter Fehler" };
  }
}

export async function fetchBwa(): Promise<DataResult<Bwa>> {
  try {
    const provider = getBuchhaltungProvider();
    const data = await provider.getBwa(currentMonthRange());
    return { status: "ok", data };
  } catch (e) {
    return { status: "error", data: null, message: e instanceof Error ? e.message : "Unbekannter Fehler" };
  }
}

export async function fetchKraftstoff(): Promise<DataResult<KraftstoffReport>> {
  try {
    const provider = getBuchhaltungProvider();
    const data = await provider.getKraftstoffAuswertung(currentMonthRange());
    return { status: "ok", data };
  } catch (e) {
    return { status: "error", data: null, message: e instanceof Error ? e.message : "Unbekannter Fehler" };
  }
}

export async function fetchFixkosten(): Promise<DataResult<CostItem[]>> {
  try {
    const provider = getBuchhaltungProvider();
    const data = await provider.getFixkosten();
    return { status: "ok", data };
  } catch (e) {
    return { status: "error", data: null, message: e instanceof Error ? e.message : "Unbekannter Fehler" };
  }
}

export async function fetchOffenePosten(): Promise<DataResult<Ausgangsrechnung[]>> {
  try {
    const provider = getBuchhaltungProvider();
    const data = await provider.listOffenePosten();
    return { status: "ok", data };
  } catch (e) {
    return { status: "error", data: null, message: e instanceof Error ? e.message : "Unbekannter Fehler" };
  }
}

export async function fetchBelege(): Promise<DataResult<Beleg[]>> {
  try {
    const provider = getBuchhaltungProvider();
    const data = await provider.listBelege();
    return { status: "ok", data };
  } catch (e) {
    return { status: "error", data: null, message: e instanceof Error ? e.message : "Unbekannter Fehler" };
  }
}

export async function fetchOrders(): Promise<DataResult<Order[]>> {
  try {
    const data = await ordersRepository.getAll();
    return { status: "ok", data };
  } catch (e) {
    return { status: "error", data: null, message: e instanceof Error ? e.message : "Unbekannter Fehler" };
  }
}

export async function fetchComplaints(): Promise<DataResult<Complaint[]>> {
  try {
    const data = await complaintsRepository.getAll();
    return { status: "ok", data };
  } catch (e) {
    return { status: "error", data: null, message: e instanceof Error ? e.message : "Unbekannter Fehler" };
  }
}

export async function fetchErsparnis(): Promise<DataResult<Ersparnis>> {
  try {
    const provider = getBuchhaltungProvider();
    const result = await provider.getErsparnis(new Date().getFullYear());
    return {
      status: "missing",
      data: result.data,
      message: "Zeitersparnis ist nicht durch gespeicherte Arbeitszeitbelege nachgewiesen.",
    };
  } catch (e) {
    return { status: "error", data: null, message: e instanceof Error ? e.message : "Unbekannter Fehler" };
  }
}

// ── KPI Snapshot assemblers ──────────────────────────────────────────

export async function fetchKpiSnapshot(kpiId: string): Promise<DataResult<KpiSnapshot>> {
  switch (kpiId) {
    case "energie":
      return assembleEnergie();
    case "kosten_kategorien":
      return assembleKostenKategorien();
    case "bwa_ergebnis":
      return assembleBwaErgebnis();
    case "offene_posten":
      return assembleOffenePosten();
    case "on_time_rate":
      return assembleTermintreue();
    case "reklamationen":
      return assembleReklamationen();
    case "kraftstoff":
      return assembleKraftstoff();
    default:
      return { status: "missing", data: null, message: `KPI "${kpiId}" nicht registriert.` };
  }
}

// ── Assemblers (real data!) ──────────────────────────────────────────

async function assembleKostenKategorien(): Promise<DataResult<KpiSnapshot>> {
  const res = await fetchKostenKategorien();
  if (res.status !== "ok" || !res.data) return { status: res.status, data: null, message: res.message };

  const kategorien = res.data;
  const total = kategorien.reduce((s, k) => s + k.summe, 0);

  // Also fetch BWA for cross-KPI
  const bwaRes = await fetchBwa();
  const bwa = bwaRes.data;

  return {
    status: "ok",
    data: {
      value: total,
      unit: "EUR",
      label: "Gesamtausgaben",
      changePct: null,  // no previous period data available yet
      changeText: null,
      meta: `${formatMonth()} \u00B7 ${kategorien.length} Kategorien \u00B7 ${kategorien.reduce((s, k) => s + k.anzahl, 0)} Belege`,

      chartType: "donut",
      chartData: {
        labels: kategorien.map((k) => k.kategorieName),
        values: kategorien.map((k) => k.summe),
        icons: kategorien.map((k) => k.icon),
      },

      compositionType: "belege" as const,
      compositionItems: kategorien.map((k) => ({
        id: k.kategorieId,
        date: "",
        label: k.kategorieName,
        sublabel: `${k.anzahl} Belege \u00B7 ${k.anteilAmUmsatz ? k.anteilAmUmsatz.toFixed(1) + " % vom Umsatz" : ""}`,
        amount: k.summe,
        href: `/buchhaltung/ausgaben?kategorie=${k.kategorieId}`,
        avatarInitial: k.icon || k.kategorieName.charAt(0),
        avatarColor: avatarColor(k.kategorieName),
      })),

      crossInputs: {
        gesamtausgaben: total,
        umsatz: bwa?.umsatzerloese ?? null,
        deckungsbeitrag: bwa?.deckungsbeitrag ?? null,
        betriebsergebnis: bwa?.betriebsergebnis ?? null,
      },
    },
  };
}

async function assembleBwaErgebnis(): Promise<DataResult<KpiSnapshot>> {
  const res = await fetchBwa();
  if (res.status !== "ok" || !res.data) return { status: res.status, data: null, message: res.message };

  const bwa = res.data;

  return {
    status: "ok",
    data: {
      value: bwa.betriebsergebnis,
      unit: "EUR",
      label: "Betriebsergebnis",
      changePct: null,
      changeText: null,
      meta: `${formatMonth()} \u00B7 BWA \u00B7 ${bwa.positionen.length} Positionen`,

      chartType: "horizontal-bar",
      chartData: {
        labels: bwa.positionen.map((p) => p.bezeichnung),
        values: bwa.positionen.map((p) => p.typ === "einnahme" ? p.betrag : -p.betrag),
        types: bwa.positionen.map((p) => p.typ),
      },

      compositionType: "belege" as const,
      compositionItems: bwa.positionen.map((p, i) => ({
        id: `bwa-${i}`,
        date: "",
        label: p.bezeichnung,
        sublabel: p.typ === "einnahme" ? "Einnahme" : p.typ === "ausgabe_fix" ? "Fixkosten" : "Variable Kosten",
        amount: p.betrag,
        href: "/buchhaltung/bwa",
        avatarInitial: p.typ === "einnahme" ? "\u2191" : "\u2193",
        avatarColor: p.typ === "einnahme" ? "#5A8F4D" : "#D14F3D",
      })),

      crossInputs: {
        umsatz: bwa.umsatzerloese,
        deckungsbeitrag: bwa.deckungsbeitrag,
        fixkosten: bwa.fixkosten,
        betriebsergebnis: bwa.betriebsergebnis,
      },
    },
  };
}

async function assembleOffenePosten(): Promise<DataResult<KpiSnapshot>> {
  const res = await fetchOffenePosten();
  if (res.status !== "ok" || !res.data) return { status: res.status, data: null, message: res.message };

  const posten = res.data;
  const total = posten.reduce((s, p) => s + p.offenerBetrag, 0);
  const ueberfaellig = posten.filter((p) => p.status === "ueberfaellig");

  return {
    status: "ok",
    data: {
      value: total,
      unit: "EUR",
      label: "Offene Posten",
      changePct: null,
      changeText: ueberfaellig.length > 0 ? `${ueberfaellig.length} \u00FCberf\u00E4llig` : null,
      meta: `${posten.length} Rechnungen offen \u00B7 ${ueberfaellig.length} \u00FCberf\u00E4llig`,

      chartType: "horizontal-bar",
      chartData: {
        labels: posten.map((p) => p.kundeName || p.nummer),
        values: posten.map((p) => p.offenerBetrag),
        statuses: posten.map((p) => p.status),
      },

      compositionType: "belege" as const,
      compositionItems: posten.map((p) => ({
        id: p.id,
        date: p.datum,
        label: p.kundeName || p.nummer,
        sublabel: `${p.nummer} \u00B7 F\u00E4llig: ${p.faelligAm || "\u2013"} \u00B7 Mahnstufe ${p.mahnstufe}`,
        amount: p.offenerBetrag,
        href: `/buchhaltung/rechnungen?id=${p.id}`,
        avatarInitial: (p.kundeName || "?").charAt(0),
        avatarColor: p.status === "ueberfaellig" ? "#D14F3D" : "#E8943C",
      })),

      crossInputs: {
        offenePosten: total,
        anzahlOffen: posten.length,
        anzahlUeberfaellig: ueberfaellig.length,
      },
    },
  };
}

async function assembleTermintreue(): Promise<DataResult<KpiSnapshot>> {
  const res = await fetchOrders();
  if (res.status !== "ok" || !res.data) return { status: res.status, data: null, message: res.message };

  const orders = res.data;
  const total = orders.length;
  const onTime = orders.filter((o) => o.risk !== "red" && o.risk !== "yellow").length;
  const rate = total > 0 ? Math.round((onTime / total) * 100) : 0;
  const atRisk = orders.filter((o) => o.risk === "red" || o.risk === "yellow");

  return {
    status: "ok",
    data: {
      value: rate,
      unit: "PERCENT",
      label: "Termintreue",
      changePct: null,
      changeText: atRisk.length > 0 ? `${atRisk.length} mit Risiko` : null,
      meta: `${total} Auftr\u00E4ge \u00B7 ${onTime} p\u00FCnktlich \u00B7 ${atRisk.length} gef\u00E4hrdet`,

      chartType: "gauge",
      chartData: { value: rate, max: 100 },

      compositionType: "auftraege" as const,
      compositionItems: atRisk.slice(0, 10).map((o) => ({
        id: o.id,
        date: o.dueDate || "",
        label: `${o.orderNumber} \u2014 ${o.title}`,
        sublabel: `${o.customerName || "Unbekannt"} \u00B7 Station: ${o.station} \u00B7 Risiko: ${o.risk}`,
        amount: 0,
        href: `/orders/${o.id}`,
        avatarInitial: (o.customerName || "?").charAt(0),
        avatarColor: o.risk === "red" ? "#D14F3D" : "#E8943C",
      })),

      crossInputs: {
        auftraegeGesamt: total,
        auftraegePuenktlich: onTime,
        auftraegeGefaehrdet: atRisk.length,
      },
    },
  };
}

async function assembleReklamationen(): Promise<DataResult<KpiSnapshot>> {
  const res = await fetchComplaints();
  if (res.status !== "ok" || !res.data) return { status: res.status, data: null, message: res.message };

  const complaints = res.data;
  const open = complaints.filter((c) => !c.resolvedAt);

  // Group by reason
  const byReason: Record<string, number> = {};
  for (const c of complaints) {
    byReason[c.reason] = (byReason[c.reason] || 0) + 1;
  }

  const REASON_LABELS: Record<string, string> = {
    surface_quality: "Oberfl\u00E4chenqualit\u00E4t",
    wrong_surface: "Falsche Oberfl\u00E4che",
    damage: "Besch\u00E4digung",
    delay: "Verz\u00F6gerung",
    communication: "Kommunikation",
    customer_expectation: "Kundenerwartung",
    transport: "Transport",
    other: "Sonstiges",
  };

  return {
    status: "ok",
    data: {
      value: complaints.length,
      unit: "COUNT",
      label: "Reklamationen",
      changePct: null,
      changeText: open.length > 0 ? `${open.length} offen` : null,
      meta: `${complaints.length} gesamt \u00B7 ${open.length} offen`,

      chartType: "donut",
      chartData: {
        labels: Object.keys(byReason).map((r) => REASON_LABELS[r] || r),
        values: Object.values(byReason),
      },

      compositionType: "reklamationen" as const,
      compositionItems: complaints.slice(0, 10).map((c) => ({
        id: c.id,
        date: new Date(c.createdAt).toLocaleDateString("de-DE"),
        label: `${c.orderId} \u2014 ${REASON_LABELS[c.reason] || c.reason}`,
        sublabel: c.description,
        amount: 0,
        href: `/orders?complaint=${c.id}`,
        avatarInitial: "!",
        avatarColor: c.resolvedAt ? "#5A8F4D" : "#D14F3D",
      })),

      crossInputs: {
        reklamationenGesamt: complaints.length,
        reklamationenOffen: open.length,
      },
    },
  };
}

async function assembleKraftstoff(): Promise<DataResult<KpiSnapshot>> {
  const res = await fetchKraftstoff();
  if (res.status !== "ok" || !res.data) return { status: res.status, data: null, message: res.message };

  const k = res.data;
  const averageText = k.durchschnittPreisProLiter === null
    ? "\u00D8 Preis nicht vollst\u00E4ndig berechenbar"
    : `\u00D8 ${k.durchschnittPreisProLiter.toFixed(2)} \u20AC/l`;
  const coverageText = k.dataState === "confirmed_empty"
    ? "Keine festgeschriebenen Tankbelege im Zeitraum"
    : k.dataState === "partial"
      ? `${k.includedReceiptCount} von ${k.anzahlTankungen} Belegen vollst\u00E4ndig`
      : `${k.anzahlTankungen} Tankbelege vollst\u00E4ndig`;

  return {
    status: "ok",
    data: {
      value: k.gesamtkosten,
      unit: "EUR",
      label: k.dataState === "partial" ? "Kraftstoff & Kfz (bekannter Teilwert)" : "Kraftstoff & Kfz",
      changePct: null,
      changeText: null,
      meta: `${coverageText} \u00B7 ${averageText} \u00B7 ${k.gesamtLiter.toFixed(0)} bekannte Liter`,

      chartType: "bar",
      chartData: {
        labels: k.nachMonat.map((m) => {
          const [, mm] = m.monat.split("-");
          const months = ["", "Jan", "Feb", "M\u00E4r", "Apr", "Mai", "Jun", "Jul", "Aug", "Sep", "Okt", "Nov", "Dez"];
          return months[parseInt(mm)] || mm;
        }),
        values: k.nachMonat.map((m) => m.kosten),
        liters: k.nachMonat.map((m) => m.liter),
      },

      compositionType: "belege" as const,
      compositionItems: k.nachOrt.map((o, i) => ({
        id: `ort-${i}`,
        date: "",
        label: o.ort,
        sublabel: `${o.anzahl} Tankungen`,
        amount: o.kosten,
        href: "/buchhaltung/kraftstoff",
        avatarInitial: o.ort.charAt(0),
        avatarColor: avatarColor(o.ort),
      })),

      crossInputs: {
        kraftstoffGesamt: k.gesamtkosten,
        literGesamt: k.gesamtLiter,
        preisProLiter: k.durchschnittPreisProLiter,
        quellbelege: k.anzahlTankungen,
        einbezogeneBelege: k.includedReceiptCount,
        fehlendeEingaben: k.missingInputCount,
      },
    },
  };
}

async function assembleEnergie(): Promise<DataResult<KpiSnapshot>> {
  const categoryResult = await fetchKostenKategorien();
  if (categoryResult.status !== "ok" || !categoryResult.data) {
    return { status: categoryResult.status, data: null, message: categoryResult.message };
  }
  const energyCategories = categoryResult.data.filter((entry) =>
    /(energie|strom|gas|wasser|heiz)/i.test(entry.kategorieName)
  );
  const value = energyCategories.reduce((sum, entry) => sum + entry.summe, 0);
  const receiptCount = energyCategories.reduce((sum, entry) => sum + entry.anzahl, 0);

  return {
    status: "ok",
    data: {
      value,
      unit: "EUR",
      label: "Energie",
      changePct: null,
      changeText: null,
      meta: `${formatMonth()} \u00B7 ${receiptCount} Belege \u00B7 kein historischer Vergleich konfiguriert`,

      chartType: "sparkline",
      chartData: {
        labels: [formatMonth()],
        values: [value],
        previousValues: [],
      },

      compositionType: "belege" as const,
      compositionItems: energyCategories.map((entry) => ({
        id: entry.kategorieId,
        date: "",
        label: entry.kategorieName,
        sublabel: `${entry.anzahl} Belege`,
        amount: entry.summe,
        href: `/buchhaltung/ausgaben?kategorie=${entry.kategorieId}`,
        avatarInitial: entry.kategorieName.charAt(0),
        avatarColor: avatarColor(entry.kategorieName),
      })),

      crossInputs: {
        energieKosten: value,
        energieUmsatz: null,
        energieAuftrag: null,
        anteilDeckungsbeitrag: null,
        co2: null,
      },
    },
  };
}
