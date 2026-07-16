import type { Customer } from "@/lib/repositories/customersRepository";
import type { Order } from "@/lib/repositories/ordersRepository";

export interface LocalAnalysisResult {
  matchedCustomer: Customer | null;
  customerCandidates: {
    id: string;
    name: string;
    city: string;
    phone: string;
    openOrdersCount: number;
    confidence: number;
    matchReason: string;
  }[];
  matchedOrder: Order | null;
  orderCandidates: {
    id: string;
    orderNumber: string;
    task: string;
    status: string;
    station: string;
    dueDate: string;
    confidence: number;
    matchReason: string;
  }[];
  matchedMaterial: string | null;
  surfaceRequested: string | null;
  matchedTheme: string | null;
  matchedTime: {
    label: string;
    dayOfWeek: number;
    availability: "not_checked";
    intent: "deadline" | "pickup" | "dropoff" | "callback";
  } | null;
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
  highlights: {
    word: string;
    type: "kunde" | "auftrag" | "material" | "thema" | "zeit" | "aktion";
  }[];
}

const CLOSED_ORDER_STATUSES = new Set(["done", "completed", "cancelled", "canceled", "shipped"]);

function isOpenOrder(order: Order): boolean {
  return !CLOSED_ORDER_STATUSES.has(order.status.toLowerCase());
}

function parseTimePhrase(text: string): LocalAnalysisResult["matchedTime"] {
  const lower = text.toLowerCase();
  const now = new Date();
  const weekdays = ["So", "Mo", "Di", "Mi", "Do", "Fr", "Sa"];
  const daysUntil = (weekday: number) => (weekday - now.getDay() + 7) % 7 || 7;
  const timePatterns: [RegExp, number][] = [
    [/\bübermorgen\b/, 2],
    [/\bmorgen\b/, 1],
    [/\bheute\b/, 0],
    [/\bmontag\b/, daysUntil(1)],
    [/\bdienstag\b/, daysUntil(2)],
    [/\bmittwoch\b/, daysUntil(3)],
    [/\bdonnerstag\b/, daysUntil(4)],
    [/\bfreitag\b/, daysUntil(5)],
  ];
  const timeMatch = lower.match(/\b(\d{1,2})(?::(\d{2}))?\s*(?:uhr)?\b/);
  const time = timeMatch ? `${timeMatch[1]}:${timeMatch[2] || "00"}` : null;
  let intent: NonNullable<LocalAnalysisResult["matchedTime"]>["intent"] = "pickup";
  if (/\bbis\b/.test(lower)) intent = "deadline";
  else if (/\bbringen|abgeben\b/.test(lower)) intent = "dropoff";
  else if (/\brückruf|anrufen\b/.test(lower)) intent = "callback";

  for (const [pattern, daysAhead] of timePatterns) {
    if (!pattern.test(lower)) continue;
    const target = new Date(now);
    target.setDate(now.getDate() + daysAhead);
    const suffix = time ? ` · ${time}` : "";
    return {
      label: `${weekdays[target.getDay()]} ${target.getDate()}.${target.getMonth() + 1}.${suffix}`,
      dayOfWeek: target.getDay(),
      availability: "not_checked",
      intent,
    };
  }

  const month = lower.match(/\bbis\s+(januar|februar|märz|april|mai|juni|juli|august|september|oktober|november|dezember)\b/i);
  return month
    ? { label: month[0], dayOfWeek: -1, availability: "not_checked", intent: "deadline" }
    : null;
}

function findCustomerCandidates(
  text: string,
  customers: readonly Customer[],
  orders: readonly Order[],
): LocalAnalysisResult["customerCandidates"] {
  const normalized = text.toLocaleLowerCase("de-DE");
  const textWords = new Set(normalized.split(/[^\p{L}\p{N}]+/u).filter((word) => word.length >= 4));
  const candidates: LocalAnalysisResult["customerCandidates"] = [];

  for (const customer of customers) {
    const name = customer.name.trim();
    if (!name) continue;
    const lowerName = name.toLocaleLowerCase("de-DE");
    const nameWords = lowerName.split(/[^\p{L}\p{N}]+/u).filter((word) => word.length >= 4);
    const exact = normalized.includes(lowerName);
    const matchingWord = nameWords.find((word) => textWords.has(word));
    if (!exact && !matchingWord) continue;
    const openOrdersCount = orders.filter((order) => order.customerId === customer.id && isOpenOrder(order)).length;
    candidates.push({
      id: customer.id,
      name,
      city: customer.city?.trim() || "nicht hinterlegt",
      phone: customer.phone?.trim() || "nicht hinterlegt",
      openOrdersCount,
      confidence: exact ? 98 : 72,
      matchReason: exact ? "Vollständiger Name im Text" : `Namensbestandteil „${matchingWord}“ im Text`,
    });
  }
  return candidates.sort((left, right) => right.confidence - left.confidence || left.name.localeCompare(right.name, "de"));
}

