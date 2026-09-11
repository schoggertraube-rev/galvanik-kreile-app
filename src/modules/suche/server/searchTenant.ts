import {
  SEARCH_MAX_HITS,
  SEARCH_MAX_HITS_PER_TYPE,
  SEARCH_MAX_QUERY_LENGTH,
  SEARCH_MIN_QUERY_LENGTH,
  type SearchCustomerDocument,
  type SearchHit,
  type SearchMatchField,
  type SearchOrderDocument,
  type SearchPorts,
  type SearchTenantResult,
} from "./types";

const INVALID_QUERY_MESSAGE = "Suchbegriff ist ungültig oder zu lang.";
const UNAVAILABLE_MESSAGE = "Suche ist derzeit nicht verfügbar.";

function normalizedText(value: string): string {
  return value.trim().toLocaleLowerCase("de-DE");
}

function validRequired(value: unknown): value is string {
  return typeof value === "string" && value.trim().length > 0;
}

function validOptional(value: unknown): value is string | null {
  return value === null || validRequired(value);
}

function includesQuery(value: string | null, query: string): boolean {
  return value !== null && normalizedText(value).includes(query);
}

function dateSearchTerms(value: string): string[] {
  if (!value) return [];
  const isoDate = value.slice(0, 10);
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(isoDate);
  if (!match) throw new Error("SEARCH_ORDER_DATE_INVALID");
  const [, year, month, day] = match;
  const parsed = new Date(`${isoDate}T00:00:00.000Z`);
  if (Number.isNaN(parsed.getTime()) || parsed.toISOString().slice(0, 10) !== isoDate) {
    throw new Error("SEARCH_ORDER_DATE_INVALID");
  }
  return [isoDate, `${day}.${month}.${year}`, `${day}.${month}.${year.slice(2)}`];
}

function displayDate(value: string): string | null {
  const terms = dateSearchTerms(value);
  return terms[1] ?? null;
}

function assertOrder(document: SearchOrderDocument): void {
  if (
    !document
    || !validRequired(document.id)
    || !validRequired(document.orderNumber)
    || !validOptional(document.customerName)
    || !validRequired(document.title)
    || !validOptional(document.task)
    || !validRequired(document.station)
    || !validRequired(document.status)
    || typeof document.dueDate !== "string"
    || !Array.isArray(document.parts)
  ) {
    throw new Error("SEARCH_ORDER_DOCUMENT_INVALID");
  }
  dateSearchTerms(document.dueDate);
  for (const part of document.parts) {
    if (!part || !validRequired(part.name) || !validOptional(part.material) || !validOptional(part.surfaceRequested)) {
      throw new Error("SEARCH_ORDER_DOCUMENT_INVALID");
    }
  }
}

function assertCustomer(document: SearchCustomerDocument): void {
  if (
    !document
    || !validRequired(document.id)
    || !validOptional(document.customerNumber)
    || !validRequired(document.name)
    || !validOptional(document.companyName)
    || !validRequired(document.customerType)
    || !validOptional(document.city)
  ) {
    throw new Error("SEARCH_CUSTOMER_DOCUMENT_INVALID");
  }
}

function orderMatchField(order: SearchOrderDocument, query: string): SearchMatchField | null {
  if (includesQuery(order.orderNumber, query)) return "orderNumber";
  for (const part of order.parts) {
    if (includesQuery(part.name, query)) return "part";
    if (includesQuery(part.material, query)) return "material";
    if (includesQuery(part.surfaceRequested, query)) return "surface";
  }
  if (includesQuery(order.title, query)) return "title";
  if (includesQuery(order.customerName, query)) return "customerName";
  if (includesQuery(order.task, query)) return "task";
  if (dateSearchTerms(order.dueDate).some((term) => term.includes(query))) return "dueDate";
  return null;
}

function customerMatchField(customer: SearchCustomerDocument, query: string): SearchMatchField | null {
  if (includesQuery(customer.name, query)) return "name";
  if (includesQuery(customer.companyName, query)) return "companyName";
  if (includesQuery(customer.customerNumber, query)) return "customerNumber";
  if (includesQuery(customer.city, query)) return "city";
  return null;
}

const MATCH_LABEL: Record<SearchMatchField, string> = {
  orderNumber: "Auftragsnummer",
  title: "Auftrag",
  customerName: "Kunde",
  task: "Aufgabe",
  part: "Teil",
  material: "Material",
  surface: "Oberfläche",
  dueDate: "Termin",
  name: "Kundenname",
  companyName: "Firma",
  customerNumber: "Kundennummer",
  city: "Ort",
};

