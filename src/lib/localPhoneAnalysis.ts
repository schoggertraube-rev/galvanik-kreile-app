import { MockCustomer, MockOrder } from "@/lib/mockData";
const INITIAL_CUSTOMERS: MockCustomer[] = [];
const INITIAL_ORDERS: MockOrder[] = [];

export interface LocalAnalysisResult {
  matchedCustomer: MockCustomer | null;
  customerCandidates: { id: string; name: string; city: string; phone: string; openOrdersCount: number; confidence: number; matchReason: string; }[];
  matchedOrder: MockOrder | null;
  orderCandidates: { id: string; orderNumber: string; task: string; status: string; station: string; dueDate: string; confidence: number; matchReason: string; }[];
  matchedMaterial: string | null;
  surfaceRequested: string | null;
  matchedTheme: string | null;
  matchedTime: { label: string; dayOfWeek: number; isFree: boolean; intent: "deadline" | "pickup" | "dropoff" | "callback" } | null;
  matchedPayment: string | null;
  
  intents: {
    wantsNewOrder: boolean;
    wantsNewCustomer: boolean;
    wantsQuote: boolean;
    hasEmailOrAttachment: boolean;
  };
  
  suggestedAnswer: string;
  overallConfidence: number;
  requiresAI: boolean;
  aiReason?: string;
  highlights: { word: string; type: "kunde" | "auftrag" | "material" | "thema" | "zeit" | "aktion" }[];
}

function parseTimePhrase(text: string): { label: string; dayOfWeek: number; isFree: boolean; intent: "deadline" | "pickup" | "dropoff" | "callback" } | null {
  const lower = text.toLowerCase();
  const now = new Date();
  const weekdays = ["So", "Mo", "Di", "Mi", "Do", "Fr", "Sa"];

  const timePatterns: [RegExp, number][] = [
    [/\bmorgen\b/, 1],
    [/\bübermorgen\b/, 2],
    [/\bheute\b/, 0],
    [/\bmontag\b/, (() => { const d = (1 - now.getDay() + 7) % 7 || 7; return d; })()],
    [/\bdienstag\b/, (() => { const d = (2 - now.getDay() + 7) % 7 || 7; return d; })()],
    [/\bmittwoch\b/, (() => { const d = (3 - now.getDay() + 7) % 7 || 7; return d; })()],
    [/\bdonnerstag\b/, (() => { const d = (4 - now.getDay() + 7) % 7 || 7; return d; })()],
    [/\bfreitag\b/, (() => { const d = (5 - now.getDay() + 7) % 7 || 7; return d; })()],
  ];

  const timeMatch = lower.match(/(\d{1,2})(?::(\d{2}))?\s*(?:uhr)?/);
  const timeStr = timeMatch ? `${timeMatch[1]}:${timeMatch[2] || "00"}` : "10:00";

  let intent: "deadline" | "pickup" | "dropoff" | "callback" = "pickup";
  if (lower.includes("bis ")) intent = "deadline";
  else if (lower.includes("bringen") || lower.includes("abgeben")) intent = "dropoff";
  else if (lower.includes("rückruf") || lower.includes("anrufen")) intent = "callback";

  for (const [pattern, daysAhead] of timePatterns) {
    if (pattern.test(lower)) {
      const targetDate = new Date(now);
      targetDate.setDate(now.getDate() + daysAhead);
      const dow = targetDate.getDay();
      const isFree = dow >= 1 && dow <= 5;
      const dayLabel = `${weekdays[dow]} ${targetDate.getDate()}.${targetDate.getMonth() + 1}. · ${timeStr}`;
      return { label: dayLabel, dayOfWeek: dow, isFree, intent };
    }
  }
  
  // Extra check for "bis september", "bis morgen" without specific days
  const monthMatch = lower.match(/\bbis\s+(januar|februar|märz|april|mai|juni|juli|august|september|oktober|november|dezember)\b/i);
  if (monthMatch) {
    return { label: monthMatch[0], dayOfWeek: 1, isFree: true, intent: "deadline" };
  }
  
  return null;
}

