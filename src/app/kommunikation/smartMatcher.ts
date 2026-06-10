import type { Customer } from "@/lib/types/customer";

type Order = any; // fallback type

export interface MatchResult {
  matchedCustomer: Customer | null;
  matchedOrder: Order | null;
  scoredOrders: { order: Order; score: number; reasons: string[] }[];
  matchedMaterial: string | null;
  matchedKeywords: string[];
  suggestedAnswer: string;
}

export function smartMatchText(val: string, allCustomers: Customer[], allOrders: Order[]): MatchResult {
  const lower = val.toLowerCase();
  
  // 1. Kunden-Suche
  let foundCust = null;
  for (const cust of allCustomers) {
    if (cust.name && lower.includes(cust.name.toLowerCase())) {
      foundCust = cust;
      break;
    }
  }

  // 2. Material & Finish Erkennung
  const materials = ["zink", "chrom", "nickel", "messing", "kupfer", "gold", "silber", "eloxal", "alu", "stahl"];
  const foundMat = materials.find(m => lower.includes(m)) || null;

  const finishes = ["vernickeln", "verchromen", "verzinken", "vergolden", "versilbern", "brünieren", "eloxieren"];
  const foundFinish = finishes.find(f => lower.includes(f)) || null;

  // 3. Keyword/Intent-Erkennung
  const keywords: string[] = [];
  if (lower.includes("reklamation") || lower.includes("beschädigt") || lower.includes("kratzer") || lower.includes("kaputt")) keywords.push("Reklamation");
  if (lower.includes("rechnung") || lower.includes("zahlung") || lower.includes("bezahlen") || lower.includes("überweisung")) keywords.push("Buchhaltung/Zahlung");
  if (lower.includes("versand") || lower.includes("abholung") || lower.includes("spedition") || lower.includes("lieferung") || lower.includes("fertig") || lower.includes("abholen")) keywords.push("Termin/Logistik");
  if (lower.includes("angebot") || lower.includes("preis") || lower.includes("kosten")) keywords.push("Angebot");

  // 4. Auftrags-Scoring
  const scoredOrders: { order: Order; score: number; reasons: string[] }[] = [];
  
  for (const ord of allOrders) {
    let score = 0;
    const reasons: string[] = [];

    // Direct ID match
    if (lower.includes(ord.id.toLowerCase())) {
      score += 100;
      reasons.push("Auftragsnummer im Text");
    }

    // Customer Match
    if (foundCust && ord.customerId === foundCust.id) {
      score += 30;
      reasons.push(`Kunde ${foundCust.name}`);
    }

    // Material / Finish Match (check parts)
    let hasMat = false;
    let hasFinish = false;
    if (ord.parts && ord.parts.length > 0) {
      for (const p of ord.parts) {
        const part = p as any;
        if (foundMat && typeof part.material === 'string' && part.material.toLowerCase().includes(foundMat)) hasMat = true;
        if (foundFinish && typeof part.finish === 'string' && part.finish.toLowerCase().includes(foundFinish)) hasFinish = true;
      }
    }
    if (hasMat) {
      score += 20;
      reasons.push(`Material ${foundMat}`);
    }
    if (hasFinish) {
      score += 20;
      reasons.push(`Beschichtung ${foundFinish}`);
    }

    // Status / Intent Match
    if (keywords.includes("Termin/Logistik") && ord.statusText && (ord.statusText.toLowerCase().includes("warenausgang") || ord.statusText.toLowerCase().includes("fertig") || ord.statusText.toLowerCase().includes("abholbereit"))) {
      score += 15;
      reasons.push("Thema Abholung & Status Warenausgang");
    }

    if (score > 0) {
      scoredOrders.push({ order: ord, score, reasons });
    }
  }

  scoredOrders.sort((a, b) => b.score - a.score);
  
  let topOrder = null;
  // If top order has score > 40, it's a confident match, OR if it's the only one
  if (scoredOrders.length > 0) {
    if (scoredOrders[0].score >= 40 || scoredOrders.length === 1) {
      topOrder = scoredOrders[0].order;
    }
  }

  // 5. Generate Smart Answer
  let suggestedAnswer = "";
  if (topOrder) {
    const isLogistics = keywords.includes("Termin/Logistik");
    const isReady = topOrder.statusText && (topOrder.statusText.toLowerCase().includes("warenausgang") || topOrder.statusText.toLowerCase().includes("fertig") || topOrder.statusText.toLowerCase().includes("abholbereit"));
    suggestedAnswer = `Ich sehe den Auftrag ${topOrder.orderNumber || topOrder.id} für ${foundCust ? foundCust.name : 'Sie'}. `;
    suggestedAnswer += `Der aktuelle Status ist "${topOrder.statusText}". `;
    
    if (isLogistics && isReady) {
      suggestedAnswer += "Die Ware ist fertig und kann abgeholt werden. ";
    } else if (isLogistics) {
      suggestedAnswer += "Die Ware ist leider noch nicht ganz abholbereit. Ich prüfe den genauen Termin. ";
    }
    
    if (keywords.includes("Buchhaltung/Zahlung")) {
      suggestedAnswer += "Den Zahlungsstatus prüfe ich sofort für Sie.";
    }
  } else if (scoredOrders.length > 1) {
    suggestedAnswer = `Ich habe mehrere mögliche Vorgänge gefunden. Ich gleiche kurz ${foundMat ? 'das Material' : 'die Daten'} ab und melde mich verbindlich.`;
  } else if (foundCust || foundMat || keywords.length > 0) {
    suggestedAnswer = "Ich finde anhand Ihrer Angaben noch keinen eindeutigen Auftrag. Ich nehme die Anfrage auf und kläre den Vorgang intern.";
  } else if (val.length > 15) {
    suggestedAnswer = "Bitte nennen Sie mir Ihren Namen, das Material oder eine Auftragsnummer, damit ich den Vorgang finden kann.";
  }

  return {
    matchedCustomer: foundCust,
    matchedOrder: topOrder,
    scoredOrders: scoredOrders.slice(0, 3), // max 3
    matchedMaterial: foundMat || foundFinish,
    matchedKeywords: keywords,
    suggestedAnswer
  };
}
