'use server';

import { db } from '@/db';
import { ausgangsrechnung, beleg, bhEinstellungen, kategorie, kostenposten } from '@/db/schema_buchhaltung';
import { and, eq, gte, inArray, lte, ne, sql } from 'drizzle-orm';
import { generateInsight } from '@/lib/analyse/insights';
import { assertFinanceDateRange, requireFinanceRead } from '@/lib/server/financeAuthorization';
import { calculateOutstandingAmount, normalizeOcrConfidencePercent, type AusgangsrechnungStatus } from '@/lib/buchhaltung/types';

const CONFIRMED_RECEIPT_STATUSES = ['erfasst', 'festgeschrieben'] as const;

function normalizedLabel(value: string | null | undefined): string {
  return (value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim()
    .toLowerCase();
}

function monthsInclusive(von: string, bis: string): number {
  const from = new Date(`${von}T00:00:00Z`);
  const to = new Date(`${bis}T00:00:00Z`);
  return Math.max(1, (to.getUTCFullYear() - from.getUTCFullYear()) * 12 + to.getUTCMonth() - from.getUTCMonth() + 1);
}

function precedingDateRange(von: string, bis: string): { von: string; bis: string } {
  const start = Date.parse(`${von}T00:00:00Z`)
  const end = Date.parse(`${bis}T00:00:00Z`)
  const dayMs = 86_400_000
  const days = Math.round((end - start) / dayMs) + 1
  const previousEnd = start - dayMs
  const previousStart = previousEnd - (days - 1) * dayMs
  return {
    von: new Date(previousStart).toISOString().substring(0, 10),
    bis: new Date(previousEnd).toISOString().substring(0, 10),
  }
}

function deductibleInputTax(entry: {
  ustBetrag: string | null
  vorsteuerAbzug: boolean | null
  absetzbarProzent: string | null
}): number {
  if (entry.vorsteuerAbzug !== true) return 0
  const percentage = Number(entry.absetzbarProzent ?? 100)
  if (!Number.isFinite(percentage) || percentage < 0 || percentage > 100) return 0
  return (Number(entry.ustBetrag) || 0) * (percentage / 100)
}

function recurringCostInRange(
  item: { betrag: string; intervall: string; giltAb: string | null; giltBis: string | null },
  von: string,
  bis: string
): number {
  if (item.giltAb && item.giltAb > bis) return 0;
  if (item.giltBis && item.giltBis < von) return 0;

  const amount = Number(item.betrag) || 0;
  const interval = normalizedLabel(item.intervall);
  if (interval === 'einmalig') {
    return item.giltAb && item.giltAb >= von && item.giltAb <= bis ? amount : 0;
  }

  const months = monthsInclusive(
    item.giltAb && item.giltAb > von ? item.giltAb : von,
    item.giltBis && item.giltBis < bis ? item.giltBis : bis
  );
  if (interval === 'jahrlich') return amount * (months / 12);
  if (interval === 'vierteljahrlich') return amount * (months / 3);
  return amount * months;
}

export async function getUstvaAnalysisAction(von: string, bis: string) {
  const actor = await requireFinanceRead()
  assertFinanceDateRange(von, bis)
  const rechnungen = await db.select({
    datum: ausgangsrechnung.datum,
    netto: ausgangsrechnung.netto,
    ustBetrag: ausgangsrechnung.ustBetrag,
    ustSatz: ausgangsrechnung.ustSatz,
  })
    .from(ausgangsrechnung)
    .where(and(eq(ausgangsrechnung.tenantId, actor.tenantId), eq(ausgangsrechnung.isDemo, false), ne(ausgangsrechnung.status, 'storniert'), gte(ausgangsrechnung.datum, von), lte(ausgangsrechnung.datum, bis)))

  const belege = await db.select({
    belegdatum: beleg.belegdatum,
    netto: beleg.netto,
    ustBetrag: beleg.ustBetrag,
    vorsteuerAbzug: beleg.vorsteuerAbzug,
    absetzbarProzent: beleg.absetzbarProzent,
    belegart: beleg.belegart,
    status: beleg.status,
  })
    .from(beleg)
    .where(and(inArray(beleg.status, CONFIRMED_RECEIPT_STATUSES), gte(beleg.belegdatum, von), lte(beleg.belegdatum, bis)))

  let umsatz19 = 0
  let umsatz7 = 0
  for (const r of rechnungen) {
    const netto = Number(r.netto) || 0
    if (Number(r.ustSatz) === 19) umsatz19 += netto;
    else if (Number(r.ustSatz) === 7) umsatz7 += netto;
  }
  const ust19 = rechnungen.filter((entry) => Number(entry.ustSatz) === 19)
    .reduce((sum, entry) => sum + (Number(entry.ustBetrag) || 0), 0)
  const ust7 = rechnungen.filter((entry) => Number(entry.ustSatz) === 7)
    .reduce((sum, entry) => sum + (Number(entry.ustBetrag) || 0), 0)
  const ustTotal = rechnungen.reduce((sum, entry) => sum + (Number(entry.ustBetrag) || 0), 0)
  const vorsteuerTotal = belege.reduce((sum, entry) => sum + deductibleInputTax(entry), 0)
  const zahllast = ustTotal - vorsteuerTotal
  const offeneBelegeRows = await db.select({ id: beleg.id }).from(beleg)
    .where(and(
      eq(beleg.status, 'pruefen'),
      gte(beleg.erfasstAm, new Date(`${von}T00:00:00.000Z`)),
      lte(beleg.erfasstAm, new Date(`${bis}T23:59:59.999Z`)),
    ))
  const offeneBelege = offeneBelegeRows.length

  const comparisonPeriod = precedingDateRange(von, bis)
  const vmRechnungen = await db.select({ netto: ausgangsrechnung.netto, ustBetrag: ausgangsrechnung.ustBetrag })
    .from(ausgangsrechnung).where(and(eq(ausgangsrechnung.tenantId, actor.tenantId), eq(ausgangsrechnung.isDemo, false), ne(ausgangsrechnung.status, 'storniert'), gte(ausgangsrechnung.datum, comparisonPeriod.von), lte(ausgangsrechnung.datum, comparisonPeriod.bis)))
  const vmBelege = await db.select({
    ustBetrag: beleg.ustBetrag,
    vorsteuerAbzug: beleg.vorsteuerAbzug,
    absetzbarProzent: beleg.absetzbarProzent,
  }).from(beleg)
    .where(and(inArray(beleg.status, CONFIRMED_RECEIPT_STATUSES), gte(beleg.belegdatum, comparisonPeriod.von), lte(beleg.belegdatum, comparisonPeriod.bis)))
  const vmUst = vmRechnungen.reduce((sum, r) => sum + (Number(r.ustBetrag) || 0), 0)
  const vmVorsteuer = vmBelege.reduce((sum, entry) => sum + deductibleInputTax(entry), 0)
  const vmZahllast = vmUst - vmVorsteuer

  const monthly = new Map<string, { umsatzsteuer: number; vorsteuer: number }>()
  for (const invoice of rechnungen) {
    const month = invoice.datum.substring(0, 7)
    const current = monthly.get(month) || { umsatzsteuer: 0, vorsteuer: 0 }
    current.umsatzsteuer += Number(invoice.ustBetrag) || 0
    monthly.set(month, current)
  }
  for (const receipt of belege) {
    if (!receipt.belegdatum) continue
    const month = receipt.belegdatum.substring(0, 7)
    const current = monthly.get(month) || { umsatzsteuer: 0, vorsteuer: 0 }
    current.vorsteuer += deductibleInputTax(receipt)
    monthly.set(month, current)
  }
  const chartData = [...monthly.entries()].sort(([a], [b]) => a.localeCompare(b)).map(([name, value]) => ({
    name,
    ist: value.umsatzsteuer - value.vorsteuer,
    umsatzsteuer: value.umsatzsteuer,
    vorsteuer: value.vorsteuer,
  }))
  const trendProzent = vmZahllast === 0 ? 0 : ((zahllast - vmZahllast) / Math.abs(vmZahllast)) * 100
  const insights = generateInsight('ustva', {
    trend: { prozent: Math.round(trendProzent), positivIstGut: false },
    offeneBelege
  })

  return {
    zahllast,
    ustTotal,
    vorsteuerTotal,
    umsatzTotal: umsatz19 + umsatz7,
    offeneBelege,
    trendProzent,
    chartData,
    insights,
    dataSource: 'database' as const,
    comparisonPeriod,
    ust19,
    ust7,
  }
}

export async function getKraftstoffAnalysisAction(von: string, bis: string) {
  const actor = await requireFinanceRead();
  assertFinanceDateRange(von, bis);
  // Wir holen alle Belege, die mit Kraftstoff verknüpft sind (einfacher Join)
  const { kraftstoffDetail } = await import('@/db/schema_buchhaltung');
  
  const tankungenRaw = await db.select({
    belegId: beleg.id,
    netto: beleg.netto,
    brutto: beleg.brutto,
    datum: beleg.belegdatum,
    tankstelle: kraftstoffDetail.tankstelle,
    ort: kraftstoffDetail.ort,
    sorte: kraftstoffDetail.sorte,
    liter: kraftstoffDetail.liter,
    preisProLiter: kraftstoffDetail.preisProLiter
  })
  .from(beleg)
  .leftJoin(kraftstoffDetail, eq(beleg.id, kraftstoffDetail.belegId))
  .where(and(inArray(beleg.status, CONFIRMED_RECEIPT_STATUSES), gte(beleg.belegdatum, von), lte(beleg.belegdatum, bis), ne(kraftstoffDetail.liter, '0')));

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
    .where(and(inArray(beleg.status, CONFIRMED_RECEIPT_STATUSES), gte(beleg.belegdatum, vmVon), lte(beleg.belegdatum, vmBis)));
    
  const vmKosten = vmTankungen.reduce((s, t) => s + (Number(t.brutto) || 0), 0);
  const trendProzent = vmKosten === 0 ? 0 : ((gesamtKosten - vmKosten) / vmKosten) * 100;

  const monthMap = new Map<string, { liter: number; kosten: number }>();
  const locationMap = new Map<string, { anzahl: number; kosten: number }>();
  const fuelTypeMap = new Map<string, { liter: number; kosten: number }>();
  for (const tankung of tankungen) {
    const kosten = Number(tankung.brutto) || 0;
    const liter = Number(tankung.liter) || 0;
    if (tankung.datum) {
      const monat = tankung.datum.substring(0, 7);
      const current = monthMap.get(monat) || { liter: 0, kosten: 0 };
      current.liter += liter;
      current.kosten += kosten;
      monthMap.set(monat, current);
    }

    const ort = tankung.ort?.trim() || 'Unbekannt';
    const location = locationMap.get(ort) || { anzahl: 0, kosten: 0 };
    location.anzahl += 1;
    location.kosten += kosten;
    locationMap.set(ort, location);

    const sorte = tankung.sorte?.trim().toLowerCase() || 'unbekannt';
    const fuelType = fuelTypeMap.get(sorte) || { liter: 0, kosten: 0 };
    fuelType.liter += liter;
    fuelType.kosten += kosten;
    fuelTypeMap.set(sorte, fuelType);
  }

  const nachMonat = [...monthMap.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([monat, values]) => ({ monat, ...values }));
  const chartData = nachMonat.map((entry) => ({ name: entry.monat, ist: entry.kosten }));

  const umsatzRaw = await db.select({ netto: ausgangsrechnung.netto }).from(ausgangsrechnung)
    .where(and(eq(ausgangsrechnung.tenantId, actor.tenantId), eq(ausgangsrechnung.isDemo, false), ne(ausgangsrechnung.status, 'storniert'), gte(ausgangsrechnung.datum, von), lte(ausgangsrechnung.datum, bis)));
  const umsatz = umsatzRaw.reduce((s, u) => s + (Number(u.netto) || 0), 0);

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
    nachMonat,
    nachOrt: [...locationMap.entries()]
      .map(([ort, values]) => ({ ort, ...values }))
      .sort((a, b) => b.kosten - a.kosten),
    nachSorte: [...fuelTypeMap.entries()]
      .map(([sorte, values]) => ({ sorte, ...values }))
      .sort((a, b) => b.kosten - a.kosten),
    insights,
    tankungen: tankungen.slice(0, 5) // Top 5 für Composition
  };
}

