"use server";

import { db } from "@/db";
import { orders, buchhaltung_rechnungen, qs, baeder } from "@/db/schema";
import { checkAppAuth } from "@/lib/server/authHelper";

export async function getPerformanceKPIsAction() {
  const auth = await checkAppAuth();
  if (!auth.ok) return { ok: false, error: "AUTH_ERROR", message: auth.message };

  if (!db) return { ok: false, error: "DB_ERROR", message: "Database not available" };

  try {
    const allOrders = await db.select().from(orders);
    const invoices = await db.select().from(buchhaltung_rechnungen);
    const qsCases = await db.select().from(qs);

    const totalRevenue = invoices.reduce((sum, inv) => {
      // Very simple amount parsing assuming standard format or float string
      let amtStr = inv.amount;
      if (typeof amtStr === 'string') {
        amtStr = amtStr.replace(/\./g, '').replace(',', '.').replace(/[^0-9.-]/g, '');
      }
      return sum + (parseFloat(amtStr as string) || 0);
    }, 0);

    const totalOrders = allOrders.length;
    const completedOrders = allOrders.filter(o => o.status === 'completed').length;
    
    // Durchlaufzeit is mocked as 0 if none
    const durchlaufzeit = 0;
    
    const reklas = qsCases.length;
    const activeWarnings = qsCases.filter(q => q.ergebnis !== 'bestanden').length;

    // We send zero if totalRevenue is 0, to fulfill the "Zero State" rule.
    return {
      ok: true,
      data: {
        totalRevenue,
        totalOrders,
        completedOrders,
        reklas,
        activeWarnings,
        durchlaufzeit
      }
    };
  } catch (error) {
    console.error("Error in getPerformanceKPIsAction:", error);
    return { ok: false, error: "QUERY_ERROR", message: String(error) };
  }
}
