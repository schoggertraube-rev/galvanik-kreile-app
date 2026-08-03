"use server";

import { db } from "@/db";
import { and, gte, lte, eq, sql } from "drizzle-orm";
import { aktion, touchpoint, attribution } from "@/db/schema_marketing";

function generateInsight(typ: string, daten: any) {
  // Simple mock logic as a placeholder for the real insights
  return {
    beobachtungen: [
      "Die Marketing-Daten für diesen Monat zeigen erste Trends.",
      "Es konnten neue touchpointe erfasst werden."
    ],
    vermutungen: [
      "Eine stärkere Fokussierung auf digitale Kanäle könnte den ROI verbessern."
    ],
    vorschlaege: [
      { label: "Kampagnen analysieren", href: "/marketing" }
    ]
  };
}

export async function getMarketingAnfragenAnalysisAction(von: string, bis: string) {
  const anfragen = await db.select().from(touchpoint)
    .where(and(gte(touchpoint.ausgefuehrtAm, new Date(von)), lte(touchpoint.ausgefuehrtAm, new Date(bis))));
    
  const gesamt = anfragen.length;
  
  const chartData = Array.from({length: 12}).map((_, i) => ({
    name: `Monat ${i+1}`,
    ist: 0,
    vorjahr: 0
  }));

  const kats: Record<string, number> = {};
  for (const a of anfragen) {
    const k = a.kanalId || 'Unbekannt';
    kats[k] = (kats[k] || 0) + 1;
  }
  const topKategorien = Object.entries(kats).sort((a, b) => b[1] - a[1]).slice(0, 5).map(x => ({ name: x[0], amount: x[1] }));

  return {
    gesamt,
    chartData,
    topKategorien,
    insights: generateInsight('anfragen', {}),
    topAnfragen: anfragen.slice(0, 5)
  };
}

export async function getMarketingUmsatzAnalysisAction(von: string, bis: string) {
  const result = await db.select({ umsatz: sql`sum(${attribution.umsatz})` }).from(attribution)
    .leftJoin(touchpoint, eq(attribution.touchpointId, touchpoint.id))
    .where(and(gte(touchpoint.ausgefuehrtAm, new Date(von)), lte(touchpoint.ausgefuehrtAm, new Date(bis))));

  const umsatz = result[0]?.umsatz ? Number(result[0].umsatz) : 0;
  
  const chartData = Array.from({length: 12}).map((_, i) => ({
    name: `Monat ${i+1}`,
    ist: 0,
    vorjahr: 0
  }));

  return {
    gesamt: umsatz,
    chartData,
    insights: generateInsight('umsatz', {}),
    topAuftraege: []
  };
}

export async function getMarketingRoiAnalysisAction(von: string, bis: string) {
  // Für echten ROI: (Umsatz - Kosten) / Kosten
  const umsatzRes = await db.select({ val: sql`sum(${attribution.umsatz})` }).from(attribution)
    .leftJoin(touchpoint, eq(attribution.touchpointId, touchpoint.id))
    .where(and(gte(touchpoint.ausgefuehrtAm, new Date(von)), lte(touchpoint.ausgefuehrtAm, new Date(bis))));
  const kostenRes = await db.select({ val: sql`sum(${aktion.kostenBudget})` }).from(aktion)
    .where(and(gte(aktion.ausgefuehrtAm, new Date(von)), lte(aktion.ausgefuehrtAm, new Date(bis))));

  const u = umsatzRes[0]?.val ? Number(umsatzRes[0].val) : 0;
  const k = kostenRes[0]?.val ? Number(kostenRes[0].val) : 0;
  const roi = k > 0 ? Math.round(((u - k) / k) * 100) : 0;

  const chartData = Array.from({length: 12}).map((_, i) => ({
    name: `Monat ${i+1}`,
    ist: 0,
    vorjahr: 0
  }));

  return {
    gesamt: roi,
    chartData,
    insights: generateInsight('roi', {})
  };
}
