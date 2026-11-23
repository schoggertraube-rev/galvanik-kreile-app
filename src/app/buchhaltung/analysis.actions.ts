'use server';

import {rejectDeferredLegacy} from "@/lib/server/authHelper";


import { db } from '@/db';
import { beleg } from '@/db/schema_buchhaltung';
import { and, gte, lte, ne } from 'drizzle-orm';
import { generateInsight } from '@/lib/analyse/insights';
import type {InvoiceTruthRow} from '@/lib/server/invoiceTruthRead';
import {getInvoiceTruthAction} from '@/app/actions/invoices.actions';
import {readBuchhaltungSteuersaetzeAction} from '@/app/actions/einstellungenReads.actions';
export {readBuchhaltungSteuersaetzeAction};

async function invoiceRows(from?: string, to?: string): Promise<InvoiceTruthRow[]> {
  const result = await getInvoiceTruthAction({from,to});
  if (result.code !== 'OK') throw new Error(result.message);
  return result.data;
}

export async function getUstvaAnalysisAction(von: string, bis: string) {
  await rejectDeferredLegacy("buchhaltung");

  const [saetze, originalbelege] = await Promise.all([readBuchhaltungSteuersaetzeAction(), invoiceRows(von, bis)]);
  const rechnungen = originalbelege.filter(invoice => invoice.status === "issued");

  const belege = await db.select({ netto: beleg.netto, ustBetrag: beleg.ustBetrag, belegart: beleg.belegart, status: beleg.status })
    .from(beleg)
    .where(and(ne(beleg.status, 'storniert'), gte(beleg.belegdatum, von), lte(beleg.belegdatum, bis)));

  // Gespeicherte Firmenwerte ordnen die Gruppen ein. Der Originalsatz bestimmt weiterhin die Beträge.
  const gruppen = new Map<number, { nettoCent: number; steuerCent: number }>();
  for (const rechnung of rechnungen) {
    for (const gruppe of rechnung.vatGroups) {
      const summe = gruppen.get(gruppe.rateBp) ?? { nettoCent: 0, steuerCent: 0 };
      summe.nettoCent += gruppe.netCents;
      summe.steuerCent += gruppe.vatCents;
      gruppen.set(gruppe.rateBp, summe);
    }
  }
  const steuergruppen = [...gruppen.entries()].map(([satz, summe]) => ({
    satz,
    art: satz === saetze?.regelsatzBasispunkte ? "regel"
      : satz === saetze?.ermaessigtBasispunkte ? "ermaessigt" : "original",
    ...summe,
  }));
  const ustTotal = steuergruppen.reduce((summe, gruppe) => summe + gruppe.steuerCent, 0) / 100;

  const vorsteuerTotal = belege.reduce((sum, b) => sum + (Number(b.ustBetrag) || 0), 0);
  const zahllast = ustTotal - vorsteuerTotal;
  
  const offeneBelege = belege.filter(b => b.status === 'neu' || b.status === 'erkennung_laeuft').length;

  // Vormonat für Trend (vereinfacht)
  const dVon = new Date(von);
  dVon.setMonth(dVon.getMonth() - 1);
  const vmVon = dVon.toISOString().substring(0, 10);
  const vmBis = von; // roughly
  
  const vmRechnungen = (await invoiceRows(vmVon, vmBis)).filter((invoice) => invoice.status === 'issued');
  const vmBelege = await db.select({ ustBetrag: beleg.ustBetrag }).from(beleg)
    .where(and(ne(beleg.status, 'storniert'), gte(beleg.belegdatum, vmVon), lte(beleg.belegdatum, vmBis)));
    
  const vmUst = vmRechnungen.reduce((sum, r) => sum + (r.vatAmountCents / 100), 0);
  const vmVorsteuer = vmBelege.reduce((sum, b) => sum + (Number(b.ustBetrag) || 0), 0);
  const vmZahllast = vmUst - vmVorsteuer;

  // F0-W2b (ANA-01): keine Monatshistorie für Zahllast vorhanden — keine erfundenen Werte.
  const chartData = Array.from({length: 12}).map(() => ({
    name: `Monat \${i+1}`,
    ist: null,
    vorjahr: null
  }));

  const trendProzent = vmZahllast === 0 ? 0 : ((zahllast - vmZahllast) / Math.abs(vmZahllast)) * 100;
  
  const insights = generateInsight('ustva', {
    trend: { prozent: Math.round(trendProzent), positivIstGut: false },
    offeneBelege
  });

  return {
    zahllast,
    ustTotal,
    vorsteuerTotal,
    umsatzTotal: steuergruppen.reduce((summe, gruppe) => summe + gruppe.nettoCent, 0) / 100,
    steuergruppen,
    offeneBelege,
    trendProzent,
    chartData,
    insights
  };
}