function findCustomerCandidates(nameHint: string): LocalAnalysisResult["customerCandidates"] {
  if (!nameHint || nameHint.length < 2) return [];
  const lower = nameHint.toLowerCase();
  
  const candidates: LocalAnalysisResult["customerCandidates"] = [];

  for (const c of INITIAL_CUSTOMERS) {
    const cLower = c.name.toLowerCase();
    // Exact substring match
    if (cLower.includes(lower) || lower.includes(cLower)) {
      const openOrders = INITIAL_ORDERS.filter(o => o.customerId === c.id && o.status !== "done");
      candidates.push({
        id: c.id,
        name: c.name,
        city: c.city || "—",
        phone: c.phone || "—",
        openOrdersCount: openOrders.length,
        confidence: 95,
        matchReason: "Name erkannt",
      });
      continue;
    }
    // Fuzzy: check each word of the hint against each word of customer name
    const hintWords = lower.split(/\s+/).filter(w => w.length >= 3);
    const nameWords = cLower.split(/\s+/);
    for (const hw of hintWords) {
      for (const nw of nameWords) {
        if (nw.startsWith(hw) || hw.startsWith(nw) || (hw.length >= 4 && nw.includes(hw.slice(0, 4)))) {
          const openOrders = INITIAL_ORDERS.filter(o => o.customerId === c.id && o.status !== "done");
          candidates.push({
            id: c.id,
            name: c.name,
            city: c.city || "—",
            phone: c.phone || "—",
            openOrdersCount: openOrders.length,
            confidence: 70,
            matchReason: `Ähnlich: "${hw}" ≈ "${nw}"`,
          });
          break;
        }
      }
      if (candidates.some(cc => cc.id === c.id)) break;
    }
  }
  return candidates;
}

