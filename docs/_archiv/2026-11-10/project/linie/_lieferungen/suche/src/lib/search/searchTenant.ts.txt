import "server-only";

import { resolveAuthorization } from "@/lib/server/authorization";
import { readTenantOperationalOrders } from "@/lib/server/orderStationRead";
import {
  searchOrderIntakeCustomers,
  type OrderIntakeCustomerOption,
} from "@/lib/server/orderIntakeRead";
import type { OperationalOrder } from "@/lib/types/operationalOrder";

/**
 * Modul search — Querschnitt „Gehirn" (Bauplan §3, M3 V1, main 54858e4f).
 *
 * search BESITZT NICHTS: kein eigener Speicher, kein Index, keine zweite
 * Wahrheit. Gelesen wird ausschließlich über die existierenden §2-Ports,
 * und zwar nie per Direkt-SQL, sondern über die vorhandenen
 * Server-Read-Funktionen:
 *
 *   - ORDER-Treffer:    readTenantOperationalOrders
 *                       → private.v_operational_station_queue_v1
 *   - CUSTOMER-Treffer: searchOrderIntakeCustomers
 *                       → private.v_order_intake_customers_v1
 *
 * Die Receipts-Views (v_order_intake_receipts_v1, v_order_station_receipts_v1)
 * sind reine Punkt-Lookups (orderId + clientEventId, teils actor-gebunden) und
 * bieten keinen durchsuchbaren Port; Positionen der Aufträge sind über das
 * parts-Feld der Queue-View abgedeckt. Weitergehende Suchdokumente
 * (Positionen/Notizen der Karten) liefert der Writer als L4 (Bauplan §5).
 *
 * Tenant-Filter kommt IMMER aus resolveAuthorization() (Fundament). Ohne
 * gültige Session: Denial, fail-closed, kein Portzugriff. Ein späterer
 * KI-Such-Adapter dockt ÜBER searchTenant an, nie daneben.
 */

export type SearchHitType = "ORDER" | "CUSTOMER";

export type SearchHit = {
  type: SearchHitType;
  id: string;
  title: string;
  subtitle: string;
  status: string;
  matchField: string;
};

/**
 * Dieselbe diskriminierte Result-Union wie alle Module (Bauplan §1);
 * OK trägt bei diesem Lese-Port die Treffer statt eines Receipts.
 * search selbst erzeugt in V1 nur OK | UNAUTHENTICATED | VALIDATION_ERROR |
 * UNAVAILABLE — die übrigen Codes gehören zum gemeinsamen Vertrag und werden
 * von der UI ehrlich behandelt.
 */
export type SearchTenantResult =
  | { code: "OK"; query: string; hits: SearchHit[] }
  | { code: "UNAUTHENTICATED"; message: string }
  | { code: "FORBIDDEN"; message: string }
  | { code: "NOT_FOUND"; message: string }
  | { code: "CONFLICT"; message: string }
  | { code: "VALIDATION_ERROR"; message: string }
  | { code: "UNAVAILABLE"; message: string };

/** Obergrenze je Treffer-Typ; Kunden-Port kappt serverseitig ohnehin bei 20. */
export const SEARCH_MAX_HITS_PER_TYPE = 20;
/** Angleichung an das Limit des Kunden-Such-Ports (query ≤ 80 nach Trim). */
export const SEARCH_MAX_QUERY_LENGTH = 80;

const MESSAGE_UNAVAILABLE = "Suche ist derzeit nicht verfügbar.";
const MESSAGE_UNAUTHENTICATED = "Sitzung oder Berechtigung ist nicht verfügbar.";
const MESSAGE_QUERY_INVALID = "Suchbegriff ist ungültig oder zu lang.";

function containsQuery(value: string | null | undefined, loweredQuery: string): boolean {
  return typeof value === "string" && value.toLowerCase().includes(loweredQuery);
}

/**
 * matchField für ORDER-Treffer: erstes Feld in fester Reihenfolge, das den
 * Suchbegriff enthält. Alle Felder stammen unverändert aus dem Queue-Port;
 * search erfindet nie Felder.
 */
function orderMatchField(order: OperationalOrder, loweredQuery: string): string | null {
  if (containsQuery(order.orderNumber, loweredQuery)) return "orderNumber";
  if (containsQuery(order.title, loweredQuery)) return "title";
  if (containsQuery(order.customerName, loweredQuery)) return "customerName";
  if (containsQuery(order.task, loweredQuery)) return "task";
  const partsMatch = order.parts.some(
    (part) =>
      containsQuery(part.name, loweredQuery) ||
      containsQuery(part.surfaceRequested, loweredQuery) ||
      containsQuery(part.material, loweredQuery),
  );
  if (partsMatch) return "parts";
  return null;
}

