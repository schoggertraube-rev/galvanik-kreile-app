'use server';

import { db } from '@/db';
import { ausgangsrechnung, beleg, kategorie, kostenposten, kraftstoffDetail } from '@/db/schema_buchhaltung';
import { and, eq, gte, inArray, lte, ne, sql } from 'drizzle-orm';
import { generateInsight } from '@/lib/analyse/insights';
import { assertFinanceDateRange, requireFinanceRead } from '@/lib/server/financeAuthorization';
import { calculateOutstandingAmount, type AusgangsrechnungStatus } from '@/lib/buchhaltung/types';
import { parseCostKind, recurringCostInRange } from '@/lib/buchhaltung/costSchedule';

const CONFIRMED_RECEIPT_STATUSES = ['festgeschrieben'] as const;

function normalizedLabel(value: string | null | undefined): string {
  return (value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim()
    .toLowerCase();
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
      inArray(beleg.status, ['pruefen', 'erfasst']),
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
  await requireFinanceRead();
  assertFinanceDateRange(von, bis);

  const tankungenRaw = await db.select({
    belegId: beleg.id,
    brutto: beleg.brutto,
    datum: beleg.belegdatum,
    detailId: kraftstoffDetail.id,
    tankstelle: kraftstoffDetail.tankstelle,
    ort: kraftstoffDetail.ort,
    sorte: kraftstoffDetail.sorte,
    liter: kraftstoffDetail.liter,
    preisProLiter: kraftstoffDetail.preisProLiter,
  })
    .from(beleg)
    .leftJoin(kraftstoffDetail, eq(beleg.id, kraftstoffDetail.belegId))
    .where(and(
      inArray(beleg.status, CONFIRMED_RECEIPT_STATUSES),
      eq(beleg.belegart, 'tankbeleg'),
      gte(beleg.belegdatum, von),
      lte(beleg.belegdatum, bis),
    ));

  const normalizedTankungen = tankungenRaw.map((entry) => {
    const kosten = entry.brutto === null ? null : Number(entry.brutto);
    const liter = entry.liter === null ? null : Number(entry.liter);
    if (kosten !== null && (!Number.isFinite(kosten) || kosten < 0)) {
      throw new Error('FINANCE_FUEL_AMOUNT_INVALID');
    }
    if (liter !== null && (!Number.isFinite(liter) || liter <= 0)) {
      throw new Error('FINANCE_FUEL_VOLUME_INVALID');
    }
    return { ...entry, kosten, literWert: liter };
  });
  const missingDetailCount = normalizedTankungen.filter((entry) => entry.detailId === null).length;
  const missingLiterCount = normalizedTankungen.filter((entry) => (
    entry.detailId !== null && entry.literWert === null
  )).length;
  const missingAmountCount = normalizedTankungen.filter((entry) => entry.kosten === null).length;
  const tankungen = normalizedTankungen.filter((entry) => (
    entry.detailId !== null && entry.literWert !== null && entry.kosten !== null
  ));
  const sourceReceiptCount = normalizedTankungen.length;
  const includedReceiptCount = tankungen.length;
  const unresolvedCount = sourceReceiptCount - includedReceiptCount;
  const missingInputCount = missingDetailCount + missingLiterCount + missingAmountCount;
  const dataState = sourceReceiptCount === 0
    ? 'confirmed_empty' as const
    : unresolvedCount > 0
      ? 'partial' as const
      : 'ready' as const;
  const gesamtKosten = tankungen.reduce((sum, entry) => sum + entry.kosten!, 0);
  const gesamtLiter = tankungen.reduce((sum, entry) => sum + entry.literWert!, 0);
  const avgPreis = dataState === 'ready' && gesamtLiter > 0
    ? gesamtKosten / gesamtLiter
    : null;
  
  const comparisonPeriod = precedingDateRange(von, bis);
  const vmTankungenRaw = await db.select({
    brutto: beleg.brutto,
    detailId: kraftstoffDetail.id,
    liter: kraftstoffDetail.liter,
  })
    .from(beleg)
    .leftJoin(kraftstoffDetail, eq(beleg.id, kraftstoffDetail.belegId))
    .where(and(
      inArray(beleg.status, CONFIRMED_RECEIPT_STATUSES),
      eq(beleg.belegart, 'tankbeleg'),
      gte(beleg.belegdatum, comparisonPeriod.von),
      lte(beleg.belegdatum, comparisonPeriod.bis),
    ));
  const vmTankungen = vmTankungenRaw.map((entry) => {
    const kosten = entry.brutto === null ? null : Number(entry.brutto);
    const liter = entry.liter === null ? null : Number(entry.liter);
    if (kosten !== null && (!Number.isFinite(kosten) || kosten < 0)) {
      throw new Error('FINANCE_FUEL_AMOUNT_INVALID');
    }
    if (liter !== null && (!Number.isFinite(liter) || liter <= 0)) {
      throw new Error('FINANCE_FUEL_VOLUME_INVALID');
    }
    return { ...entry, kosten, literWert: liter };
  });
  const vmComplete = vmTankungen.filter((entry) => (
    entry.detailId !== null && entry.literWert !== null && entry.kosten !== null
  ));
  const comparisonState = vmTankungen.length === 0
    ? 'confirmed_empty' as const
    : vmComplete.length !== vmTankungen.length
      ? 'partial' as const
      : 'ready' as const;
  const vmKosten = vmComplete.reduce((sum, entry) => sum + entry.kosten!, 0);
  const trendProzent = dataState === 'ready'
    && comparisonState === 'ready'
    && vmKosten !== 0
    ? ((gesamtKosten - vmKosten) / Math.abs(vmKosten)) * 100
    : null;

  const monthMap = new Map<string, { liter: number; kosten: number }>();
  const locationMap = new Map<string, { anzahl: number; kosten: number }>();
  const fuelTypeMap = new Map<string, { liter: number; kosten: number }>();
  for (const tankung of tankungen) {
    const kosten = tankung.kosten!;
    const liter = tankung.literWert!;
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

  const insights = trendProzent === null
    ? { beobachtungen: [], vermutungen: [], vorschlaege: [] }
    : generateInsight('kraftstoff', {
      trend: { prozent: Math.round(trendProzent), positivIstGut: false },
      tankungenCount: sourceReceiptCount,
      vormonat: { tankungenCount: vmTankungen.length },
    });

  return {
    gesamtKosten,
    gesamtLiter,
    avgPreis,
    sourceReceiptCount,
    includedReceiptCount,
    missingDetailCount,
    missingLiterCount,
    missingAmountCount,
    missingInputCount,
    unresolvedCount,
    dataState,
    trendProzent,
    comparisonState,
    comparisonPeriod,
    chartData,
    nachMonat,
    nachOrt: [...locationMap.entries()]
      .map(([ort, values]) => ({ ort, ...values }))
      .sort((a, b) => b.kosten - a.kosten),
    nachSorte: [...fuelTypeMap.entries()]
      .map(([sorte, values]) => ({ sorte, ...values }))
      .sort((a, b) => b.kosten - a.kosten),
    insights,
    tankungen: tankungen.slice(0, 5),
    dataSource: 'database' as const,
    deliveryMode: 'request_snapshot' as const,
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
    .filter(r => ['offen', 'teilbezahlt', 'ueberfaellig', 'gemahnt', 'mahnung'].includes(r.status))
    .map((r) => ({
      ...r,
      offenerBetrag: calculateOutstandingAmount({
        brutto: Number(r.brutto) || 0,
        bezahltBetrag: Number(r.bezahltBetrag) || 0,
        status: r.status as AusgangsrechnungStatus,
      }),
    }));
  const today = new Date().toISOString().slice(0, 10);
  const ueberfaellig = offene.filter(r => r.status === 'ueberfaellig' || r.status === 'gemahnt' || r.status === 'mahnung' || Boolean(r.faelligAm && r.faelligAm < today));
  
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
  }).from(beleg)
    .leftJoin(kategorie, eq(beleg.kategorieId, kategorie.id))
    .where(and(inArray(beleg.status, CONFIRMED_RECEIPT_STATUSES), gte(beleg.belegdatum, von), lte(beleg.belegdatum, bis)));

  const configuredCosts = await db.select().from(kostenposten).where(and(
    eq(kostenposten.tenantId, actor.tenantId),
    eq(kostenposten.isDemo, false),
  ));
  let missingInputCount = 0;
  const einnahmen = rechnungen.reduce((sum, entry) => {
    if (entry.netto === null) {
      missingInputCount += 1;
      return sum;
    }
    const value = Number(entry.netto);
    if (!Number.isFinite(value)) throw new Error('FINANCE_INVOICE_NET_INVALID');
    return sum + value;
  }, 0);

  const material = 0;
  const fremdleistungen = 0;
  const personal = 0;
  const betrieb = 0;
  let nichtZugeordnet = 0;
  for (const entry of belege) {
    if (entry.netto === null) {
      missingInputCount += 1;
      continue;
    }
    const value = Number(entry.netto);
    if (!Number.isFinite(value)) throw new Error('FINANCE_RECEIPT_NET_INVALID');
    // A versioned SKR mapping is not configured yet. Preserve the amount
    // explicitly instead of guessing a BWA line from the category name.
    nichtZugeordnet += value;
  }
  missingInputCount += belege.length;

  let fixkosten = 0;
  let variableKosten = 0;
  for (const cost of configuredCosts) {
    // A linked receipt is already included above and must not be counted twice.
    if (cost.belegId) continue;
    const amount = recurringCostInRange(cost, von, bis);
    if (parseCostKind(cost.art) === 'fix') fixkosten += amount;
    else variableKosten += amount;
  }

  const variableGesamt = material + fremdleistungen + betrieb + nichtZugeordnet + variableKosten;
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
    nichtZugeordnet,
    fixkosten,
    variableKosten,
    chartData: [],
    insights,
    materialQuote,
    personalQuote,
    truthStatus: missingInputCount > 0 ? 'partial' as const : 'complete' as const,
    missingInputCount,
  };
}

