import { db } from "@/db";
import { beleg, ausgangsrechnung } from "@/db/schema_buchhaltung";
import { appUsers, orders, customers } from "@/db/schema";
import { sql, and, eq, gte, lt, ne } from "drizzle-orm";

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

export async function buildDataContext(
  zeitraum: { startDate: Date; endDate: Date; label: string; comparisonLabel?: string; assumption?: string },
  tenantId: string,
) {
  if (tenantId !== "galvanik-kreile") throw new Error("INVALID_TENANT");
  const startStr = zeitraum.startDate.toISOString().split('T')[0];
  const endExclusive = new Date(zeitraum.endDate);
  endExclusive.setDate(endExclusive.getDate() + 1);
  const endExclusiveStr = endExclusive.toISOString().split('T')[0];

  const [
    belegeCount,
    rechnungenCount,
    ordersCount,
    customersCount,
    umsatzResult,
    kostenResult
  ] = await Promise.all([
    db
      .select({ count: sql<number>`count(*)` })
      .from(beleg)
      .innerJoin(appUsers, and(eq(beleg.erstelltVon, appUsers.id), eq(appUsers.tenantId, tenantId)))
      .where(and(gte(beleg.belegdatum, startStr), lt(beleg.belegdatum, endExclusiveStr), ne(beleg.status, "storniert"))),
    db
      .select({ count: sql<number>`count(*)` })
      .from(ausgangsrechnung)
      .where(and(
        eq(ausgangsrechnung.tenantId, tenantId),
        gte(ausgangsrechnung.datum, startStr),
        lt(ausgangsrechnung.datum, endExclusiveStr),
        ne(ausgangsrechnung.status, "storniert"),
        eq(ausgangsrechnung.isDemo, false),
      )),
    db
      .select({ count: sql<number>`count(*)` })
      .from(orders)
      .where(and(
        eq(orders.tenantId, tenantId),
        gte(orders.createdAt, zeitraum.startDate),
        lt(orders.createdAt, endExclusive),
      )),
    db
      .select({ count: sql<number>`count(*)` })
      .from(customers)
      .where(eq(customers.tenantId, tenantId)),
    db
      .select({ summe: sql<number>`sum(${ausgangsrechnung.netto})` })
      .from(ausgangsrechnung)
      .where(and(
        eq(ausgangsrechnung.tenantId, tenantId),
        gte(ausgangsrechnung.datum, startStr),
        lt(ausgangsrechnung.datum, endExclusiveStr),
        ne(ausgangsrechnung.status, "storniert"),
        eq(ausgangsrechnung.isDemo, false),
      )),
    db
      .select({ summe: sql<number>`sum(${beleg.netto})` })
      .from(beleg)
      .innerJoin(appUsers, and(eq(beleg.erstelltVon, appUsers.id), eq(appUsers.tenantId, tenantId)))
      .where(and(gte(beleg.belegdatum, startStr), lt(beleg.belegdatum, endExclusiveStr), ne(beleg.status, "storniert"))),
  ]);

  const topCustomersData = await db.select({
    name: customers.name,
    summe: sql<number>`sum(${ausgangsrechnung.netto})`
  })
  .from(customers)
  .innerJoin(
    ausgangsrechnung,
    and(
      eq(customers.id, ausgangsrechnung.kundeId),
      eq(ausgangsrechnung.tenantId, tenantId),
    ),
  )
  .where(and(
    eq(customers.tenantId, tenantId),
    gte(ausgangsrechnung.datum, startStr),
    lt(ausgangsrechnung.datum, endExclusiveStr),
    ne(ausgangsrechnung.status, "storniert"),
    eq(ausgangsrechnung.isDemo, false),
  ))
  .groupBy(customers.id)
  .orderBy(sql`sum(${ausgangsrechnung.netto}) desc nulls last`)
  .limit(3);

  const topKunden = topCustomersData.map(c => c.name);
  
  const anzahlBelege = Number(belegeCount[0]?.count ?? 0);
  const anzahlRechnungen = Number(rechnungenCount[0]?.count ?? 0);
  const anzahlAuftraege = Number(ordersCount[0]?.count ?? 0);
  const anzahlKunden = Number(customersCount[0]?.count ?? 0);
  const realUmsatz = umsatzResult[0]?.summe;
  const realKosten = kostenResult[0]?.summe;

  // Base metrics for current timeframe
  const metrics = {
    anzahlBelege,
    anzahlRechnungen,
    anzahlAuftraege,
    anzahlKunden,
    gesamtUmsatz: anzahlRechnungen > 0 && realUmsatz != null ? Number(realUmsatz).toFixed(2) : "Keine Daten",
    gesamtKosten: anzahlBelege > 0 && realKosten != null ? Number(realKosten).toFixed(2) : "Keine Daten",
    topKunden,
    durchlaufzeit: "Nicht berechenbar (fehlende Tabellendaten)",
    termintreue: "Nicht berechenbar"
  };
  
  // No fake comparison metrics anymore, we just return empty/null or state we don't have them
  const comparisonMetrics = {
    anzahlBelege: "Keine Daten",
    anzahlRechnungen: "Keine Daten",
    anzahlAuftraege: "Keine Daten",
    anzahlKunden: "Keine Daten",
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