export function performLocalAnalysis(text: string): LocalAnalysisResult {
  const lower = text.toLowerCase();
  const highlights: LocalAnalysisResult["highlights"] = [];
  
  // 1. Order Match
  const orderMatch = text.match(/A-\d{4}-\d{4}/i);
  const orderNumber = orderMatch ? orderMatch[0].toUpperCase() : null;
  let matchedOrder = orderNumber ? INITIAL_ORDERS.find(o => o.orderNumber.toUpperCase() === orderNumber) || null : null;
  
  if (orderNumber) highlights.push({ word: orderNumber, type: "auftrag" });

  // 2. Customer Match (Fallback to order's customer if not explicitly mentioned)
  const customerCandidates: LocalAnalysisResult["customerCandidates"] = [];
  
  // First, check if the text contains any customer name directly

  for (const c of INITIAL_CUSTOMERS) {
      // Very naive extraction: just find matching tokens
      const nameParts = c.name.toLowerCase().split(' ');
      for (const part of nameParts) {
          if (part.length > 3 && lower.includes(part)) {
              const matched = findCustomerCandidates(part);
              matched.forEach(m => {
                  if(!customerCandidates.find(x => x.id === m.id)) {
                      customerCandidates.push(m);
                  }
              })
          }
      }
  }

  let matchedCustomer: MockCustomer | null = null;
  if (customerCandidates.length === 1 && customerCandidates[0].confidence >= 90) {
    matchedCustomer = INITIAL_CUSTOMERS.find(c => c.id === customerCandidates[0].id) || null;
  }
  
  // If order was found, definitely pick that customer
  if (matchedOrder && !matchedCustomer) {
      matchedCustomer = INITIAL_CUSTOMERS.find(c => c.id === matchedOrder?.customerId) || null;
  }

  if (matchedCustomer) highlights.push({ word: matchedCustomer.name.split(" ")[0], type: "kunde" }); // approximate highlight

  // 3. Order Candidates (if customer is known but no specific order)
  let orderCandidates: LocalAnalysisResult["orderCandidates"] = [];
  if (matchedCustomer && !matchedOrder) {
      const orders = INITIAL_ORDERS.filter(o => o.customerId === matchedCustomer?.id && o.status !== "done");
      orderCandidates = orders.map(o => ({
        id: o.id,
        orderNumber: o.orderNumber,
        task: o.task,
        status: o.statusText || o.status || "aktiv",
        station: o.station || "—",
        dueDate: o.dueLabel ? `${o.dueLabel} ${o.dueValue}` : o.dueDate,
        confidence: 80,
        matchReason: "Offener Auftrag",
      }));
      if (orderCandidates.length === 1) {
          matchedOrder = INITIAL_ORDERS.find(o => o.id === orderCandidates[0].id) || null;
      }
  }

  // 4. Material & Surface
  const materials = ["zink", "messing", "kupfer", "gold", "silber", "alu", "stahl", "edelstahl", "bronze"];
  const finishes = ["vernickeln", "verchromen", "verzinken", "vergolden", "versilbern", "brünieren", "eloxieren"];
  const material = materials.find(m => lower.includes(m)) || null;
  const surfaceRequested = finishes.find(f => lower.includes(f)) || null;
  if (material) highlights.push({ word: material, type: "material" });
  if (surfaceRequested) highlights.push({ word: surfaceRequested, type: "material" });

  // 4b. New Intents (Live Actions)
  const wantsNewOrder = /neuer auftrag|auftrag anlegen|möchte etwas abgeben|kommt mit teilen|bringt|neue teile|neue ware|zum (versilbern|verchromen|verzinken) bringen/i.test(lower);
  const wantsNewCustomer = /neuer kunde|noch nicht angelegt|erstmalig|zum ersten mal|keine kundennummer/i.test(lower);
  const wantsQuote = /kostenvoranschlag|kv\b|angebot|preis|was kostet|ungefährer preis|vorab schätzen/i.test(lower);
  const hasEmailOrAttachment = /e-mail|mail\b|habe geschickt|habe bilder geschickt|siehe anhang|anhang|pdf\b|foto|bilder|dokument|lieferschein/i.test(lower);

  if (wantsNewOrder) highlights.push({ word: "Neuer Auftrag", type: "aktion" });
  if (wantsNewCustomer) highlights.push({ word: "Neuer Kunde", type: "aktion" });
  if (wantsQuote) highlights.push({ word: "Angebot", type: "aktion" });
  if (hasEmailOrAttachment) highlights.push({ word: "E-Mail/Bild", type: "aktion" });

  // 5. Theme
  const matchedKeywords: string[] = [];
  if (/reklamation|beschädigt|kratzer|kaputt|defekt|mangel/i.test(lower)) matchedKeywords.push("Reklamation");
  if (/rechnung|zahlung|bezahlen|überweisung|bar\b|offen.*€|€.*offen/i.test(lower)) matchedKeywords.push("Buchhaltung/Zahlung");
  if (/abhol|versand|spedition|lieferung|fertig|termin|morgen|übermorgen/i.test(lower)) matchedKeywords.push("Termin/Logistik");
  if (/angebot|preis|kosten/i.test(lower)) matchedKeywords.push("Angebot");

  let theme = null;
  if (matchedKeywords.includes("Termin/Logistik")) theme = "Abholtermin";
  else if (matchedKeywords.includes("Reklamation")) theme = "Reklamation";
  else if (matchedKeywords.includes("Buchhaltung/Zahlung")) theme = "Zahlungsfrage";
  else if (matchedKeywords.includes("Angebot")) theme = "Angebotsanfrage";
  else if (lower.includes("status") || lower.includes("stand")) theme = "Statusanfrage";
  else if (lower.includes("preis") || lower.includes("kosten")) theme = "Preisanfrage";
  if (theme) highlights.push({ word: theme.split(" ")[0], type: "thema" });

  // 6. Time
  const matchedTime = parseTimePhrase(text);

  // 7. Payment
  let payment = null;
  if (lower.includes("bar")) payment = "Bar bei Abholung";
  else if (lower.includes("rechnung")) payment = "Auf Rechnung";
  else if (lower.includes("überweisung")) payment = "Überweisung";
  else if (lower.includes("ec") || lower.includes("karte")) payment = "EC-Karte";

  // 8. Calculate Confidence & AI Needs
  let requiresAI = false;
  let aiReason = "";
  
  if (lower.match(/problem|beschwerde|verärgert|kompliziert|weiß nicht genau/)) {
      requiresAI = true;
      aiReason = "Komplexer Sachverhalt erkannt (Reizwörter)";
  } else if (text.length > 100 && !matchedCustomer && !matchedOrder) {
      requiresAI = true;
      aiReason = "Langer Text, aber Kunde/Auftrag unklar";
  }

  // Answer formulation
  let suggestedAnswer = "Guten Tag, wie kann ich helfen?";
  if (matchedOrder && matchedCustomer) {
      suggestedAnswer = `Guten Tag ${matchedCustomer.name}, zu Ihrem Auftrag ${matchedOrder.orderNumber} (${matchedOrder.task}) - er ist aktuell: ${matchedOrder.statusText}.`;
  } else if (matchedCustomer) {
      suggestedAnswer = `Guten Tag ${matchedCustomer.name}, ich habe Ihre Akte offen. Welchen Auftrag betrifft es?`;
  }

  return {
    matchedCustomer,
    customerCandidates,
    matchedOrder,
    orderCandidates,
    matchedMaterial: material,
    surfaceRequested,
    matchedTheme: theme,
    matchedTime,
    matchedPayment: payment,
    intents: {
      wantsNewOrder,
      wantsNewCustomer,
      wantsQuote,
      hasEmailOrAttachment
    },
    suggestedAnswer,
    overallConfidence: matchedCustomer ? (matchedOrder ? 90 : 70) : 40,
    requiresAI,
    aiReason,
    highlights
  };
}