export async function getKraftstoffAnalysisAction(von: string, bis: string) {
  await rejectDeferredLegacy("buchhaltung");

  // Wir holen alle Belege, die mit Kraftstoff verknüpft sind (einfacher Join)
  const { kraftstoffDetail } = await import('@/db/schema_buchhaltung');
  const { eq } = await import('drizzle-orm');
  
  const tankungenRaw = await db.select({
    belegId: beleg.id,
    netto: beleg.netto,
    brutto: beleg.brutto,
    datum: beleg.belegdatum,
    tankstelle: kraftstoffDetail.tankstelle,
    liter: kraftstoffDetail.liter,
    preisProLiter: kraftstoffDetail.preisProLiter
  })
  .from(beleg)
  .leftJoin(kraftstoffDetail, eq(beleg.id, kraftstoffDetail.belegId))
  .where(and(ne(beleg.status, 'storniert'), gte(beleg.belegdatum, von), lte(beleg.belegdatum, bis), ne(kraftstoffDetail.liter, '0')));

  // Filter out those without kraftstoff details (though inner join would do this, leftJoin is safer if bad data exists, we filter manually here)
  const tankungen = tankungenRaw.filter(t => t.liter !== null);

  const gesamtKosten = tankungen.reduce((s, t) => s + (Number(t.brutto) || 0), 0);
  const gesamtLiter = tankungen.reduce((s, t) => s + (Number(t.liter) || 0), 0);
  const avgPreis = gesamtLiter > 0 ? gesamtKosten / gesamtLiter : 0;
  
  // Vormonat
  const dVon = new Date(von);
  dVon.setMonth(dVon.getMonth() - 1);
  const vmVon = dVon.toISOString().substring(0, 10);
  const vmBis = von;

  const vmTankungen = await db.select({ brutto: beleg.brutto })
    .from(beleg)
    .innerJoin(kraftstoffDetail, eq(beleg.id, kraftstoffDetail.belegId))
    .where(and(ne(beleg.status, 'storniert'), gte(beleg.belegdatum, vmVon), lte(beleg.belegdatum, vmBis)));
    
  const vmKosten = vmTankungen.reduce((s, t) => s + (Number(t.brutto) || 0), 0);
  const trendProzent = vmKosten === 0 ? 0 : ((gesamtKosten - vmKosten) / vmKosten) * 100;

  // Chart
  const chartData = Array.from({length: 12}).map(() => ({
    name: `Monat \${i+1}`,
    ist: null,
    vorjahr: null
  }));

  const umsatzRaw = (await invoiceRows(von, bis)).filter((invoice) => invoice.status === 'issued');
  const umsatz = umsatzRaw.reduce((sum, invoice) => sum + (invoice.netAmountCents / 100), 0);

  const insights = generateInsight('kraftstoff', {
    trend: { prozent: Math.round(trendProzent), positivIstGut: false },
    tankungenCount: tankungen.length,
    vormonat: { tankungenCount: vmTankungen.length }
  });

  return {
    gesamtKosten,
    gesamtLiter,
    avgPreis,
    tankungenCount: tankungen.length,
    umsatz,
    trendProzent,
    chartData,
    insights,
    tankungen: tankungen.slice(0, 5) // Top 5 für Composition
  };
}

export async function getOffenePostenAnalysisAction(von: string, bis: string) {
  await rejectDeferredLegacy("buchhaltung");


  const raw = (await invoiceRows()).filter((invoice) => invoice.status === 'issued');
  const offene = raw.filter((invoice) => invoice.openAmountCents > 0);
  const ueberfaellig = offene.filter((invoice) => invoice.overdue);
  
  const offeneSumme = offene.reduce((sum, invoice) => sum + (invoice.openAmountCents / 100), 0);
  const ueberfaelligSumme = ueberfaellig.reduce((sum, invoice) => sum + (invoice.openAmountCents / 100), 0);
  
  // F0-W2b (ANA-01): keine Historiendaten für OPOS vorhanden — keine erfundenen Werte.
  const chartData = Array.from({length: 6}).map(() => ({
    name: `Monat \${i+1}`,
    ist: null,
    vorjahr: null
  }));

  const umsatzRaw = (await invoiceRows(von, bis)).filter((invoice) => invoice.status === 'issued');
  const jahresUmsatz = umsatzRaw.reduce((sum, invoice) => sum + (invoice.netAmountCents / 100), 0);

  const insights = generateInsight('offene_posten', {
    ueberfaelligCount: ueberfaellig.length,
    offeneCount: offene.length
  });

  return {
    offeneSumme,
    ueberfaelligSumme,
    offeneCount: offene.length,
    ueberfaelligCount: ueberfaellig.length,
    jahresUmsatz,
    chartData,
    insights,
    topOffene: offene
      .sort((a, b) => b.openAmountCents - a.openAmountCents)
      .slice(0, 5)
      .map((invoice) => ({
        id: invoice.invoiceId,
        netto: invoice.netAmountCents / 100,
        brutto: invoice.grossAmountCents / 100,
        datum: invoice.issuedAt.slice(0, 10),
        status: invoice.overdue ? 'ueberfaellig' : invoice.paymentStatus,
        kunde: invoice.customerId,
        faelligAm: invoice.dueDate,
      }))
  };
}