export function performLocalAnalysis(
  text: string,
  customers: readonly Customer[] = [],
  orders: readonly Order[] = [],
): LocalAnalysisResult {
  const lower = text.toLocaleLowerCase("de-DE");
  const highlights: LocalAnalysisResult["highlights"] = [];
  const orderNumber = text.match(/\bA-\d{4}-\d{4}\b/i)?.[0].toUpperCase() || null;
  let matchedOrder = orderNumber
    ? orders.find((order) => order.orderNumber.toUpperCase() === orderNumber) || null
    : null;
  if (orderNumber) highlights.push({ word: orderNumber, type: "auftrag" });

  const customerCandidates = findCustomerCandidates(text, customers, orders);
  let matchedCustomer = customerCandidates.length === 1 && customerCandidates[0].confidence >= 90
    ? customers.find((customer) => customer.id === customerCandidates[0].id) || null
    : null;
  if (matchedOrder) {
    matchedCustomer = customers.find((customer) => customer.id === matchedOrder?.customerId) || null;
  }
  if (matchedCustomer) {
    const matchingNamePart = matchedCustomer.name.split(/\s+/).find((part) => part.length >= 4 && lower.includes(part.toLocaleLowerCase("de-DE")));
    if (matchingNamePart) highlights.push({ word: matchingNamePart, type: "kunde" });
  }

  let orderCandidates: LocalAnalysisResult["orderCandidates"] = [];
  if (matchedCustomer && !matchedOrder) {
    const openOrders = orders.filter((order) => order.customerId === matchedCustomer?.id && isOpenOrder(order));
    orderCandidates = openOrders.map((order) => ({
      id: order.id,
      orderNumber: order.orderNumber,
      task: order.task?.trim() || order.title?.trim() || "Keine Beschreibung hinterlegt",
      status: order.statusText?.trim() || order.status,
      station: order.station?.trim() || "nicht zugeordnet",
      dueDate: order.dueDate?.trim() || "kein Termin hinterlegt",
      confidence: 80,
      matchReason: "Offener Auftrag des erkannten Kunden",
    }));
    if (openOrders.length === 1) matchedOrder = openOrders[0];
  }

  const materials = ["zink", "messing", "kupfer", "gold", "silber", "alu", "stahl", "edelstahl", "bronze"];
  const finishes = ["vernickeln", "verchromen", "verzinken", "vergolden", "versilbern", "brünieren", "eloxieren"];
  const material = materials.find((candidate) => lower.includes(candidate)) || null;
  const surfaceRequested = finishes.find((candidate) => lower.includes(candidate)) || null;
  if (material) highlights.push({ word: material, type: "material" });
  if (surfaceRequested) highlights.push({ word: surfaceRequested, type: "material" });

  const wantsNewOrder = /neuer auftrag|auftrag anlegen|möchte etwas abgeben|kommt mit teilen|bringt|neue teile|neue ware|zum (versilbern|verchromen|verzinken) bringen/i.test(lower);
  const wantsNewCustomer = /neuer kunde|noch nicht angelegt|erstmalig|zum ersten mal|keine kundennummer/i.test(lower);
  const wantsQuote = /kostenvoranschlag|\bkv\b|angebot|preis|was kostet|ungefährer preis|vorab schätzen/i.test(lower);
  const hasEmailOrAttachment = /e-mail|\bmail\b|habe geschickt|bilder geschickt|siehe anhang|anhang|\bpdf\b|foto|bilder|dokument|lieferschein/i.test(lower);

  const themes: [RegExp, string][] = [
    [/reklamation|beschädigt|kratzer|kaputt|defekt|mangel/i, "Reklamation"],
    [/rechnung|zahlung|bezahlen|überweisung|\bbar\b|offen.*€|€.*offen/i, "Zahlungsfrage"],
    [/abhol|versand|spedition|lieferung|fertig|termin|morgen|übermorgen/i, "Termin/Logistik"],
    [/angebot|preis|kosten/i, "Angebotsanfrage"],
    [/status|stand/i, "Statusanfrage"],
  ];
  const matchedTheme = themes.find(([pattern]) => pattern.test(lower))?.[1] || null;
  const matchedTime = parseTimePhrase(text);
  const matchedPayment = lower.includes("bar")
    ? "Barzahlung im Gespräch genannt"
    : lower.includes("rechnung")
      ? "Rechnung im Gespräch genannt"
      : lower.includes("überweisung")
        ? "Überweisung im Gespräch genannt"
        : lower.includes("ec") || lower.includes("karte")
          ? "Kartenzahlung im Gespräch genannt"
          : null;

  const requiresAI = /problem|beschwerde|verärgert|kompliziert|weiß nicht genau/.test(lower)
    || (text.length > 100 && !matchedCustomer && !matchedOrder);
  const aiReason = requiresAI
    ? "Komplexer oder noch nicht eindeutig zugeordneter Text"
    : undefined;

  let suggestedAnswer = "Die Angaben sind erfasst; Kunde und Auftrag sind noch nicht eindeutig zugeordnet.";
  if (matchedOrder && matchedCustomer) {
    const task = matchedOrder.task?.trim() || matchedOrder.title?.trim();
    const status = matchedOrder.statusText?.trim() || matchedOrder.status;
    suggestedAnswer = `Gefunden: ${matchedCustomer.name}, Auftrag ${matchedOrder.orderNumber}${task ? ` (${task})` : ""}. Hinterlegter Status: ${status}.`;
  } else if (matchedCustomer) {
    suggestedAnswer = `Gefunden: ${matchedCustomer.name}. Welchen Auftrag betrifft der Anruf?`;
  }

  return {
    matchedCustomer,
    customerCandidates,
    matchedOrder,
    orderCandidates,
    matchedMaterial: material,
    surfaceRequested,
    matchedTheme,
    matchedTime,
    matchedPayment,
    intents: { wantsNewOrder, wantsNewCustomer, wantsQuote, hasEmailOrAttachment },
    suggestedAnswer,
    overallConfidence: matchedCustomer ? (matchedOrder ? 90 : 70) : 35,
    requiresAI,
    aiReason,
    highlights,
  };
}
