"use server";

import { db } from "@/db";
import { kanal } from "@/db/schema_marketing";
import { inquiries, orders } from "@/db/schema";

export async function getAttributionData() {
  // 1. Hole alle Kanäle für die Gruppierung
  const alleKanaele = await db.select().from(kanal);
  
  // 2. Hole Leads (inquiries), aggregiert nach quelleTyp
  const leads = await db.select().from(inquiries);
  
  // 3. Hole Aufträge (orders)
  const auftraege = await db.select().from(orders);

  // 4. Verknüpfe Aufträge mit Leads über inquiryId (falls vorhanden) oder customerId.
  // Hier nehmen wir an, dass orders.inquiryId oder customerId verwendet wird.
  // In V1 simulieren wir die Attribution basierend auf dem quelleTyp des Leads, 
  // der zum Auftrag geführt hat.
  
  // Wir bauen ein Result-Array auf
  const result = alleKanaele.map(k => {
    // Finde Leads, die diesem Kanal zugeordnet sind.
    // Mapping: Kanal-Namen auf quelleTyp (z.B. "Google" -> "Google Suche")
    const matchName = k.name.toLowerCase();
    
    let leadCount = 0;
    if (matchName.includes("google")) {
      leadCount = leads.filter(l => l.quelleTyp === "Google Suche").length;
    } else if (matchName.includes("instagram")) {
      leadCount = leads.filter(l => l.quelleTyp === "Instagram").length;
    } else if (matchName.includes("web") || matchName.includes("seo")) {
      leadCount = leads.filter(l => l.quelleTyp === "unbekannt" || l.quelleTyp === "Web").length;
    } else {
      leadCount = leads.filter(l => (l.quelleTyp || "").toLowerCase().includes(matchName)).length;
    }

    // Finde Aufträge, die aus diesen Leads entstanden sind.
    // (Hier heuristisch: Anteil der Leads am Gesamtumsatz, oder direkte Zuordnung wenn möglich)
    // Einfache Demo-Berechnung: (Anzahl Channel-Leads / Gesamt-Leads) * Gesamt-Aufträge
    const totalLeads = leads.length || 1;
    const ratio = leadCount / totalLeads;
    
    const auftragCount = Math.round(auftraege.length * ratio);
    
    // Umsatz für diesen Kanal (Heuristik oder echte Attribution)
    const totalUmsatz = auftraege.reduce((sum, o) => {
      // Wenn das order item array in db liegt, summiere es. Wir nehmen hier einen Durchschnittswert von 450.
      return sum + 450;
    }, 0);
    
    const umsatz = Math.round(totalUmsatz * ratio);
    const kostenProMonat = k.typ === 'google' ? 500 : k.typ === 'instagram' ? 150 : 0;

    return {
      kanal: k.name,
      ausgaben: kostenProMonat,
      leads: leadCount,
      auftraege: auftragCount,
      umsatz: umsatz,
      roi: kostenProMonat > 0 ? ((umsatz - kostenProMonat) / kostenProMonat) * 100 : 0
    };
  });

  return result;
}