export async function getOffenePostenAnalysisAction(von: string, bis: string) {
  const actor = await requireFinanceRead();
  assertFinanceDateRange(von, bis);
  const raw = await db.select({
    id: ausgangsrechnung.id,
    netto: ausgangsrechnung.netto,
    brutto: ausgangsrechnung.brutto,
    bezahltBetrag: ausgangsrechnung.bezahltBetragEur,
    datum: ausgangsrechnung.datum,
    status: ausgangsrechnung.status,
    kunde: ausgangsrechnung.kundeId, // Vereinfacht
    faelligAm: ausgangsrechnung.faelligAm
  })
  .from(ausgangsrechnung)
  .where(and(eq(ausgangsrechnung.tenantId, actor.tenantId), eq(ausgangsrechnung.isDemo, false), ne(ausgangsrechnung.status, 'storniert')));

  const offene = raw
    .filter(r => ['offen', 'teilbezahlt', 'ueberfaellig', 'gemahnt'].includes(r.status))
    .map((r) => ({
      ...r,
      offenerBetrag: calculateOutstandingAmount({
        brutto: Number(r.brutto) || 0,
        bezahltBetrag: Number(r.bezahltBetrag) || 0,
        status: r.status as AusgangsrechnungStatus,
      }),
    }));
  const today = new Date().toISOString().slice(0, 10);
  const ueberfaellig = offene.filter(r => r.status === 'ueberfaellig' || r.status === 'gemahnt' || Boolean(r.faelligAm && r.faelligAm < today));
  
  const offeneSumme = offene.reduce((s, r) => s + r.offenerBetrag, 0);
  const ueberfaelligSumme = ueberfaellig.reduce((s, r) => s + r.offenerBetrag, 0);
  
  const dueByMonth = new Map<string, number>();
  for (const invoice of offene) {
    const month = (invoice.faelligAm || invoice.datum).substring(0, 7);
    dueByMonth.set(month, (dueByMonth.get(month) || 0) + invoice.offenerBetrag);
  }
  const chartData = [...dueByMonth.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([name, ist]) => ({ name, ist }));

  const umsatzRaw = await db.select({ netto: ausgangsrechnung.netto }).from(ausgangsrechnung)
    .where(and(eq(ausgangsrechnung.tenantId, actor.tenantId), eq(ausgangsrechnung.isDemo, false), ne(ausgangsrechnung.status, 'storniert'), gte(ausgangsrechnung.datum, von), lte(ausgangsrechnung.datum, bis)));
  const jahresUmsatz = umsatzRaw.reduce((s, u) => s + (Number(u.netto) || 0), 0);

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
    topOffene: offene.sort((a, b) => b.offenerBetrag - a.offenerBetrag).slice(0, 5)
  };
}

