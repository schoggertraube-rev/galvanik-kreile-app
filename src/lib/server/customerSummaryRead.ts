import "server-only";

import { sql } from "drizzle-orm";
import type { AuthorizationSnapshot } from "@/lib/server/authorization";
import { withPrivilegedTenantTransaction } from "@/lib/server/privilegedDb";

const MAX_ID_LENGTH = 128;

export type CustomerSummaryOrder = {
  id: string;
  orderNumber: string;
  title: string;
  station: string;
  status: string;
  version: number;
  dueAt: string | null;
};

export type CustomerSummary = {
  id: string;
  customerNumber: string | null;
  name: string;
  companyName: string | null;
  type: string;
  contactPerson: string | null;
  email: string | null;
  phone: string | null;
  street: string | null;
  address: string | null;
  zipCode: string | null;
  city: string | null;
  country: string | null;
  classification: string | null;
  internalNotes: string | null;
  tags: string[];
  createdAt: string;
  updatedAt: string;
  orderCount: number;
  wareImHausCount: number;
  wareImHaus: boolean;
  orders: CustomerSummaryOrder[];
};

export type CustomerSummaryReadResult =
  | { code: "OK"; data: CustomerSummary }
  | { code: "FORBIDDEN"; message: string }
  | { code: "NOT_FOUND"; message: string }
  | { code: "VALIDATION_ERROR"; message: string }
  | { code: "UNAVAILABLE"; message: string };

type SummaryRow = {
  id: string;
  tenant_id: string;
  customer_number: string | null;
  name: string;
  company_name: string | null;
  type: string;
  contact_person: string | null;
  email: string | null;
  phone: string | null;
  street: string | null;
  address: string | null;
  zip_code: string | null;
  city: string | null;
  country: string | null;
  classification: string | null;
  internal_notes: string | null;
  tags: unknown;
  created_at: Date | string;
  updated_at: Date | string;
  order_count: number;
  ware_im_haus_count: number;
  ware_im_haus: boolean;
  orders: unknown;
  integrity_ok: boolean;
};

function validId(value: unknown): value is string {
  return typeof value === "string"
    && value.trim() === value
    && value.length >= 1
    && value.length <= MAX_ID_LENGTH;
}

function toIso(value: unknown): string {
  const date = value instanceof Date ? value : new Date(value as string);
  if (!Number.isFinite(date.getTime())) throw new Error("CUSTOMER_SUMMARY_TIME_INVALID");
  return date.toISOString();
}

function nullableIso(value: unknown): string | null {
  return value === null ? null : toIso(value);
}

function exactObject(value: unknown, keys: readonly string[]): value is Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const actual = Object.keys(value).sort();
  const expected = [...keys].sort();
  return actual.length === expected.length && actual.every((key, index) => key === expected[index]);
}

function mapOrders(value: unknown): CustomerSummaryOrder[] {
  if (!Array.isArray(value)) throw new Error("CUSTOMER_SUMMARY_ORDERS_INVALID");
  return value.map((candidate) => {
    if (!exactObject(candidate, ["dueAt", "id", "orderNumber", "station", "status", "title", "version"])) {
      throw new Error("CUSTOMER_SUMMARY_ORDER_SHAPE_INVALID");
    }
    if (
      !validId(candidate.id)
      || typeof candidate.orderNumber !== "string"
      || candidate.orderNumber.trim().length === 0
      || typeof candidate.title !== "string"
      || candidate.title.trim().length === 0
      || typeof candidate.station !== "string"
      || typeof candidate.status !== "string"
      || !Number.isSafeInteger(candidate.version)
      || (candidate.version as number) < 1
    ) throw new Error("CUSTOMER_SUMMARY_ORDER_INVALID");
    return {
      id: candidate.id,
      orderNumber: candidate.orderNumber,
      title: candidate.title,
      station: candidate.station,
      status: candidate.status,
      version: candidate.version,
      dueAt: nullableIso(candidate.dueAt),
    } as CustomerSummaryOrder;
  });
}

function mapTags(value: unknown): string[] {
  if (!Array.isArray(value)) throw new Error("CUSTOMER_SUMMARY_TAGS_INVALID");
  const tags = value.map((tag) => {
    if (typeof tag !== "string" || tag.trim() !== tag || tag.length < 1 || tag.length > 80) {
      throw new Error("CUSTOMER_SUMMARY_TAG_INVALID");
    }
    return tag;
  });
  if (new Set(tags).size !== tags.length) throw new Error("CUSTOMER_SUMMARY_TAG_DUPLICATE");
  return tags;
}

function mapSummary(row: SummaryRow, authorization: AuthorizationSnapshot): CustomerSummary {
  const orders = mapOrders(row.orders);
  if (
    row.integrity_ok !== true
    || row.tenant_id !== authorization.tenantId
    || !validId(row.id)
    || row.name.trim() !== row.name
    || row.name.length < 1
    || !Number.isSafeInteger(row.order_count)
    || !Number.isSafeInteger(row.ware_im_haus_count)
    || row.order_count !== orders.length
    || row.ware_im_haus_count !== orders.filter((order) => ["angenommen", "galvanik", "fertig"].includes(order.status)).length
    || row.ware_im_haus !== (row.ware_im_haus_count > 0)
  ) throw new Error("CUSTOMER_SUMMARY_INVALID");
  return {
    id: row.id,
    customerNumber: row.customer_number,
    name: row.name,
    companyName: row.company_name,
    type: row.type,
    contactPerson: row.contact_person,
    email: row.email,
    phone: row.phone,
    street: row.street,
    address: row.address,
    zipCode: row.zip_code,
    city: row.city,
    country: row.country,
    classification: row.classification,
    internalNotes: row.internal_notes,
    tags: mapTags(row.tags),
    createdAt: toIso(row.created_at),
    updatedAt: toIso(row.updated_at),
    orderCount: row.order_count,
    wareImHausCount: row.ware_im_haus_count,
    wareImHaus: row.ware_im_haus,
    orders,
  };
}

export async function readCustomerSummary(
  authorization: AuthorizationSnapshot,
  input: { customerId: string },
): Promise<CustomerSummaryReadResult> {
  if (!exactObject(input, ["customerId"]) || !validId(input.customerId)) {
    return { code: "VALIDATION_ERROR", message: "Ungültige Kundenkennung." };
  }
  if (!authorization.permissions.includes("perm_view_leitstand")) {
    return { code: "FORBIDDEN", message: "Kundenkarte ist nicht erlaubt." };
  }
  try {
    const data = await withPrivilegedTenantTransaction(authorization, async (tx) => {
      const rows = await tx.execute<SummaryRow>(sql`
        SELECT *
        FROM private.v_customer_summary_v1
        WHERE id = ${input.customerId}
        LIMIT 2
      `);
      if (rows.length > 1) throw new Error("CUSTOMER_SUMMARY_AMBIGUOUS");
      return rows[0] ? mapSummary(rows[0], authorization) : null;
    });
    return data
      ? { code: "OK", data }
      : { code: "NOT_FOUND", message: "Kunde nicht verfügbar." };
  } catch {
    return { code: "UNAVAILABLE", message: "Kundenkarte konnte nicht sicher geladen werden." };
  }
}
