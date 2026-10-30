import { db } from "@/db";
import { beleg } from "@/db/schema_buchhaltung";
import { orders, customers } from "@/db/schema";
import { sql, and, gte, lte } from "drizzle-orm";
import { resolveAuthorization } from "@/lib/server/authorization";
import { readInvoiceTruth } from "@/lib/server/invoiceTruthRead";

export function extractZeitraum(query: string) {
  const q = query.toLowerCase();
  const now = new Date();
  
  let startDate = new Date(now.getFullYear(), 0, 1);
  let endDate = new Date(now.getFullYear(), 11, 31);
  let label = "Aktuelles Jahr";
  let comparisonLabel = "Vorjahr";
  let assumption: string | undefined = undefined;

  // Simple NLP
  if (q.includes("letztes jahr um die zeit") || q.includes("vor einem jahr um die zeit") || q.includes("letztes jahr zu dieser zeit")) {
    startDate = new Date(now.getFullYear() - 1, now.getMonth(), 1);
    endDate = new Date(now.getFullYear() - 1, now.getMonth(), now.getDate());
    const startStr = startDate.toLocaleDateString("de-DE", { day: '2-digit', month: '2-digit', year: 'numeric' });
    const endStr = endDate.toLocaleDateString("de-DE", { day: '2-digit', month: '2-digit', year: 'numeric' });
    label = `${startStr} bis ${endStr}`;
    comparisonLabel = "Vorvorjahr gleicher Zeitraum";
    assumption = "Interpretation von 'letztes Jahr um die Zeit': gleicher Monat bis gleicher Kalendertag im Vorjahr.";
  } else if (q.includes("letzte kalenderwoche im vorjahr") || q.includes("gleiche kw letztes jahr")) {
    startDate = new Date(1970, 0, 1);
    endDate = new Date(1970, 0, 1);
    label = "Gleiche KW im Vorjahr (aktuell nicht unterstützt)";
    comparisonLabel = "N/A";
  } else if (q.includes("letztes jahr") || q.includes("letzten jahres") || q.includes("vorjahr")) {
    startDate = new Date(now.getFullYear() - 1, 0, 1);
    endDate = new Date(now.getFullYear() - 1, 11, 31);
    label = `Jahr ${now.getFullYear() - 1}`;
    comparisonLabel = `Jahr ${now.getFullYear() - 2}`;
  } else if (q.includes("letzter monat") || q.includes("letzten monat")) {
    startDate = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    endDate = new Date(now.getFullYear(), now.getMonth(), 0);
    label = "Letzter Monat";
    comparisonLabel = "Vorletzter Monat";
  } else if (q.includes("diesen monat") || q.includes("aktueller monat") || q.includes("diesen monats")) {
    startDate = new Date(now.getFullYear(), now.getMonth(), 1);
    endDate = new Date(now.getFullYear(), now.getMonth() + 1, 0);
    label = "Aktueller Monat";
    comparisonLabel = "Vorjahresmonat";
  }

  // Month detection
  const months = ["januar", "februar", "märz", "april", "mai", "juni", "juli", "august", "september", "oktober", "november", "dezember"];
  for (let i = 0; i < months.length; i++) {
    if (q.includes(months[i])) {
      const year = q.includes("letzten jahres") || q.includes("letztes jahr") ? now.getFullYear() - 1 : now.getFullYear();
      startDate = new Date(year, i, 1);
      endDate = new Date(year, i + 1, 0);
      label = `${months[i].charAt(0).toUpperCase() + months[i].slice(1)} ${year}`;
      comparisonLabel = `${months[i].charAt(0).toUpperCase() + months[i].slice(1)} ${year - 1}`;
      break;
    }
  }

  return {
    startDate,
    endDate,
    label,
    comparisonLabel,
    assumption
  };
}

export async function buildDataContext(zeitraum: { startDate: Date, endDate: Date, label: string, comparisonLabel?: string, assumption?: string }) {
  const startStr = zeitraum.startDate.toISOString().split('T')[0];
  const endStr = zeitraum.endDate.toISOString().split('T')[0];

  const authorization = await resolveAuthorization();
  if (!authorization.ok) throw new Error(authorization.message);
  const invoiceTruth = await readInvoiceTruth(authorization.data, { from: startStr, to: endStr });
  if (invoiceTruth.code !== "OK") throw new Error(invoiceTruth.message);
  const issuedInvoices = invoiceTruth.data.filter((invoice) => invoice.status === "issued");

  const [
    belegeCount,
    ordersCount,
    customersCount,
    kostenResult
  ] = await Promise.all([
    db.select({ count: sql<number>`count(*)` }).from(beleg).where(and(gte(beleg.belegdatum, startStr), lte(beleg.belegdatum, endStr))),
    db.select({ count: sql<number>`count(*)` }).from(orders).where(and(gte(orders.createdAt, zeitraum.startDate), lte(orders.createdAt, zeitraum.endDate))),
    db.select({ count: sql<number>`count(*)` }).from(customers),
    db.select({ summe: sql<number>`sum(${beleg.netto})` }).from(beleg).where(and(gte(beleg.belegdatum, startStr), lte(beleg.belegdatum, endStr)))
  ]);

  const revenueByCustomer = new Map<string, number>();
  for (const invoice of issuedInvoices) {
    revenueByCustomer.set(invoice.customerId, (revenueByCustomer.get(invoice.customerId) ?? 0) + invoice.netAmountCents);
  }
  const customerNames = await db.select({ id: customers.id, name: customers.name }).from(customers);
  const topKunden = customerNames
    .map((customer) => ({ name: customer.name, cents: revenueByCustomer.get(customer.id) ?? 0 }))
    .filter((customer) => customer.cents > 0)
    .sort((left, right) => right.cents - left.cents)
    .slice(0, 3)
    .map((customer) => customer.name);
  
  const realUmsatz = issuedInvoices.reduce((sum, invoice) => sum + invoice.netAmountCents, 0) / 100;
  const realKosten = kostenResult[0]?.summe || 0;

  // Base metrics for current timeframe
  const metrics = {
    anzahlBelege: belegeCount[0]?.count || 0,
    anzahlRechnungen: issuedInvoices.length,
    anzahlAuftraege: ordersCount[0]?.count || 0,
    aktiveKunden: customersCount[0]?.count || 0,
    gesamtUmsatz: Number(realUmsatz).toFixed(2),
    gesamtKosten: Number(realKosten).toFixed(2),
    topKunden: topKunden.length > 0 ? topKunden : ["Keine Daten"],
    durchlaufzeit: "Nicht berechenbar (fehlende Tabellendaten)",
    termintreue: "Nicht berechenbar"
  };
  
  // No fake comparison metrics anymore, we just return empty/null or state we don't have them
  const comparisonMetrics = {
    anzahlBelege: "Keine Daten",
    anzahlRechnungen: "Keine Daten",
    anzahlAuftraege: "Keine Daten",
    aktiveKunden: "Keine Daten",
    gesamtUmsatz: "Keine Daten",
    gesamtKosten: "Keine Daten",
    durchlaufzeit: "Keine Daten",
    termintreue: "Keine Daten"
  };

  return {
    zeitraum: zeitraum.label,
    comparisonZeitraum: zeitraum.comparisonLabel || "Vorjahr",
    assumption: zeitraum.assumption,
    metrics,
    comparisonMetrics
  };
}