export async function getBwaAnalysisAction(von: string, bis: string) {
  const actor = await requireFinanceRead();
  assertFinanceDateRange(von, bis);

  const rechnungen = await db.select({ netto: ausgangsrechnung.netto }).from(ausgangsrechnung)
    .where(and(eq(ausgangsrechnung.tenantId, actor.tenantId), eq(ausgangsrechnung.isDemo, false), ne(ausgangsrechnung.status, 'storniert'), gte(ausgangsrechnung.datum, von), lte(ausgangsrechnung.datum, bis)));

  const belege = await db.select({
    netto: beleg.netto,
    kategorieName: kategorie.name,
  }).from(beleg)
    .leftJoin(kategorie, eq(beleg.kategorieId, kategorie.id))
    .where(and(inArray(beleg.status, CONFIRMED_RECEIPT_STATUSES), gte(beleg.belegdatum, von), lte(beleg.belegdatum, bis)));

  const configuredCosts = await db.select().from(kostenposten).where(eq(kostenposten.isDemo, false));
  const einnahmen = rechnungen.reduce((s, r) => s + (Number(r.netto) || 0), 0);

  let material = 0;
  let fremdleistungen = 0;
  let personal = 0;
  let betrieb = 0;
  for (const b of belege) {
    const val = Number(b.netto) || 0;
    const category = normalizedLabel(b.kategorieName);
    if (/(material|chemie|wareneingang|verbrauch)/.test(category)) material += val;
    else if (/(fremd|subunternehmer|dienstleistung)/.test(category)) fremdleistungen += val;
    else if (/(personal|lohn|gehalt)/.test(category)) personal += val;
    else betrieb += val;
  }

  let fixkosten = 0;
  let variableKosten = 0;
  for (const cost of configuredCosts) {
    // A linked receipt is already included above and must not be counted twice.
    if (cost.belegId) continue;
    const amount = recurringCostInRange(cost, von, bis);
    if (normalizedLabel(cost.art) === 'fix') fixkosten += amount;
    else variableKosten += amount;
  }

  const variableGesamt = material + fremdleistungen + betrieb + variableKosten;
  const deckungsbeitrag = einnahmen - variableGesamt;
  const ausgabenGesamt = variableGesamt + personal + fixkosten;
  const betriebsergebnis = einnahmen - ausgabenGesamt;

  const materialQuote = einnahmen > 0 ? (material / einnahmen) * 100 : 0;
  const personalQuote = einnahmen > 0 ? (personal / einnahmen) * 100 : 0;

  const insights = generateInsight('bwa', {
    materialQuote,
    vormonat: null,
  });

  return {
    einnahmen,
    ausgabenGesamt,
    betriebsergebnis,
    deckungsbeitrag,
    material,
    fremdleistungen,
    personal,
    betrieb,
    fixkosten,
    variableKosten,
    chartData: [],
    insights,
    materialQuote,
    personalQuote,
  };
}

