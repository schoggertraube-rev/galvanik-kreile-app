import "server-only";

import { sql } from "drizzle-orm";
import {hasAuthorizationArea,type AuthorizationSnapshot} from "@/lib/server/authorization";
import { overdueInvoiceCondition } from "@/lib/server/paymentContract";
import {evaluateOrderPriority} from '@/lib/priority';
import type {CustomerHint,CustomerListSignals} from '@/modules/customers/public';
import { withPrivilegedTenantTransaction } from "@/lib/server/privilegedDb";

import {
  CUSTOMER_AGREEMENT_TYPES,
  customerContactLabel,
  type CustomerAgreementSummary,
  type CustomerAgreementType,
  type CustomerStoredProfile,
} from "@/modules/customers/public";
import type {PrivilegedTenantTransaction} from "@/lib/server/privilegedDb";

const MAX_ID_LENGTH = 128;
const AGREEMENT_TYPES = new Set<string>(CUSTOMER_AGREEMENT_TYPES);

/** One batched projection for the list and card; hidden money/mail reasons never leave this port. */
export async function readCustomerListSignals(auth:AuthorizationSnapshot,customerIds:readonly string[]):Promise<Map<string,CustomerListSignals>> {
  const {hasAuthorizationArea}=await import('@/lib/server/authorization');
  if(!hasAuthorizationArea(auth,'kunden'))throw Error('CUSTOMER_SIGNALS_FORBIDDEN');
  if(!customerIds.length)return new Map();
  if(customerIds.some(id=>typeof id!=='string'||!id||id.length>128))throw Error('CUSTOMER_SIGNALS_IDS_INVALID');
  const money=hasAuthorizationArea(auth,'geld'),mails=hasAuthorizationArea(auth,'mails'),intake=hasAuthorizationArea(auth,'eingang');
  const rows=await withPrivilegedTenantTransaction(auth,tx=>tx.execute<{id:string;active_orders:number;active_quotes:number;overdue:number;unassigned:number;open_messages:number;agreements:Array<{text:string}>;complaints:Array<{text:string}>;tasks:Array<{text:string}>;deadlines:Array<{number:string|null;dueDate:string|null;risk:string|null;status:string|null}>}>(sql`
    SELECT customer.id,
      (SELECT count(*)::integer FROM private.v_operational_station_queue_v1 queue JOIN public.orders order_source ON order_source.tenant_id=queue.tenant_id AND order_source.id=queue.id WHERE queue.tenant_id=customer.tenant_id AND queue.customer_id=customer.id
        AND queue.station NOT IN ('abgeholt','versendet','raus','storniert') AND order_source.ware<>'storniert') AS active_orders,
      (SELECT count(*)::integer FROM private.v_open_quotes_v1 quote WHERE quote.tenant_id=customer.tenant_id AND quote.customer_id=customer.id) AS active_quotes,
      (SELECT count(*)::integer FROM public.invoices invoice WHERE ${money} AND invoice.tenant_id=customer.tenant_id AND invoice.customer_id=customer.id
        AND ${overdueInvoiceCondition()}) AS overdue,
      (SELECT count(*)::integer FROM public.intake_item source WHERE source.tenant_id=customer.tenant_id AND source.richtung IN ('rein','intern') AND source.einsatz='offen' AND source.aussortiert IS NULL AND source.zuordnung='offen'
        AND (${mails} OR source.kanal<>'mail' AND ${intake} AND source.erstellt_von=${auth.userId}::uuid)
        AND (source.kunde_id=customer.id OR source.kunde_id IS NULL AND customer.email IS NOT NULL AND lower(btrim(source.absender_adresse))=lower(btrim(customer.email)))) AS unassigned,
      (SELECT count(*)::integer FROM public.intake_item source WHERE source.tenant_id=customer.tenant_id AND source.richtung IN ('rein','intern') AND source.einsatz='offen' AND source.aussortiert IS NULL AND source.zuordnung<>'offen' AND source.kunde_id=customer.id
        AND (${mails} OR source.kanal<>'mail' AND ${intake} AND source.erstellt_von=${auth.userId}::uuid)) AS open_messages,
      (SELECT coalesce(jsonb_agg(jsonb_build_object('text',agreement.bezeichnung||': '||agreement.wert) ORDER BY agreement.position,agreement.id),'[]'::jsonb)
        FROM public.customer_agreements agreement WHERE agreement.tenant_id=customer.tenant_id AND agreement.customer_id=customer.id AND agreement.order_id IS NULL
          AND agreement.hinweis AND agreement.widerrufen_am IS NULL AND (agreement.gueltig_bis IS NULL OR agreement.gueltig_bis>=(statement_timestamp() AT TIME ZONE 'Europe/Berlin')::date) AND (${money} OR NOT agreement.geld)) AS agreements,
      (SELECT coalesce(jsonb_agg(jsonb_build_object('text','Reklamation '||coalesce(orders.order_number,'Auftragsnummer fehlt')||' · '||coalesce(complaint.stand,'Stand fehlt')) ORDER BY complaint.created_at),'[]'::jsonb)
        FROM public.complaints complaint JOIN public.orders orders ON orders.tenant_id=complaint.tenant_id AND orders.id=complaint.order_id
        WHERE complaint.tenant_id=customer.tenant_id AND complaint.customer_id=customer.id AND complaint.stand IS DISTINCT FROM 'abgeschlossen') AS complaints,
      (SELECT coalesce(jsonb_agg(jsonb_build_object('text',task.titel||' · fällig '||to_char(task.faellig_am,'DD.MM.YYYY')) ORDER BY task.faellig_am,task.id),'[]'::jsonb)
        FROM public.tasks task WHERE task.tenant_id=customer.tenant_id AND task.bezug_typ='kunde' AND task.bezug_id=customer.id AND task.status='offen'
          AND (task.erstellt_von=${auth.userId}::uuid OR task.fuer_login=${auth.userId}::uuid OR task.fuer_bereich=ANY(ARRAY[${sql.join((auth.areas??[]).map(area=>sql`${area}`),sql`, `)}]::text[]))) AS tasks,
      (SELECT coalesce(jsonb_agg(jsonb_build_object('number',queue.order_number,'dueDate',queue.due_date::date::text,'risk',queue.risk,'status',queue.status) ORDER BY queue.due_date,queue.id),'[]'::jsonb)
        FROM private.v_operational_station_queue_v1 queue WHERE queue.tenant_id=customer.tenant_id AND queue.customer_id=customer.id AND queue.station IN ('angenommen','galvanik','fertig')) AS deadlines
    FROM public.customers customer WHERE customer.tenant_id=${auth.tenantId} AND customer.id IN (${sql.join(customerIds.map(id=>sql`${id}`),sql`, `)})
  `));
  return new Map(rows.map(row=>{
    const hints:CustomerHint[]=[];
    if(row.overdue)hints.push({kind:'payment',text:`${row.overdue} ${row.overdue===1?'Rechnung':'Rechnungen'} überfällig`,urgent:true});
    for(const order of row.deadlines){const priority=evaluateOrderPriority({dueDate:order.dueDate,risk:order.risk??undefined,isBlocked:order.status==='blocked'});if(priority.risk==='red'||priority.risk==='blocked')hints.push({kind:'deadline',text:`Termin ${order.number??'Auftragsnummer fehlt'} in Gefahr`,urgent:true});}
    if(row.unassigned)hints.push({kind:'message',text:`${row.unassigned} ${row.unassigned===1?'Nachricht':'Nachrichten'} zuordnen`,urgent:false});
    if(row.open_messages)hints.push({kind:'message',text:`${row.open_messages} ${row.open_messages===1?'Nachricht':'Nachrichten'} offen`,urgent:false});
    hints.push(...row.agreements.map(value=>({kind:'agreement' as const,text:value.text,urgent:false})),...row.complaints.map(value=>({kind:'complaint' as const,text:value.text,urgent:true})),...row.tasks.map(value=>({kind:'task' as const,text:value.text,urgent:false})));
    return [row.id,{activeOrderCount:row.active_orders,activeQuoteCount:row.active_quotes,hints}];
  }));
}

