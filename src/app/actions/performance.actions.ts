"use server";

import { db } from "@/db";
import { orders, inquiries, uiEventsTable } from "@/db/schema";
import { eq, inArray, notInArray, lt, and, gte, sql, desc, count } from "drizzle-orm";
import { startOfDay, subDays, startOfWeek, subWeeks, endOfWeek } from "date-fns";

export async function getOrdersKPIs() {
  const today = startOfDay(new Date());
  
  // 1. Offene Aufträge (count WHERE status != 'abgeschlossen'/'completed'/'shipped'/'fertig')
  const finishedStatuses = ["abgeschlossen", "completed", "shipped", "fertig"];
  const openOrdersRes = await db.select({ count: count() })
    .from(orders)
    .where(notInArray(orders.status, finishedStatuses));
  const openCount = openOrdersRes[0].count;

  // 2. Überfällige Aufträge
  const overdueRes = await db.select({ count: count() })
    .from(orders)
    .where(
      and(
        notInArray(orders.status, finishedStatuses),
        lt(orders.dueDate, today)
      )
    );
  const overdueCount = overdueRes[0].count;

  // 3. Durchschnittliche Durchlaufzeit (Approximation: from created_at to now() for completed orders in last 30 days)
  const thirtyDaysAgo = subDays(today, 30);
  const completedLast30Days = await db.select({
      createdAt: orders.createdAt,
      // Fallback auf current_timestamp, da updatedAt fehlt. Bei echten historischen Daten wäre hier events verknüpft.
    })
    .from(orders)
    .where(
      and(
        inArray(orders.status, finishedStatuses),
        gte(orders.createdAt, thirtyDaysAgo)
      )
    );
    
  let avgCycleTime = 0;
  if (completedLast30Days.length > 0) {
     const totalDays = completedLast30Days.reduce((sum, o) => {
        const days = (new Date().getTime() - new Date(o.createdAt).getTime()) / (1000 * 60 * 60 * 24);
        return sum + Math.max(1, days); // Mindestens 1 Tag
     }, 0);
     avgCycleTime = parseFloat((totalDays / completedLast30Days.length).toFixed(1));
  }

  // 4. Aufträge diese Woche abgeschlossen (Vergleich zu letzter)
  // Da uns ein genaues Abschlussdatum in `orders` fehlt, nutzen wir eine Heuristik oder zählen alle fertigen,
  // die kürzlich erstellt wurden. Für echte Daten müssten wir den Timeline-Event abfragen.
  const thisWeekStart = startOfWeek(today, { weekStartsOn: 1 });
  const lastWeekStart = subWeeks(thisWeekStart, 1);

  const completedThisWeekRes = await db.select({ count: count() })
    .from(orders)
    .where(
       and(
         inArray(orders.status, finishedStatuses),
         gte(orders.createdAt, thisWeekStart) // Proxy für Abschlussdatum in Ermangelung von updatedAt
       )
    );
    
  const completedLastWeekRes = await db.select({ count: count() })
    .from(orders)
    .where(
       and(
         inArray(orders.status, finishedStatuses),
         gte(orders.createdAt, lastWeekStart),
         lt(orders.createdAt, thisWeekStart)
       )
    );

  const thisWeekCount = completedThisWeekRes[0].count;
  const lastWeekCount = completedLastWeekRes[0].count;
  
  let percentChange = 0;
  if (lastWeekCount > 0) {
     percentChange = Math.round(((thisWeekCount - lastWeekCount) / lastWeekCount) * 100);
  } else if (thisWeekCount > 0) {
     percentChange = 100;
  }

  return {
    openCount,
    overdueCount,
    avgCycleTime,
    completedThisWeek: {
       count: thisWeekCount,
       percentChange
    }
  };
}

export async function getInquiriesFunnel() {
   // 1. Offene Anfragen
   const openInquiriesRes = await db.select({ count: count() })
      .from(inquiries)
      .where(eq(inquiries.status, 'offen'));
   const openCount = openInquiriesRes[0].count;

   // 2. Conversion Rate letzte 90 Tage
   const ninetyDaysAgo = subDays(new Date(), 90);
   const recentInquiries = await db.select({ status: inquiries.status })
      .from(inquiries)
      .where(gte(inquiries.createdAt, ninetyDaysAgo));
      
   const totalRecent = recentInquiries.length;
   const acceptedRecent = recentInquiries.filter(i => i.status === 'angenommen' || i.status === 'akzeptiert').length;
   const conversionRate = totalRecent > 0 ? Math.round((acceptedRecent / totalRecent) * 100) : 0;

   // 3. Durchschnittlicher Angebotswert
   const allPriced = await db.select({ pricing: inquiries.pricing }).from(inquiries);
   let totalValue = 0;
   let pricedCount = 0;
   
   for (const inquiry of allPriced) {
      if (inquiry.pricing) {
         const p = inquiry.pricing as any;
         const sum = (p.grundarbeit || 0) + (p.reinigung || 0) + (p.entmetallisierung || 0) + 
                     (p.schleifaufwand || 0) + (p.badchemie || 0) + (p.risikopuffer || 0) + (p.marge || 0);
         if (sum > 0) {
            totalValue += sum;
            pricedCount++;
         }
      }
   }
   const avgValue = pricedCount > 0 ? Math.round(totalValue / pricedCount) : 0;

   return {
      openCount,
      conversionRate,
      avgValue
   };
}

export async function getUsageStats() {
   // 1. Meistgeklickte Bereiche (Top 5 event_types)
   const topEventsRes = await db.select({
      eventType: uiEventsTable.eventType,
      count: count()
   })
   .from(uiEventsTable)
   .groupBy(uiEventsTable.eventType)
   .orderBy(desc(count()))
   .limit(5);

   const topEvents = topEventsRes.map(row => ({
      name: row.eventType,
      value: row.count
   }));

   // 2. Aktivität letzte 7 Tage (Events pro Tag)
   const sevenDaysAgo = subDays(startOfDay(new Date()), 6);
   const recentEvents = await db.select({ createdAt: uiEventsTable.createdAt })
      .from(uiEventsTable)
      .where(gte(uiEventsTable.createdAt, sevenDaysAgo));

   const daysMap: Record<string, number> = {};
   for (let i = 0; i < 7; i++) {
      const d = subDays(startOfDay(new Date()), i);
      const key = d.toISOString().split('T')[0];
      daysMap[key] = 0;
   }

   recentEvents.forEach(e => {
      const key = e.createdAt.toISOString().split('T')[0];
      if (daysMap[key] !== undefined) {
         daysMap[key]++;
      }
   });

   const activityData = Object.entries(daysMap)
      .sort((a, b) => a[0].localeCompare(b[0])) // Chronologisch
      .map(([date, count]) => ({
         date: date.substring(5), // MM-DD
         events: count
      }));

   // 3. Letzter aktiver Nutzer/Zeitpunkt (Wir nehmen einfach das letzte Event)
   const lastEvent = await db.select({ createdAt: uiEventsTable.createdAt, payload: uiEventsTable.payload })
      .from(uiEventsTable)
      .orderBy(desc(uiEventsTable.createdAt))
      .limit(1);

   let lastActive = "Unbekannt";
   if (lastEvent.length > 0) {
      const payload = lastEvent[0].payload as any;
      const user = payload?.user || payload?.userId || "Ein Benutzer";
      const time = lastEvent[0].createdAt.toLocaleString('de-DE');
      lastActive = `${user} (${time})`;
   }

   return {
      topEvents,
      activityData,
      lastActive
   };
}