export async function getAusgabenAnalysisAction(von: string, bis: string) {
  await requireFinanceRead();
  assertFinanceDateRange(von, bis);

  const belegeRaw = await db.select({ netto: beleg.netto, kategorieId: beleg.kategorieId, belegart: beleg.belegart, status: beleg.status, belegdatum: beleg.belegdatum })
    .from(beleg).where(and(inArray(beleg.status, CONFIRMED_RECEIPT_STATUSES), gte(beleg.belegdatum, von), lte(beleg.belegdatum, bis)));

  const configuredCosts = await db.select().from(kostenposten).where(eq(kostenposten.isDemo, false));
  const fixkostenRaw = configuredCosts.filter((item) => normalizedLabel(item.art) === 'fix' && !item.belegId);
  const variableKostenRaw = configuredCosts.filter((item) => normalizedLabel(item.art) !== 'fix' && !item.belegId);

  // Variable Kosten = aus Belegen (außer es ist ein als Fixkosten markierter Vertrag, aber wir vereinfachen: Belege = Variabel, Verträge = Fix)
  // Belege, die keine Rechnungen sind, oft Variabel. Wir summieren einfach alle erfassten Belege als Variabel, und Verträge als Fix.
  
  let variabel = variableKostenRaw.reduce((sum, item) => sum + recurringCostInRange(item, von, bis), 0);
  for (const b of belegeRaw) {
    variabel += (Number(b.netto) || 0);
  }
  const topVariabel = [
    ...belegeRaw.map((item) => ({ ...item, amount: Number(item.netto) || 0, source: 'beleg' as const })),
    ...variableKostenRaw.map((item) => ({ ...item, amount: recurringCostInRange(item, von, bis), source: 'kostenposten' as const })),
  ].sort((a, b) => b.amount - a.amount).slice(0, 5);

  const fix = fixkostenRaw.reduce((sum, item) => sum + recurringCostInRange(item, von, bis), 0);

  const gesamt = variabel + fix;

  const chartData: { name: string; variabel: number; fix: number; gesamt: number }[] = [];

  // Kategorien 
  const kats: Record<string, number> = {};
  for (const b of belegeRaw) {
    const k = b.kategorieId || 'Sonstiges';
    kats[k] = (kats[k] || 0) + (Number(b.netto) || 0);
  }
  const topKategorien = Object.entries(kats).sort((a, b) => b[1] - a[1]).slice(0, 5).map(x => ({ name: x[0], amount: x[1] }));

  const insightsGesamt = generateInsight('ausgaben_gesamt', {});
  const insightsFix = generateInsight('fixkosten', {});
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
    insightsVariabel,
    dataSource: 'database' as const,
  };
}