export async function getBwaAnalysisAction(von: string, bis: string) {
  await rejectDeferredLegacy("buchhaltung");

  const rechnungen = (await invoiceRows(von, bis)).filter((invoice) => invoice.status === 'issued');
  
  const belege = await db.select({ netto: beleg.netto, kategorieId: beleg.kategorieId }).from(beleg)
    .where(and(ne(beleg.status, 'storniert'), gte(beleg.belegdatum, von), lte(beleg.belegdatum, bis)));
    
  const einnahmen = rechnungen.reduce((sum, invoice) => sum + (invoice.netAmountCents / 100), 0);
  
  // Categorize
  let material = 0, personal = 0, betrieb = 0;
  for (const b of belege) {
    const val = Number(b.netto) || 0;
    if (b.kategorieId === 'wareneingang') material += val;
    else if (b.kategorieId === 'personal') personal += val;
    else betrieb += val;
  }
  
  const ausgabenGesamt = material + personal + betrieb;
  const betriebsergebnis = einnahmen - ausgabenGesamt;

  const chartData = Array.from({length: 12}).map(() => ({
    name: `Monat \${i+1}`,
    ist: null,
    vorjahr: null
  }));

  const materialQuote = einnahmen > 0 ? (material / einnahmen) * 100 : 0;
  const personalQuote = einnahmen > 0 ? (personal / einnahmen) * 100 : 0;

  const insights = generateInsight('bwa', {
    materialQuote,
    vormonat: { materialQuote: Math.max(0, materialQuote - 5) }
  });

  return {
    einnahmen,
    ausgabenGesamt,
    betriebsergebnis,
    material,
    personal,
    betrieb,
    chartData,
    insights,
    materialQuote,
    personalQuote
  };
}

export async function getAusgabenAnalysisAction(von: string, bis: string) {
  await rejectDeferredLegacy("buchhaltung");

  const { kostenposten } = await import('@/db/schema_buchhaltung');
  const { and, gte, isNull, lte, ne } = await import('drizzle-orm');

  const belegeRaw = await db.select({ netto: beleg.netto, kategorieId: beleg.kategorieId, belegart: beleg.belegart, status: beleg.status, belegdatum: beleg.belegdatum })
    .from(beleg).where(and(ne(beleg.status, 'storniert'), gte(beleg.belegdatum, von), lte(beleg.belegdatum, bis)));

  const fixkostenRaw = await db.select().from(kostenposten).where(isNull(kostenposten.tenantId));

  // Variable Kosten = aus Belegen (außer es ist ein als Fixkosten markierter Vertrag, aber wir vereinfachen: Belege = Variabel, Verträge = Fix)
  // Belege, die keine Rechnungen sind, oft Variabel. Wir summieren einfach alle erfassten Belege als Variabel, und Verträge als Fix.
  
  let variabel = 0;
  const topVariabel = [...belegeRaw].sort((a, b) => Number(b.netto) - Number(a.netto)).slice(0, 5);
  for (const b of belegeRaw) {
    variabel += (Number(b.netto) || 0);
  }

  let fix = 0;
  for (const k of fixkostenRaw) {
    if (k.giltAb && k.giltAb > bis) continue;
    if (k.giltBis && k.giltBis < von) continue;
    
    let betrag = Number(k.betrag) || 0;
    if (k.intervall === 'vierteljhrlich' || k.intervall === 'vierteljaehrlich') betrag = betrag / 3;
    else if (k.intervall === 'jhrlich' || k.intervall === 'jaehrlich') betrag = betrag / 12;
    fix += betrag;
  }

  const gesamt = variabel + fix;

  // F0-W2b (ANA-01): keine erfundene Monatshistorie ohne echte Quelle.
  const chartData = Array.from({length: 12}).map(() => ({
    name: `Monat \${i+1}`,
    variabel: null,
    fix: null,
    gesamt: null
  }));

  // Kategorien 
  const kats: Record<string, number> = {};
  for (const b of belegeRaw) {
    const k = b.kategorieId || 'Sonstiges';
    kats[k] = (kats[k] || 0) + (Number(b.netto) || 0);
  }
  const topKategorien = Object.entries(kats).sort((a, b) => b[1] - a[1]).slice(0, 5).map(x => ({ name: x[0], amount: x[1] }));

  const insightsGesamt = generateInsight('ausgaben_gesamt', { bewirtungDelta: 0 }); // Mock delta
  const insightsFix = generateInsight('fixkosten', { stromGestiegen: true }); 
  const insightsVariabel = generateInsight('variable_kosten', {});

  return {
    gesamt,
    fix,
    variabel,
    chartData,
    topVariabel,
    topFixkosten: fixkostenRaw.sort((a, b) => Number(b.betrag) - Number(a.betrag)).slice(0, 5),
    topKategorien,
    insightsGesamt,
    insightsFix,
    insightsVariabel
  };
}