/**
 * matchField für CUSTOMER-Treffer: Die Filterung passiert serverseitig im Port
 * (search_text). Zur ehrlichen Kennzeichnung wird das erste sichtbare Feld
 * ermittelt, das den Begriff enthält; matcht nur der (nicht exponierte)
 * search_text, wird das als "searchText" ausgewiesen — nie geraten.
 */
function customerMatchField(customer: OrderIntakeCustomerOption, loweredQuery: string): string {
  if (containsQuery(customer.name, loweredQuery)) return "name";
  if (containsQuery(customer.companyName, loweredQuery)) return "companyName";
  if (containsQuery(customer.customerNumber, loweredQuery)) return "customerNumber";
  if (containsQuery(customer.city, loweredQuery)) return "city";
  return "searchText";
}

function toOrderHit(order: OperationalOrder, matchField: string): SearchHit {
  return {
    type: "ORDER",
    id: order.id,
    title: order.title,
    subtitle: `${order.orderNumber} · ${order.station}`,
    status: order.status,
    matchField,
  };
}

function toCustomerHit(customer: OrderIntakeCustomerOption, matchField: string): SearchHit {
  return {
    type: "CUSTOMER",
    id: customer.id,
    title: customer.companyName ?? customer.name,
    subtitle: [customer.customerNumber, customer.city]
      .filter((value): value is string => typeof value === "string" && value.length > 0)
      .join(" · "),
    status: customer.customerType,
    matchField,
  };
}

/**
 * Querschnittssuche über alles, was die App heute über Ports kennt.
 *
 * Reihenfolge deterministisch: erst ORDER-Treffer (Port-Reihenfolge:
 * created_at DESC), dann CUSTOMER-Treffer (Port-Reihenfolge: orders_count
 * DESC), je Typ gekappt auf SEARCH_MAX_HITS_PER_TYPE. Leerer Suchbegriff
 * liefert OK mit leeren Treffern ohne Portzugriff. Jeder Portfehler (auch
 * Ownership-/Integritätsverletzungen, die die Ports fail-closed werfen) wird
 * ohne internes Fehler-Leak als UNAVAILABLE gemeldet.
 */
export async function searchTenant(query: string): Promise<SearchTenantResult> {
  if (typeof query !== "string") {
    return { code: "VALIDATION_ERROR", message: MESSAGE_QUERY_INVALID };
  }
  const normalized = query.trim();
  if (normalized.length > SEARCH_MAX_QUERY_LENGTH) {
    return { code: "VALIDATION_ERROR", message: MESSAGE_QUERY_INVALID };
  }

  const authorization = await resolveAuthorization().catch(() => null);
  if (!authorization) {
    return { code: "UNAVAILABLE", message: MESSAGE_UNAVAILABLE };
  }
  if (!authorization.ok) {
    return authorization.reason === "AUTHORIZATION_UNAVAILABLE"
      ? { code: "UNAVAILABLE", message: MESSAGE_UNAVAILABLE }
      : { code: "UNAUTHENTICATED", message: MESSAGE_UNAUTHENTICATED };
  }

  if (normalized.length === 0) {
    return { code: "OK", query: normalized, hits: [] };
  }

  const loweredQuery = normalized.toLowerCase();

  try {
    const [orders, customers] = await Promise.all([
      readTenantOperationalOrders(authorization.data),
      searchOrderIntakeCustomers(authorization.data, { query: normalized }),
    ]);

    const orderHits: SearchHit[] = [];
    for (const order of orders) {
      if (orderHits.length >= SEARCH_MAX_HITS_PER_TYPE) break;
      const matchField = orderMatchField(order, loweredQuery);
      if (matchField) orderHits.push(toOrderHit(order, matchField));
    }

    const customerHits = customers
      .slice(0, SEARCH_MAX_HITS_PER_TYPE)
      .map((customer) => toCustomerHit(customer, customerMatchField(customer, loweredQuery)));

    return { code: "OK", query: normalized, hits: [...orderHits, ...customerHits] };
  } catch {
    return { code: "UNAVAILABLE", message: MESSAGE_UNAVAILABLE };
  }
}