function orderMatchValue(order: SearchOrderDocument, field: SearchMatchField, query: string): string {
  if (field === "orderNumber") return order.orderNumber;
  if (field === "title") return order.title;
  if (field === "customerName") return order.customerName ?? "";
  if (field === "task") return order.task ?? "";
  if (field === "dueDate") return dateSearchTerms(order.dueDate).find((term) => term.includes(query)) ?? order.dueDate;
  for (const part of order.parts) {
    if (field === "part" && includesQuery(part.name, query)) return part.name;
    if (field === "material" && includesQuery(part.material, query)) return part.material ?? "";
    if (field === "surface" && includesQuery(part.surfaceRequested, query)) return part.surfaceRequested ?? "";
  }
  throw new Error("SEARCH_ORDER_MATCH_UNPROVEN");
}

function customerMatchValue(customer: SearchCustomerDocument, field: SearchMatchField): string {
  if (field === "name") return customer.name;
  if (field === "companyName") return customer.companyName ?? "";
  if (field === "customerNumber") return customer.customerNumber ?? "";
  if (field === "city") return customer.city ?? "";
  throw new Error("SEARCH_CUSTOMER_MATCH_UNPROVEN");
}

function toOrderHit(order: SearchOrderDocument, matchField: SearchMatchField, query: string): SearchHit {
  const dueDate = displayDate(order.dueDate);
  return {
    type: "ORDER",
    id: order.id,
    title: order.title,
    subtitle: [order.orderNumber, order.customerName, dueDate ? `Termin ${dueDate}` : null, order.station]
      .filter((value): value is string => Boolean(value))
      .join(" · "),
    status: order.status,
    matchField,
    source: "Auftragsbestand",
    matchLabel: MATCH_LABEL[matchField],
    matchValue: orderMatchValue(order, matchField, query),
    context: [order.orderNumber, order.customerName, dueDate ? `Termin ${dueDate}` : null]
      .filter((value): value is string => Boolean(value)).join(" · "),
    actionLabel: "Auftragskarte öffnen",
  };
}

function toCustomerHit(customer: SearchCustomerDocument, matchField: SearchMatchField): SearchHit {
  return {
    type: "CUSTOMER",
    id: customer.id,
    title: customer.companyName ?? customer.name,
    subtitle: [customer.customerNumber, customer.city]
      .filter((value): value is string => Boolean(value))
      .join(" · "),
    status: customer.customerType,
    matchField,
    source: "Kundenstamm",
    matchLabel: MATCH_LABEL[matchField],
    matchValue: customerMatchValue(customer, matchField),
    context: [customer.companyName ?? customer.name, customer.customerNumber, customer.city]
      .filter((value): value is string => Boolean(value)).join(" · "),
    actionLabel: "Kundenkarte öffnen",
  };
}

function stableHits(hits: SearchHit[]): SearchHit[] {
  return hits.sort((left, right) =>
    left.title.localeCompare(right.title, "de-DE", { sensitivity: "base" })
      || left.id.localeCompare(right.id),
  );
}

export function normalizeSearchQuery(query: unknown):
  | { code: "READY"; query: string }
  | { code: "EMPTY"; query: string }
  | { code: "INVALID" } {
  if (typeof query !== "string") return { code: "INVALID" };
  const normalized = query.trim();
  if (normalized.length > SEARCH_MAX_QUERY_LENGTH) return { code: "INVALID" };
  if (normalized.length < SEARCH_MIN_QUERY_LENGTH) return { code: "EMPTY", query: normalized };
  return { code: "READY", query: normalized };
}

export async function searchTenant(query: unknown, ports: SearchPorts): Promise<SearchTenantResult> {
  const normalized = normalizeSearchQuery(query);
  if (normalized.code === "INVALID") {
    return { code: "VALIDATION_ERROR", message: INVALID_QUERY_MESSAGE };
  }
  if (normalized.code === "EMPTY") {
    return { code: "OK", query: normalized.query, hits: [] };
  }

  try {
    const [orders, customers] = await Promise.all([
      ports.readOrders(),
      ports.searchCustomers(normalized.query),
    ]);
    const loweredQuery = normalizedText(normalized.query);
    const orderHits = new Map<string, SearchHit>();
    for (const order of orders) {
      assertOrder(order);
      const matchField = orderMatchField(order, loweredQuery);
      if (matchField && !orderHits.has(order.id)) orderHits.set(order.id, toOrderHit(order, matchField, loweredQuery));
    }
    const customerHits = new Map<string, SearchHit>();
    for (const customer of customers) {
      assertCustomer(customer);
      const matchField = customerMatchField(customer, loweredQuery);
      if (!matchField) throw new Error("SEARCH_CUSTOMER_MATCH_UNPROVEN");
      if (!customerHits.has(customer.id)) {
        customerHits.set(customer.id, toCustomerHit(customer, matchField));
      }
    }
    const hits = [
      ...stableHits([...orderHits.values()]).slice(0, SEARCH_MAX_HITS_PER_TYPE),
      ...stableHits([...customerHits.values()]).slice(0, SEARCH_MAX_HITS_PER_TYPE),
    ].slice(0, SEARCH_MAX_HITS);
    return { code: "OK", query: normalized.query, hits };
  } catch {
    return { code: "UNAVAILABLE", message: UNAVAILABLE_MESSAGE };
  }
}
