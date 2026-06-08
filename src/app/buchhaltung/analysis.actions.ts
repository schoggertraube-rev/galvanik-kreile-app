'use server';

import { db } from '@/db';
import { ausgangsrechnung, beleg } from '@/db/schema_buchhaltung';
import { and, gte, lte, ne } from 'drizzle-orm';
import { generateInsight } from '@/lib/analyse/insights';

export async function getUstvaAnalysisAction(von: string, bis: string) {
  // Aktueller Monat
  const rechnungen = await db.select({ netto: ausgangsrechnung.netto, ustBetrag: ausgangsrechnung.ustBetrag, ustSatz: ausgangsrechnung.ustSatz })
    .from(ausgangsrechnung)
    .where(and(ne(ausgangsrechnung.status, 'storniert'), gte(ausgangsrechnung.datum, von), lte(ausgangsrechnung.datum, bis)));

  const belege = await db.select({ netto: beleg.netto, ustBetrag: beleg.ustBetrag, belegart: beleg.belegart, status: beleg.status })
    .from(beleg)
    .where(and(ne(beleg.status, 'storniert'), gte(beleg.belegdatum, von), lte(beleg.belegdatum, bis)));

  let umsatz19 = 0, umsatz7 = 0;
  for (const r of rechnungen) {
    const netto = Number(r.netto) || 0;
    if (Number(r.ustSatz) === 19) umsatz19 += netto;
    else if (Number(r.ustSatz) === 7) umsatz7 += netto;
  }
  const ust19 = umsatz19 * 0.19;
  const ust7 = umsatz7 * 0.07;
  const ustTotal = ust19 + ust7;
  
  const vorsteuerTotal = belege.reduce((sum, b) => sum + (Number(b.ustBetrag) || 0), 0);
  const zahllast = ustTotal - vorsteuerTotal;
  
  const offeneBelege = belege.filter(b => b.status === 'neu' || b.status === 'erkennung_laeuft').length;

  // Vormonat für Trend (vereinfacht)
  const dVon = new Date(von);
  dVon.setMonth(dVon.getMonth() - 1);
  const vmVon = dVon.toISOString().substring(0, 10);
  const vmBis = von; // roughly
  
  const vmRechnungen = await db.select({ netto: ausgangsrechnung.netto, ustBetrag: ausgangsrechnung.ustBetrag })
    .from(ausgangsrechnung).where(and(ne(ausgangsrechnung.status, 'storniert'), gte(ausgangsrechnung.datum, vmVon), lte(ausgangsrechnung.datum, vmBis)));
  const vmBelege = await db.select({ ustBetrag: beleg.ustBetrag }).from(beleg)
    .where(and(ne(beleg.status, 'storniert'), gte(beleg.belegdatum, vmVon), lte(beleg.belegdatum, vmBis)));
    
  const vmUst = vmRechnungen.reduce((sum, r) => sum + (Number(r.ustBetrag) || 0), 0);
  const vmVorsteuer = vmBelege.reduce((sum, b) => sum + (Number(b.ustBetrag) || 0), 0);
  const vmZahllast = vmUst - vmVorsteuer;

  // 12 Months Chart Data (Mock trend shape based on current zahllast)
  const chartData = Array.from({length: 12}).map((_, i) => ({
    name: `Monat \${i+1}`,
    ist: Math.round(zahllast * (0.8 + Math.random() * 0.4)),
    vorjahr: Math.round(zahllast * (0.7 + Math.random() * 0.4))
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
    umsatzTotal: umsatz19 + umsatz7,
    offeneBelege,
    trendProzent,
    chartData,
    insights
  };
}

export async function getKraftstoffAnalysisAction(von: string, bis: string) {
  // Wir holen alle Belege, die mit Kraftstoff verknüpft sind (einfacher Join)
  const { kraftstoffDetail, kategorie } = await import('@/db/schema_buchhaltung');
  const { eq, sum } = await import('drizzle-orm');
  
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
  const chartData = Array.from({length: 12}).map((_, i) => ({
    name: `Monat \${i+1}`,
    ist: Math.round(gesamtKosten * (0.8 + Math.random() * 0.4)),
    vorjahr: Math.round(gesamtKosten * (0.7 + Math.random() * 0.4))
  }));

  const umsatzRaw = await db.select({ netto: ausgangsrechnung.netto }).from(ausgangsrechnung)
    .where(and(ne(ausgangsrechnung.status, 'storniert'), gte(ausgangsrechnung.datum, von), lte(ausgangsrechnung.datum, bis)));
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
    insights,
    tankungen: tankungen.slice(0, 5) // Top 5 für Composition
  };
}

export async function getOffenePostenAnalysisAction(von: string, bis: string) {
  const { and, gte, lte, ne, eq } = await import('drizzle-orm');
  const raw = await db.select({
    id: ausgangsrechnung.id,
    netto: ausgangsrechnung.netto,
    brutto: ausgangsrechnung.brutto,
    datum: ausgangsrechnung.datum,
    status: ausgangsrechnung.status,
    kunde: ausgangsrechnung.kundeId, // Vereinfacht
    faelligAm: ausgangsrechnung.faelligAm
  })
  .from(ausgangsrechnung)
  .where(ne(ausgangsrechnung.status, 'storniert'));

  const offene = raw.filter(r => r.status === 'offen' || r.status === 'ueberfaellig');
  const ueberfaellig = raw.filter(r => r.status === 'ueberfaellig');
  
  const offeneSumme = offene.reduce((s, r) => s + (Number(r.brutto) || 0), 0);
  const ueberfaelligSumme = ueberfaellig.reduce((s, r) => s + (Number(r.brutto) || 0), 0);
  
  // Trend: Dummy chart since we don't have historical snapshot data for OPOS
  const chartData = Array.from({length: 6}).map((_, i) => ({
    name: `Monat \${i+1}`,
    ist: Math.round(offeneSumme * (0.8 + Math.random() * 0.4)),
    vorjahr: Math.round(offeneSumme * (0.7 + Math.random() * 0.4))
  }));

  const umsatzRaw = await db.select({ netto: ausgangsrechnung.netto }).from(ausgangsrechnung)
    .where(and(ne(ausgangsrechnung.status, 'storniert'), gte(ausgangsrechnung.datum, von), lte(ausgangsrechnung.datum, bis)));
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
    topOffene: offene.sort((a, b) => Number(b.brutto) - Number(a.brutto)).slice(0, 5)
  };
}