type SparzaehlerAnalyse = {
  ersparnisBetrag: number;
  anzahlAutoBelege: number;
  anzahlGesamt: number;
  prozentAutomatisch: number;
  stundensatz: number;
  schwelle: number;
  chartData: { name: string; ist: number; istKumuliert: number; vorjahr: null }[];
  topBelege: Pick<typeof beleg.$inferSelect, "id" | "brutto" | "belegdatum" | "ocrConfidence" | "kategorieId">[];
  insights: ReturnType<typeof generateInsight>;
};

export async function getSparzaehlerAnalysisAction(von: string, bis: string): Promise<SparzaehlerAnalyse> {
  void von;
  void bis;
  return rejectDeferredLegacy("buchhaltung");
}

export async function getAusgabenKategorien() {
  await rejectDeferredLegacy("buchhaltung");

  const { sql, eq } = await import('drizzle-orm');
  const { beleg, kategorie } = await import('@/db/schema_buchhaltung');
  const { and, isNull } = await import('drizzle-orm');

  const sums = await db.select({
    catName: kategorie.name,
    summe: sql<number>`sum(${beleg.netto})`,
    anzahl: sql<number>`count(${beleg.id})`
  })
  .from(beleg)
  .leftJoin(kategorie, and(eq(beleg.kategorieId, kategorie.id), isNull(kategorie.tenantId)))
  .groupBy(kategorie.name);

  const getSum = (catMatch: string) => {
    const found = sums.find(s => s.catName && s.catName.toLowerCase().includes(catMatch));
    return { sum: Number(found?.summe || 0), count: Number(found?.anzahl || 0) };
  };

  const mat = getSum('material');
  const ene = getSum('energie');
  const kfz = getSum('kfz');
  const bue = getSum('büro');
  const kra = getSum('kraftstoff');
  const bew = getSum('bewirtung');

  // F0-W2b (ANA-01): keine erfundenen Trend-Prozente ohne echte Vorjahres-/Vormonatsquelle.
  return [
    { id: "material", label: "Material & Chemie", color: "bg-rose-500", iconBg: "bg-rose-50", iconColor: "text-rose-500", sum: mat.sum, budget: 20000, trend: null, count: mat.count },
    { id: "energie", label: "Energie", color: "bg-teal-500", iconBg: "bg-teal-50", iconColor: "text-teal-500", sum: ene.sum, budget: 10000, trend: null, count: ene.count },
    { id: "kfz", label: "Kfz & Wartung", color: "bg-purple-500", iconBg: "bg-purple-50", iconColor: "text-purple-500", sum: kfz.sum, budget: 1500, trend: null, count: kfz.count },
    { id: "buero", label: "Büro & Software", color: "bg-emerald-500", iconBg: "bg-emerald-50", iconColor: "text-emerald-500", sum: bue.sum, budget: 1500, trend: null, count: bue.count },
    { id: "kraftstoff", label: "Kraftstoff", color: "bg-blue-500", iconBg: "bg-blue-50", iconColor: "text-blue-500", sum: kra.sum, budget: 1500, trend: null, count: kra.count },
    { id: "bewirtung", label: "Bewirtung", color: "bg-amber-500", iconBg: "bg-amber-50", iconColor: "text-amber-500", sum: bew.sum, budget: 500, trend: null, count: bew.count },
    { id: "sonstiges", label: "Sonstiges", color: "bg-neutral-500", iconBg: "bg-neutral-100", iconColor: "text-neutral-500", sum: 0, budget: 15000, trend: null, count: 0 },
  ];
}