export async function getAusgabenAnalysisAction(von: string, bis: string) {
  const actor = await requireFinanceRead();
  assertFinanceDateRange(von, bis);

  const belegeRaw = await db.select({ netto: beleg.netto, kategorieId: beleg.kategorieId, belegart: beleg.belegart, status: beleg.status, belegdatum: beleg.belegdatum })
    .from(beleg).where(and(inArray(beleg.status, CONFIRMED_RECEIPT_STATUSES), gte(beleg.belegdatum, von), lte(beleg.belegdatum, bis)));

  const configuredCosts = await db.select().from(kostenposten).where(and(
    eq(kostenposten.tenantId, actor.tenantId),
    eq(kostenposten.isDemo, false),
  ));
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

export type FinanceSavingsAnalysisResult = {
  state: 'not_evidenced';
  data: null;
  reason: 'FINANCE_SAVINGS_NOT_EVIDENCED';
};

export async function getSparzaehlerAnalysisAction(
  von: string,
  bis: string,
): Promise<FinanceSavingsAnalysisResult> {
  await requireFinanceRead();
  assertFinanceDateRange(von, bis);
  return {
    state: 'not_evidenced',
    data: null,
    reason: 'FINANCE_SAVINGS_NOT_EVIDENCED',
  };
}

export async function getAusgabenKategorien() {
  await requireFinanceRead();
  const sums = await db.select({
    categoryId: kategorie.id,
    catName: kategorie.name,
    summe: sql<string | null>`sum(${beleg.netto})`,
    anzahl: sql<number>`count(${beleg.id})::int`,
    missingNetCount: sql<number>`count(*) filter (where ${beleg.netto} is null)::int`,
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
    .map((entry, index) => {
      const sum = entry.summe === null ? 0 : Number(entry.summe);
      const count = Number(entry.anzahl);
      const missingInputCount = Number(entry.missingNetCount);
      if (
        !Number.isFinite(sum)
        || !Number.isInteger(count) || count < 0
        || !Number.isInteger(missingInputCount) || missingInputCount < 0 || missingInputCount > count
      ) {
        throw new Error('FINANCE_EXPENSE_CATEGORY_METRIC_INVALID');
      }
      return {
        id: entry.categoryId || 'unassigned',
        label: entry.catName || 'Nicht zugeordnet',
        ...palette[index % palette.length],
        sum,
        count,
        knownCount: count - missingInputCount,
        missingInputCount,
        truthStatus: missingInputCount > 0 ? 'partial' as const : 'ready' as const,
        budget: null,
        trend: null,
        warning: false,
      };
    })
    .sort((a, b) => b.sum - a.sum);
}