export type CustomerSummaryOrder = {
  id: string;
  orderNumber: string;
  title: string;
  station: string;
  status: string;
  version: number;
  dueAt: string | null;
};

export type CustomerSummary = CustomerStoredProfile & {
  hints?:CustomerHint[];
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
  paymentPreference: string | null;
  invoiceTermsEnabled: boolean;
  vatId: string | null;
  classification: string | null;
  internalNotes: string | null;
  tags: string[];
  createdAt: string;
  updatedAt: string;
  orderCount: number;
  wareImHausCount: number;
  wareImHaus: boolean;
  invoiceRevenueCents?: number;
  invoiceOpenCents?: number;
  agreements: CustomerAgreementSummary[];
  agreementSlotsAvailable: number;
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
  payment_preference: string | null;
  invoice_terms_enabled: boolean;
  vat_id: string | null;
  classification: string | null;
  internal_notes: string | null;
  tags: unknown;
  created_at: Date | string;
  updated_at: Date | string;
  order_count: number;
  ware_im_haus_count: number;
  ware_im_haus: boolean;
  invoice_revenue_cents: number | string;
  invoice_open_cents: number | string;
  orders: unknown;
  integrity_ok: boolean;
};

type AgreementSummaryRow = {
  id: string;
  customer_id: string;
  order_id: string | null;
  position: number;
  bezeichnung: string;
  wert: string | null;
  typ: string | null;
  ziel_tage: number | null;
  geld: boolean;
  hinweis: boolean;
  gueltig_bis: Date | string | null;
  grund: string | null;
  version: number;
  widerrufen_am: Date | string | null;
  widerruf_grund: string | null;
  created_at: Date | string;
  created_by_name: string | null;
  widerrufen_von_name: string | null;
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

function personName(value: unknown): string | null {
  if (value === null) return null;
  if (typeof value !== "string" || value.trim() !== value || value.length < 1 || value.length > 200) {
    throw new Error("CUSTOMER_SUMMARY_AGREEMENT_LOGIN_INVALID");
  }
  return value;
}

function mapAgreement(row: AgreementSummaryRow): CustomerAgreementSummary {
  const type = row.typ === null ? null : AGREEMENT_TYPES.has(row.typ) ? row.typ as CustomerAgreementType : undefined;
  const validUntil = row.gueltig_bis === null ? null : nullableIso(row.gueltig_bis)?.slice(0, 10) ?? null;
  const revokedAt = nullableIso(row.widerrufen_am);
  if (
    !validId(row.id)
    || !validId(row.customer_id)
    || (row.order_id !== null && !validId(row.order_id))
    || !Number.isInteger(row.position)
    || row.position < 1
    || row.position > 20
    || typeof row.bezeichnung !== "string"
    || row.bezeichnung.trim() !== row.bezeichnung
    || row.bezeichnung.length < 1
    || row.bezeichnung.length > 400
    || (row.wert !== null && (typeof row.wert !== "string" || row.wert.trim() !== row.wert || row.wert.length > 200))
    || type === undefined
    || !Number.isInteger(row.version)
    || row.version < 1
    || typeof row.geld !== "boolean"
    || typeof row.hinweis !== "boolean"
    || (row.ziel_tage !== null && (!Number.isInteger(row.ziel_tage) || row.ziel_tage < 1 || row.ziel_tage > 120))
    || (type !== null && ["sammelrechnung", "zahlungsziel"].includes(type) !== (row.ziel_tage !== null))
    || (row.gueltig_bis !== null && !validUntil)
  ) throw new Error("CUSTOMER_SUMMARY_AGREEMENT_INVALID");
  return {
    id: row.id,
    customerId: row.customer_id,
    orderId: row.order_id,
    position: row.position,
    label: row.bezeichnung,
    value: row.wert,
    type,
    targetDays: row.ziel_tage,
    money: row.geld,
    notice: row.hinweis,
    validUntil,
    reason: row.grund,
    version: row.version,
    revokedAt,
    revokedBy: personName(row.widerrufen_von_name),
    revokeReason: row.widerruf_grund,
    createdAt: toIso(row.created_at),
    createdBy: personName(row.created_by_name),
  };
}

async function readCustomerAgreements(
  tx: PrivilegedTenantTransaction,
  tenantId: string,
  customerId: string,
  includeMoney: boolean,
): Promise<CustomerAgreementSummary[]> {
  const rows = await tx.execute<AgreementSummaryRow>(sql`
    SELECT agreement.id::text, agreement.customer_id, agreement.order_id, agreement.position,
      agreement.bezeichnung, agreement.wert, agreement.typ, agreement.ziel_tage, agreement.geld, agreement.hinweis,
      agreement.gueltig_bis, agreement.grund, agreement.version, agreement.widerrufen_am,
      agreement.widerruf_grund, agreement.created_at,
      creator.full_name AS created_by_name, revoker.full_name AS widerrufen_von_name
    FROM public.customer_agreements agreement
    LEFT JOIN public.app_users creator
      ON creator.tenant_id = agreement.tenant_id AND creator.id = agreement.created_by
    LEFT JOIN public.app_users revoker
      ON revoker.tenant_id = agreement.tenant_id AND revoker.id = agreement.widerrufen_von
    WHERE agreement.tenant_id = ${tenantId}
      AND agreement.customer_id = ${customerId}
      AND agreement.order_id IS NULL
      AND (${includeMoney} OR NOT agreement.geld)
    ORDER BY agreement.position ASC, agreement.created_at ASC, agreement.id
  `);
  return rows.map(mapAgreement);
}

async function readCustomerAgreementSlots(
  tx: PrivilegedTenantTransaction,
  tenantId: string,
  customerId: string,
): Promise<number> {
  const rows = await tx.execute<{ count: number | string }>(sql`
    SELECT count(*)::integer AS count
    FROM public.customer_agreements agreement
    WHERE agreement.tenant_id = ${tenantId}
      AND agreement.customer_id = ${customerId}
      AND agreement.order_id IS NULL
      AND agreement.typ IS NULL
      AND agreement.widerrufen_am IS NULL
  `);
  const count = Number(rows[0]?.count);
  if (rows.length !== 1 || !Number.isSafeInteger(count) || count < 0 || count > 20) {
    throw new Error("CUSTOMER_SUMMARY_AGREEMENT_CAPACITY_INVALID");
  }
  return 20 - count;
}

function mapSummary(
  row: SummaryRow,
  authorization: AuthorizationSnapshot,
  profile: CustomerStoredProfile,
  agreements: CustomerAgreementSummary[],
  agreementSlotsAvailable: number,
): CustomerSummary {
  const orders = mapOrders(row.orders);
  const invoiceRevenueCents = Number(row.invoice_revenue_cents);
  const invoiceOpenCents = Number(row.invoice_open_cents);
  if (
    row.integrity_ok !== true
    || row.tenant_id !== authorization.tenantId
    || !validId(row.id)
    || row.name.trim() !== row.name
    || row.name.length < 1
    || !Number.isSafeInteger(row.order_count)
    || !Number.isSafeInteger(row.ware_im_haus_count)
    || !Number.isSafeInteger(invoiceRevenueCents)
    || invoiceRevenueCents < 0
    || !Number.isSafeInteger(invoiceOpenCents)
    || invoiceOpenCents < 0
    || row.order_count !== orders.length
    || row.ware_im_haus_count !== orders.filter((order) => ["angenommen", "galvanik", "fertig"].includes(order.status)).length
    || row.ware_im_haus !== (row.ware_im_haus_count > 0)
    || typeof row.invoice_terms_enabled !== "boolean"
  ) throw new Error("CUSTOMER_SUMMARY_INVALID");
  return {
    ...profile,
    id: row.id,
    customerNumber: row.customer_number,
    name: profile.name,
    companyName: profile.companyName,
    type: profile.customerType,
    contactPerson: customerContactLabel(profile),
    email: profile.email,
    phone: profile.phone,
    street: profile.street,
    address: row.address,
    zipCode: profile.zipCode,
    city: profile.city,
    country: profile.country,
    paymentPreference: profile.paymentPreference,
    invoiceTermsEnabled: row.invoice_terms_enabled,
    vatId: profile.vatId,
    classification: row.classification,
    internalNotes: profile.notes,
    tags: mapTags(row.tags),
    createdAt: toIso(row.created_at),
    updatedAt: toIso(row.updated_at),
    orderCount: row.order_count,
    wareImHausCount: row.ware_im_haus_count,
    wareImHaus: row.ware_im_haus,
    ...(hasAuthorizationArea(authorization,'geld')?{invoiceRevenueCents,invoiceOpenCents}:{}),
    agreements,
    agreementSlotsAvailable,
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
  const {hasAuthorizationArea}=await import("@/lib/server/authorization");
  if (!hasAuthorizationArea(authorization,"kunden")) {
    return { code: "FORBIDDEN", message: "Kundenkarte ist nicht erlaubt." };
  }
  try {
    const data = await withPrivilegedTenantTransaction(authorization, async (tx) => {
      const rows = await tx.execute<SummaryRow>(sql`
        SELECT summary.*,
               customer.ziel_freigeschaltet AS invoice_terms_enabled,
               COALESCE(billing.invoice_revenue_cents, 0)::bigint AS invoice_revenue_cents,
               COALESCE(billing.invoice_open_cents, 0)::bigint AS invoice_open_cents
        FROM private.v_customer_summary_v1 summary
        JOIN public.customers customer
          ON customer.tenant_id = summary.tenant_id
         AND customer.id = summary.id
        LEFT JOIN LATERAL (
          SELECT sum(invoice.gross_amount_cents) FILTER (WHERE invoice.status = 'issued') AS invoice_revenue_cents,
                 sum(invoice.payment_open_amount_cents) FILTER (WHERE invoice.status = 'issued') AS invoice_open_cents
          FROM public.invoices invoice
          WHERE invoice.tenant_id = summary.tenant_id
            AND invoice.customer_id = summary.id
            AND ${hasAuthorizationArea(authorization,'geld')}
        ) billing ON true
        WHERE summary.id = ${input.customerId}
          AND (customer.type IS DISTINCT FROM 'lieferant' OR ${hasAuthorizationArea(authorization,'geld')})
        LIMIT 2
      `);
      if (rows.length > 1) throw new Error("CUSTOMER_SUMMARY_AMBIGUOUS");
      if(!rows[0])return null;
       const profile=await readCustomerProfile(tx,authorization.tenantId,input.customerId);
      if(!profile)throw new Error("CUSTOMER_PROFILE_UNAVAILABLE");
       const agreements = await readCustomerAgreements(
         tx,
         authorization.tenantId,
         input.customerId,
         hasAuthorizationArea(authorization, "geld"),
       );
       const agreementSlotsAvailable = await readCustomerAgreementSlots(tx, authorization.tenantId, input.customerId);
       return mapSummary(rows[0],authorization,profile,agreements,agreementSlotsAvailable);
    });
    if(data){const signals=await readCustomerListSignals(authorization,[input.customerId]);const signal=signals.get(input.customerId);if(!signal)throw Error('CUSTOMER_SIGNALS_MISSING');data.hints=signal.hints;}
    return data
      ? { code: "OK", data }
      : { code: "NOT_FOUND", message: "Kunde nicht verfügbar." };
  } catch (error) {
    console.error("[CUSTOMER_SUMMARY_READ_FAILED]", {errorName:error instanceof Error?error.name:"UnknownError"});
    return { code: "UNAVAILABLE", message: "Kundenkarte konnte nicht sicher geladen werden. Code: CUSTOMER_SUMMARY_READ_FAILED." };
  }
}

export async function readCustomerProfile(tx: PrivilegedTenantTransaction, tenantId: string, customerId: string, lock = false) {
  const rows = await tx.execute<Omit<CustomerStoredProfile,"contactPerson">>(sql`
    SELECT id,customer_number AS "customerNumber",name,type AS "customerType",company_name AS "companyName",
      salutation,first_name AS "firstName",last_name AS "lastName",contact_role AS "contactRole",phone,email,
      billing_email AS "billingEmail",website,street,house_number AS "houseNumber",zip_code AS "zipCode",city,country,
      payment_preference AS "paymentPreference",vat_id AS "vatId",notes,handover_preference AS "handoverPreference",
      iban,zahlungsziel_tage AS "paymentTermDays",auto_info AS "autoInfo",vorrang,
      address_status AS "addressStatus",
      ziel_freigeschaltet AS "invoiceTermsEnabled",ziel_tage AS "invoiceTermDays"
    FROM public.customers WHERE tenant_id=${tenantId} AND id=${customerId} LIMIT 2 ${lock ? sql`FOR UPDATE` : sql`FOR SHARE`}
  `);
  if (rows.length !== 1 || !rows[0]) return null;
  return {...rows[0],contactPerson:customerContactLabel(rows[0])};
}