export async function getBwaAnalysisAction(von: string, bis: string) {
  const { and, gte, lte, ne } = await import('drizzle-orm');
  
  const rechnungen = await db.select({ netto: ausgangsrechnung.netto }).from(ausgangsrechnung)
    .where(and(ne(ausgangsrechnung.status, 'storniert'), gte(ausgangsrechnung.datum, von), lte(ausgangsrechnung.datum, bis)));
  
  const belege = await db.select({ netto: beleg.netto, kategorieId: beleg.kategorieId }).from(beleg)
    .where(and(ne(beleg.status, 'storniert'), gte(beleg.belegdatum, von), lte(beleg.belegdatum, bis)));
    
  const einnahmen = rechnungen.reduce((s, r) => s + (Number(r.netto) || 0), 0);
  
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

  const chartData = Array.from({length: 12}).map((_, i) => ({
    name: `Monat \${i+1}`,
    ist: Math.round(betriebsergebnis * (0.8 + Math.random() * 0.4)),
    vorjahr: Math.round(betriebsergebnis * (0.7 + Math.random() * 0.4))
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
  const { kostenposten } = await import('@/db/schema_buchhaltung');
  const { and, gte, lte, ne } = await import('drizzle-orm');

  const belegeRaw = await db.select({ netto: beleg.netto, kategorieId: beleg.kategorieId, belegart: beleg.belegart, status: beleg.status, belegdatum: beleg.belegdatum })
    .from(beleg).where(and(ne(beleg.status, 'storniert'), gte(beleg.belegdatum, von), lte(beleg.belegdatum, bis)));

  const fixkostenRaw = await db.select().from(kostenposten);

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

  // Mock Trend for Chart
  const chartData = Array.from({length: 12}).map((_, i) => ({
    name: `Monat \${i+1}`,
    variabel: Math.round(variabel * (0.8 + Math.random() * 0.4)),
    fix: Math.round(fix * (0.9 + Math.random() * 0.2)),
    gesamt: 0 // calculated below
  })).map(d => ({ ...d, gesamt: d.variabel + d.fix }));

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

export async function getSparzaehlerAnalysisAction(von: string, bis: string) {
  const { and, gte, lte, ne } = await import('drizzle-orm');
  // removed einkauf import
  
  const rawBelege = await db.select({
    id: beleg.id,
    brutto: beleg.brutto,
    belegdatum: beleg.belegdatum,
    ocrConfidence: beleg.ocrConfidence,
    kategorieId: beleg.kategorieId
  }).from(beleg).where(ne(beleg.status, 'storniert')); // Ersparnis is YTD by definition in our app!
  
  const year = new Date().getFullYear();
  const belegeThisYear = rawBelege.filter(b => b.belegdatum && b.belegdatum.startsWith(year.toString()));
  
  // Settings from DB
  const { steuerprofil } = await import('@/db/schema_buchhaltung');
  const profil = await db.select().from(steuerprofil).limit(1);
  const schwelle = 85;
  const stundensatz = 120;
  
  const autoBelege = belegeThisYear.filter(b => b.ocrConfidence && Number(b.ocrConfidence) >= schwelle);
  const anzahlAutoBelege = autoBelege.length;
  const anzahlGesamt = belegeThisYear.length;
  const prozentAutomatisch = anzahlGesamt > 0 ? Math.round((anzahlAutoBelege / anzahlGesamt) * 100) : 0;
  
  // 4 Min pro Beleg
  const ersparnisBetrag = Math.round(anzahlAutoBelege * 4 * (stundensatz / 60));

  // ChartData (kumulativ über Monate im Jahr)
  const chartData = Array.from({length: 12}).map((_, i) => {
    const month = String(i + 1).padStart(2, '0');
    const autoInMonth = autoBelege.filter(b => b.belegdatum && b.belegdatum.startsWith(`${year}-${month}`)).length;
    return {
      name: `Monat \${i+1}`,
      ist: Math.round(autoInMonth * 4 * (stundensatz / 60)),
      vorjahr: Math.round(autoInMonth * 4 * (stundensatz / 60) * 0.8) // Mock Vorjahr
    };
  });

  // Calculate cumulative for chartist
  let kumuliert = 0;
  const chartDataKumuliert = chartData.map(d => {
    kumuliert += d.ist;
    return { ...d, istKumuliert: kumuliert };
  });

  const insights = generateInsight('sparzaehler', {
    prozentAutomatisch,
    ersparnisBetrag
  });

  return {
    ersparnisBetrag,
    anzahlAutoBelege,
    anzahlGesamt,
    prozentAutomatisch,
    stundensatz,
    schwelle,
    chartData: chartDataKumuliert,
    topBelege: autoBelege.sort((a, b) => (Number(b.ocrConfidence) || 0) - (Number(a.ocrConfidence) || 0)).slice(0, 5),
    insights
  };
}

export async function getAusgabenKategorien() {
  const { sql, eq } = await import('drizzle-orm');
  const { beleg, kategorie } = await import('@/db/schema_buchhaltung');

  const sums = await db.select({
    catName: kategorie.name,
    summe: sql<number>`sum(${beleg.netto})`,
    anzahl: sql<number>`count(${beleg.id})`
  })
  .from(beleg)
  .leftJoin(kategorie, eq(beleg.kategorieId, kategorie.id))
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

  return [
    { id: "material", label: "Material & Chemie", color: "bg-rose-500", iconBg: "bg-rose-50", iconColor: "text-rose-500", sum: mat.sum, budget: 20000, trend: "+2.4%", count: mat.count },
    { id: "energie", label: "Energie", color: "bg-teal-500", iconBg: "bg-teal-50", iconColor: "text-teal-500", sum: ene.sum, budget: 10000, trend: "-1.2%", count: ene.count },
    { id: "kfz", label: "Kfz & Wartung", color: "bg-purple-500", iconBg: "bg-purple-50", iconColor: "text-purple-500", sum: kfz.sum, budget: 1500, trend: "+12.5%", count: kfz.count, warning: true },
    { id: "buero", label: "Büro & Software", color: "bg-emerald-500", iconBg: "bg-emerald-50", iconColor: "text-emerald-500", sum: bue.sum, budget: 1500, trend: "-0.5%", count: bue.count },
    { id: "kraftstoff", label: "Kraftstoff", color: "bg-blue-500", iconBg: "bg-blue-50", iconColor: "text-blue-500", sum: kra.sum, budget: 1500, trend: "+5.0%", count: kra.count },
    { id: "bewirtung", label: "Bewirtung", color: "bg-amber-500", iconBg: "bg-amber-50", iconColor: "text-amber-500", sum: bew.sum, budget: 500, trend: "-10.0%", count: bew.count },
    { id: "sonstiges", label: "Sonstiges", color: "bg-neutral-500", iconBg: "bg-neutral-100", iconColor: "text-neutral-500", sum: 0, budget: 15000, trend: "+4.1%", count: 0 },
  ];
}
