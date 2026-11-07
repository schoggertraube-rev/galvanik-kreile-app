import "server-only";

import { sql } from "drizzle-orm";
import type { PrivilegedTenantTransaction } from "@/lib/server/privilegedDb";
import type {
  CustomerAgreementRecord,
  CustomerAgreementType,
} from "@/modules/customers/public";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const DATE = /^\d{4}-\d{2}-\d{2}$/;
const TYPES = new Set<CustomerAgreementType>([
  "ausgabe_ohne_zahlung",
  "sammelrechnung",
  "zahlungsziel",
]);

export type EffectiveCustomerAgreementReadInput = {
  tenantId: string;
  customerId: string;
  orderId: string;
  lock?: boolean;
};

export type InactiveCustomerAgreementHint = {
  label: string;
  type: CustomerAgreementType;
  state: "expired" | "revoked";
  date: string;
};

type AgreementRow = {
  id: string;
  tenant_id: string;
  customer_id: string;
  order_id: string | null;
  position: number | string;
  bezeichnung: string;
  wert: string | null;
  typ: string;
  ziel_tage: number | string | null;
  geld: boolean;
  hinweis: boolean;
  gueltig_bis: Date | string | null;
  grund: string;
  version: number | string;
  created_at: Date | string;
  created_by_name: string | null;
};

type InactiveAgreementRow = {
  tenant_id: string;
  customer_id: string;
  order_id: string | null;
  bezeichnung: string;
  typ: string | null;
  gueltig_bis: Date | string | null;
  widerrufen_am: Date | string | null;
};

function textId(value: unknown): value is string {
  return typeof value === "string" && value.trim() === value && value.length >= 1 && value.length <= 128;
}

function integer(value: unknown, error: string): number {
  const parsed = typeof value === "number" ? value : Number(value);
  if (!Number.isSafeInteger(parsed)) throw new Error(error);
  return parsed;
}

function dateOnly(value: Date | string | null): string | null {
  if (value === null) return null;
  if (typeof value === "string" && DATE.test(value)) return value;
  const parsed = value instanceof Date ? value : new Date(value);
  if (!Number.isFinite(parsed.getTime())) throw new Error("CUSTOMER_AGREEMENT_VALID_UNTIL_INVALID");
  return parsed.toISOString().slice(0, 10);
}

function iso(value: Date | string): string {
  const parsed = value instanceof Date ? value : new Date(value);
  if (!Number.isFinite(parsed.getTime())) throw new Error("CUSTOMER_AGREEMENT_CREATED_AT_INVALID");
  return parsed.toISOString();
}

function personName(value: unknown): string | null {
  if (value === null) return null;
  if (typeof value !== "string" || value.trim() !== value || value.length < 1 || value.length > 200) {
    throw new Error("CUSTOMER_AGREEMENT_CREATED_BY_INVALID");
  }
  return value;
}

function mapAgreement(
  row: AgreementRow,
  input: EffectiveCustomerAgreementReadInput,
): CustomerAgreementRecord {
  const type = TYPES.has(row.typ as CustomerAgreementType) ? row.typ as CustomerAgreementType : null;
  const position = integer(row.position, "CUSTOMER_AGREEMENT_POSITION_INVALID");
  const version = integer(row.version, "CUSTOMER_AGREEMENT_VERSION_INVALID");
  const targetDays = row.ziel_tage === null ? null : integer(row.ziel_tage, "CUSTOMER_AGREEMENT_TARGET_DAYS_INVALID");
  const validUntil = dateOnly(row.gueltig_bis);
  if (
    !UUID.test(row.id)
    || row.tenant_id !== input.tenantId
    || row.customer_id !== input.customerId
    || (row.order_id !== null && row.order_id !== input.orderId)
    || position < 1
    || position > 20
    || typeof row.bezeichnung !== "string"
    || row.bezeichnung.trim() !== row.bezeichnung
    || row.bezeichnung.length < 1
    || row.bezeichnung.length > 160
    || (row.wert !== null && (
      typeof row.wert !== "string"
      || row.wert.trim() !== row.wert
      || row.wert.length > 200
    ))
    || type === null
    || row.geld !== true
    || typeof row.hinweis !== "boolean"
    || version < 1
    || (targetDays !== null && (targetDays < 1 || targetDays > 120))
    || (["sammelrechnung", "zahlungsziel"].includes(type) !== (targetDays !== null))
    || typeof row.grund !== "string"
    || row.grund.trim() !== row.grund
    || row.grund.length < 3
    || row.grund.length > 400
  ) throw new Error("CUSTOMER_AGREEMENT_EFFECTIVE_ROW_INVALID");

  return {
    id: row.id,
    customerId: row.customer_id,
    orderId: row.order_id,
    position,
    label: row.bezeichnung,
    value: row.wert,
    type,
    targetDays,
    money: row.geld,
    notice: row.hinweis,
    validUntil,
    reason: row.grund,
    version,
    revokedAt: null,
    revokedBy: null,
    revokeReason: null,
    createdAt: iso(row.created_at),
    createdBy: personName(row.created_by_name),
  };
}

/**
 * The view is the one database truth for current typed payment agreements.
 * An order agreement has precedence over a customer agreement.
 */