export async function getSparzaehlerAnalysisAction(von: string, bis: string) {
  await requireFinanceRead();
  assertFinanceDateRange(von, bis);

  const rawBelege = await db.select({
    id: beleg.id,
    brutto: beleg.brutto,
    belegdatum: beleg.belegdatum,
    ocrConfidence: beleg.ocrConfidence,
    kategorieId: beleg.kategorieId
  }).from(beleg).where(and(
    inArray(beleg.status, CONFIRMED_RECEIPT_STATUSES),
    gte(beleg.belegdatum, von),
    lte(beleg.belegdatum, bis),
  ));

  const [settings] = await db.select().from(bhEinstellungen).where(eq(bhEinstellungen.id, 'default')).limit(1);
  if (!settings) throw new Error('FINANCE_SAVINGS_SETTINGS_NOT_CONFIGURED');

  const schwelle = Number(settings.ocrConfidenceSchwelle);
  const stundensatz = Number(settings.beraterStundensatz);
  const minutenProBeleg = Number(settings.minutenProBeleg);
  if (![schwelle, stundensatz, minutenProBeleg].every(Number.isFinite) || minutenProBeleg <= 0 || stundensatz < 0) {
    throw new Error('FINANCE_SAVINGS_SETTINGS_INVALID');
  }
  
  const autoBelege = rawBelege.filter((entry) => (
    (normalizeOcrConfidencePercent(Number(entry.ocrConfidence ?? 0)) ?? 0) >= schwelle
  ));
  const anzahlAutoBelege = autoBelege.length;
  const anzahlGesamt = rawBelege.length;
  const prozentAutomatisch = anzahlGesamt > 0 ? Math.round((anzahlAutoBelege / anzahlGesamt) * 100) : 0;
  
  const ersparnisBetrag = Math.round(anzahlAutoBelege * minutenProBeleg * (stundensatz / 60));

  // ChartData (kumulativ über Monate im Jahr)
  const monthKeys = [...new Set(autoBelege.flatMap((entry) => entry.belegdatum ? [entry.belegdatum.substring(0, 7)] : []))].sort();
  const chartData = monthKeys.map((month) => {
    const autoInMonth = autoBelege.filter(b => b.belegdatum?.startsWith(month)).length;
    return {
      name: month,
      ist: Math.round(autoInMonth * minutenProBeleg * (stundensatz / 60)),
    };
  });

  // Calculate cumulative for chartist
  let kumuliert = 0;
  const chartDataKumuliert = chartData.map(d => {
    kumuliert += d.ist;
    return { ...d, istKumuliert: kumuliert };
  });

  const insights = generateInsight('sparzaehler', {
    quoteAutomatisch: prozentAutomatisch,
    fehlendeLieferantenMappings: rawBelege.filter((entry) => !entry.kategorieId).length,
  });

  return {
    ersparnisBetrag,
    anzahlAutoBelege,
    anzahlGesamt,
    prozentAutomatisch,
    stundensatz,
    minutenProBeleg,
    schwelle,
    dataSource: 'database' as const,
    chartData: chartDataKumuliert,
    topBelege: autoBelege.sort((a, b) => (Number(b.ocrConfidence) || 0) - (Number(a.ocrConfidence) || 0)).slice(0, 5),
    insights
  };
}

