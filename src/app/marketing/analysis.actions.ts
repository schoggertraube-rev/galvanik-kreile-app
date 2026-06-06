"use server";

import { db } from "@/db";
import { and, gte, lte, ne, eq, isNotNull, desc, sql } from "drizzle-orm";
import { segment, aktion, touchpoint } from "@/db/schema_marketing";
import { ausgangsrechnung, orders } from "@/db/schema";
import { beleg } from "@/db/schema_buchhaltung";

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
    name: `Monat \${i+1}`,
    ist: Math.round(gesamt * (0.8 + Math.random() * 0.4)),
    vorjahr: Math.round(gesamt * (0.7 + Math.random() * 0.4))
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
  // Placeholder mock for Marketing Umsatz. In real life we'd link touchpoint to orders/orders
  const umsatz = 5760;
  
  const chartData = Array.from({length: 12}).map((_, i) => ({
    name: `Monat \${i+1}`,
    ist: Math.round(umsatz * (0.8 + Math.random() * 0.4)),
    vorjahr: Math.round(umsatz * (0.7 + Math.random() * 0.4))
  }));

  return {
    gesamt: umsatz,
    chartData,
    insights: generateInsight('umsatz', {}),
    topAuftraege: []
  };
}

export async function getMarketingRoiAnalysisAction(von: string, bis: string) {
  const roi = 91; // Mock ROI

  const chartData = Array.from({length: 12}).map((_, i) => ({
    name: `Monat \${i+1}`,
    ist: Math.round(roi * (0.8 + Math.random() * 0.4)),
    vorjahr: Math.round(roi * (0.7 + Math.random() * 0.4))
  }));

  return {
    gesamt: roi,
    chartData,
    insights: generateInsight('roi', {})
  };
}