export async function readEffectiveCustomerAgreement(
  tx: PrivilegedTenantTransaction,
  input: EffectiveCustomerAgreementReadInput,
): Promise<CustomerAgreementRecord | null> {
  if (!textId(input.tenantId) || !textId(input.customerId) || !textId(input.orderId)) {
    throw new Error("CUSTOMER_AGREEMENT_EFFECTIVE_INPUT_INVALID");
  }
  const base = sql`
    SELECT id::text, tenant_id, customer_id, order_id, position, bezeichnung, wert, typ,
      ziel_tage, geld, hinweis, gueltig_bis, grund, version, created_at, created_by_name
    FROM private.v_customer_effective_agreement_v1
    WHERE tenant_id = ${input.tenantId}
      AND customer_id = ${input.customerId}
      AND (order_id IS NULL OR order_id = ${input.orderId})
    ORDER BY CASE WHEN order_id = ${input.orderId} THEN 0 ELSE 1 END,
      created_at DESC, id
    LIMIT 3
  `;
  // PostgreSQL cannot safely lock through the display view's optional creator
  // join. The locked form therefore reads the same current-row predicate from
  // its base table and locks exactly the agreement rows that can affect a
  // command. The public helper remains the one application reader.
  const locked = sql`
    SELECT agreement.id::text, agreement.tenant_id, agreement.customer_id,
      agreement.order_id, agreement.position, agreement.bezeichnung, agreement.wert,
      agreement.typ, agreement.ziel_tage, agreement.geld, agreement.hinweis,
      agreement.gueltig_bis, agreement.grund, agreement.version,
      agreement.created_at, NULL::text AS created_by_name
    FROM public.customer_agreements agreement
    WHERE agreement.tenant_id = ${input.tenantId}
      AND agreement.customer_id = ${input.customerId}
      AND (agreement.order_id IS NULL OR agreement.order_id = ${input.orderId})
      AND agreement.typ IS NOT NULL
      AND agreement.geld = true
      AND agreement.widerrufen_am IS NULL
      AND (
        agreement.gueltig_bis IS NULL
        OR agreement.gueltig_bis >= timezone('Europe/Berlin', now())::date
      )
    ORDER BY CASE WHEN agreement.order_id = ${input.orderId} THEN 0 ELSE 1 END,
      agreement.created_at DESC, agreement.id
    LIMIT 3
    FOR UPDATE
  `;
  const rows = await tx.execute<AgreementRow>(input.lock ? locked : base);
  const agreements = rows.map((row) => mapAgreement(row, input));
  const orderAgreements = agreements.filter((agreement) => agreement.orderId === input.orderId);
  const customerAgreements = agreements.filter((agreement) => agreement.orderId === null);
  if (
    agreements.length !== rows.length
    || orderAgreements.length > 1
    || customerAgreements.length > 1
    || agreements.length !== orderAgreements.length + customerAgreements.length
  ) throw new Error("CUSTOMER_AGREEMENT_EFFECTIVE_AMBIGUOUS");
  return orderAgreements[0] ?? customerAgreements[0] ?? null;
}

/**
 * 10.1 needs to explain why a formerly typed agreement no longer unlocks
 * goods-out.  This remains a read of the same canonical agreement rows; it
 * never promotes a historical row into an effective agreement.
 */
export async function readInactiveCustomerAgreementHint(
  tx: PrivilegedTenantTransaction,
  input: Omit<EffectiveCustomerAgreementReadInput, "lock">,
): Promise<InactiveCustomerAgreementHint | null> {
  if (!textId(input.tenantId) || !textId(input.customerId) || !textId(input.orderId)) {
    throw new Error("CUSTOMER_AGREEMENT_INACTIVE_INPUT_INVALID");
  }
  const rows = await tx.execute<InactiveAgreementRow>(sql`
    SELECT tenant_id, customer_id, order_id, bezeichnung, typ, gueltig_bis, widerrufen_am
    FROM public.customer_agreements
    WHERE tenant_id = ${input.tenantId}
      AND customer_id = ${input.customerId}
      AND (order_id IS NULL OR order_id = ${input.orderId})
      AND typ IS NOT NULL
      AND (
        widerrufen_am IS NOT NULL
        OR gueltig_bis < timezone('Europe/Berlin', now())::date
      )
    ORDER BY CASE WHEN order_id = ${input.orderId} THEN 0 ELSE 1 END,
      COALESCE(widerrufen_am, gueltig_bis::timestamptz, '-infinity'::timestamptz) DESC,
      id DESC
    LIMIT 2
  `);
  if (rows.length === 0) return null;
  const row = rows[0];
  const type = row?.typ && TYPES.has(row.typ as CustomerAgreementType)
    ? row.typ as CustomerAgreementType
    : null;
  if (
    rows.length > 2
    || !row
    || row.tenant_id !== input.tenantId
    || row.customer_id !== input.customerId
    || (row.order_id !== null && row.order_id !== input.orderId)
    || typeof row.bezeichnung !== "string"
    || row.bezeichnung.trim() !== row.bezeichnung
    || row.bezeichnung.length < 1
    || row.bezeichnung.length > 160
    || type === null
  ) {
    throw new Error("CUSTOMER_AGREEMENT_INACTIVE_ROW_INVALID");
  }
  if (row.widerrufen_am !== null) {
    return { label: row.bezeichnung, type, state: "revoked", date: iso(row.widerrufen_am) };
  }
  const validUntil = dateOnly(row.gueltig_bis);
  if (validUntil === null) throw new Error("CUSTOMER_AGREEMENT_INACTIVE_DATE_INVALID");
  return { label: row.bezeichnung, type, state: "expired", date: validUntil };
}