export async function getAusgabenKategorien() {
  await requireFinanceRead();
  const sums = await db.select({
    categoryId: kategorie.id,
    catName: kategorie.name,
    summe: sql<string>`coalesce(sum(${beleg.netto}), 0)`,
    anzahl: sql<number>`count(${beleg.id})`,
  })
  .from(beleg)
  .leftJoin(kategorie, eq(beleg.kategorieId, kategorie.id))
  .where(inArray(beleg.status, CONFIRMED_RECEIPT_STATUSES))
  .groupBy(kategorie.id, kategorie.name);

  const palette = [
    { color: 'bg-rose-500', iconBg: 'bg-rose-50', iconColor: 'text-rose-500' },
    { color: 'bg-teal-500', iconBg: 'bg-teal-50', iconColor: 'text-teal-500' },
    { color: 'bg-purple-500', iconBg: 'bg-purple-50', iconColor: 'text-purple-500' },
    { color: 'bg-emerald-500', iconBg: 'bg-emerald-50', iconColor: 'text-emerald-500' },
    { color: 'bg-blue-500', iconBg: 'bg-blue-50', iconColor: 'text-blue-500' },
    { color: 'bg-amber-500', iconBg: 'bg-amber-50', iconColor: 'text-amber-500' },
  ] as const;

  return sums
    .map((entry, index) => ({
      id: entry.categoryId || 'unassigned',
      label: entry.catName || 'Nicht zugeordnet',
      ...palette[index % palette.length],
      sum: Number(entry.summe) || 0,
      count: Number(entry.anzahl) || 0,
      budget: null,
      trend: null,
      warning: false,
    }))
    .sort((a, b) => b.sum - a.sum);
}
