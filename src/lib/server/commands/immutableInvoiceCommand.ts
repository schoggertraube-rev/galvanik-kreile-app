import {isIssueCollectionInvoiceInput,type IssueCollectionInvoiceInput} from '@/lib/domain/invoiceIntentContract';
export type {IssueCollectionInvoiceInput} from '@/lib/domain/invoiceIntentContract';
import {parseInvoiceCollectionOriginal,assertInvoiceOriginalLineSources,type InvoiceCollectionOriginal} from '@/lib/domain/invoiceCollectionContract';
import {resolveInvoicePaymentTerms,parseInvoicePaymentTerms,InvoicePaymentTermsSourceError,type InvoicePaymentTerms} from '@/lib/domain/invoicePaymentTerms';
import {FINANCIAL_ACCESS_COPY} from '@/ui/financialAccessCopy';
import {isCancelInvoiceInput as isValidCancelInput,type CancelInvoiceInput} from '@/lib/domain/invoiceIntentContract';
export type {CancelInvoiceInput} from '@/lib/domain/invoiceIntentContract';
import {isCreateInvoiceInput as isValidInput,isInvoiceShippingCostsInput as validShippingCosts,type CreateInvoiceInput} from '@/lib/domain/invoiceIntentContract';
export type {CreateInvoiceInput} from '@/lib/domain/invoiceIntentContract';
import type {InvoiceVatGroup,InvoiceVatReader} from '@/modules/accounting/public';
import {readInvoiceVat} from '@/modules/accounting/public';
import "server-only";
import {INVOICE_VAT_COPY} from '@/ui/situationCatalog';
import {invoiceBaseUnitAmounts,invoiceElectronicUnit,invoiceExtraWorkCents,InvoiceElectronicSourceError,InvoiceMaterialUnitError,invoiceMaterialLineNetCents,invoiceXmlAmount,isInvoiceMaterialUnitCode} from '@/lib/domain/invoiceElectronicFields';
import {assertInvoiceElectronicFields} from '@/lib/pdf/invoiceXml';
import {createInvoiceElectronicOriginal,type InvoiceOriginalReader} from '@/lib/server/invoiceElectronicOriginal';
import {E_INVOICE_COPY} from '@/ui/situationCatalog';
import {LAGER_MATERIAL_COPY} from '@/ui/lagerMaterialCopy';
import {INVOICE_SCRAP_COPY} from '@/ui/accountingCopy';
import {ORDER_SCRAP_COPY} from '@/ui/ordersCopy';
import {verteileMehrarbeit, type Auftragsmehrarbeit} from '@/modules/orders/public';
import {assertInvoiceGlyphs,InvoiceGlyphError} from '@/lib/pdf/invoiceFonts';
import {CUSTOMER_CREDIT_COPY} from '@/ui/situationCatalog';
import {SHIPPING_FEE_COPY} from '@/ui/situationCatalog';
import {appendCancellationCredit,readCancellationCreditSource} from './customerCreditCommand';
import {readInvoiceHandoverSource} from '@/lib/server/orderHandoverSourcePort';
import {canonicalJson} from '@/lib/domain/canonicalJson';
import {readOrderCommercialQuote,bindOrderQuoteCommercialTerms} from '@/lib/server/orderQuoteReadPort';
import {reportOrderSourceIssue} from '@/lib/server/orderSourceIssueLog';

import { createHash, randomUUID } from "node:crypto";
import { renderToBuffer } from "@react-pdf/renderer";
import { sql } from "drizzle-orm";
import { hasAuthorizationArea, readActiveAreaHolders, resolveAuthorization,authorizationReadContext,type AuthorizationSnapshot,type AuthorizedReadContext } from "@/lib/server/authorization";
import {getRoleLabel} from '@/lib/auth/authorizationContract';
import { readEffectiveCustomerAgreement } from "@/lib/server/effectiveCustomerAgreementRead";
import {
  withPrivilegedTenantTransaction,
  withTenantSavepoint,
  type PrivilegedTenantTransaction,
} from "@/lib/server/privilegedDb";
import {
  isPaymentMode,
  PAYMENT_CONTRACT_VERSION,
  mapPaymentSummaryRow,
  type PaymentSummaryRow,
  type PaymentSummary,
  type PaymentMode,
} from "@/lib/server/paymentContract";
import {
  createImmutableInvoiceCancellationPdfDocument,
  createImmutableInvoicePdfDocument,
  type ImmutableInvoiceBaseLine,
  type ImmutableInvoiceSingleSnapshot,
  type ImmutableInvoiceExtraWorkLine,
  type ImmutableInvoiceShippingLine,
  type ImmutableInvoiceLine,
  type ImmutableInvoiceMaterialLine,
  type ImmutableInvoiceSnapshot,
} from "@/lib/pdf/ImmutableInvoiceDocument";

/**
 * F1.4 — immutable issue/cancellation lifecycle on the single public.invoices
 * truth. Both commands are tenant-bound, versioned, idempotent and confirmed
 * by a separate event/invoice/PDF receipt readback inside the transaction.
 */

const EVENT_TYPE = "INVOICE_CREATED_V1";
const EVENT_TYPE_V2 = "INVOICE_CREATED_V2";
const CANCEL_EVENT_TYPE = "INVOICE_CANCELLED_V1";
const EVENT_SCHEMA_VERSION = 1 as const;
const COLLECTION_EVENT_TYPE="INVOICE_CREATED_V3" as const;
const STATION = "fertig" as const;
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;
const INVOICE_NUMBER_PATTERN = /^R-[0-9]{4}-[0-9]{4,}$/;
const HEX64_PATTERN = /^[a-f0-9]{64}$/;
/** Canonical UTC instant, exactly as `to_char(... 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"')` emits it. */
const ISO_INSTANT_PATTERN = /^[0-9]{4}-[0-9]{2}-[0-9]{2}T[0-9]{2}:[0-9]{2}:[0-9]{2}\.[0-9]{3}Z$/;
type InvoiceReissueIntent=NonNullable<CancelInvoiceInput['reissueWithoutShipping']>&{originalPdfSha256:string;orderVersion:number;confirmedBy:string};
function readStoredReissueIntent(value:unknown,row:Pick<ReceiptRow,'original_pdf_sha256'|'actor_id'>):InvoiceReissueIntent{
 if(!plainObject(value)||Object.keys(value).sort().join(',')!=='confirmedBy,handoverEventId,orderVersion,originalPdfSha256,replacementClientEventId'
  ||typeof value.handoverEventId!=='string'||!UUID_PATTERN.test(value.handoverEventId)
  ||typeof value.replacementClientEventId!=='string'||!UUID_PATTERN.test(value.replacementClientEventId)
  ||value.originalPdfSha256!==row.original_pdf_sha256||value.confirmedBy!==row.actor_id
  ||typeof value.orderVersion!=='number'||!Number.isSafeInteger(value.orderVersion)||value.orderVersion<1)throw Error('INVOICE_REISSUE_INTENT_INVALID');
 return value as InvoiceReissueIntent;
}
function readIssuedReissueIntent(value:unknown,actorId:string):ImmutableInvoiceReceiptBase['reissue']{
 if(value===undefined||value===null)return undefined;
 if(!plainObject(value)||Object.keys(value).sort().join(',')!=='cancellationEventId,confirmedBy,repairActorId'
  ||typeof value.cancellationEventId!=='string'||!UUID_PATTERN.test(value.cancellationEventId)
  ||typeof value.confirmedBy!=='string'||!UUID_PATTERN.test(value.confirmedBy)||value.repairActorId!==actorId)throw Error('INVOICE_REISSUE_RECEIPT_INVALID');
 return value as NonNullable<ImmutableInvoiceReceiptBase['reissue']>;
}

type ImmutableInvoiceReceiptBase = {
  reissue?:{cancellationEventId:string;confirmedBy:string;repairActorId:string};
  belegart?: 'versandkosten';
  ursprungRechnungId?: string;
  invoiceId: string;
  invoiceNumber: string;
  orderId: string;
  orderVersion: number;
  status: "issued";
  netAmountCents: number;
  vatRateBasisPoints: number|null;
  vatAmountCents: number;
  grossAmountCents: number;
  serviceDate: string;
  dueDate: string;
  issuedAt: string;
  issuedBy: string;
  pdfRef: string;
  pdfSha256: string;
  eventId: string;
  clientEventId: string;
  correlationId: string;
  aggregateVersion: 1;
};

export type ImmutableInvoiceReceipt = ImmutableInvoiceReceiptBase & (
  | { eventSchemaVersion: 1 }
  | { eventSchemaVersion: 2; invoiceSourceState: "after_goods_out" }
);

export type ImmutableInvoiceCollectionReceipt=Omit<ImmutableInvoiceReceiptBase,'orderId'|'orderVersion'|'serviceDate'|'reissue'|'belegart'|'ursprungRechnungId'>&{
 orderId:null;orderVersion:null;serviceDate:null;collection:InvoiceCollectionOriginal;eventSchemaVersion:3;
};
export type CreateCollectionInvoiceResult=Exclude<CreateInvoiceResult,{code:'OK'}>|{code:'OK';receipt:ImmutableInvoiceCollectionReceipt;replayed:boolean};

export type CreateInvoiceResult =
  | { code: "OK"; receipt: ImmutableInvoiceReceipt; replayed: boolean }
  | { code: "UNAUTHENTICATED"; message: string }
  | { code: "FORBIDDEN"; message: string }
  | { code: "NOT_FOUND"; message: string }
  | { code: "ORDER_IN_COLLECTION"; message: string }
  | { code: "CONFLICT"; message: string }
  | { code: "MATERIAL_PREIS_FEHLT"; message: string; artikel: string[] }
  | { code: "MATERIAL_EINHEIT_OHNE_CODE"; message: string; einheit: string }
  | { code: "VALIDATION_ERROR"; message: string;source?:import("@/lib/domain/invoiceElectronicFields").InvoiceElectronicSourceLocation }
  | { code: "UNAVAILABLE"; message: string };



type ImmutableInvoiceSingleCancellationReceipt = {
  cancellationNumber?:string;
  reissueWithoutShipping?:InvoiceReissueIntent;
  invoiceId: string;
  invoiceNumber: string;
  orderId: string;
  orderVersion: number;
  status: "cancelled";
  reason: string;
  cancelledAt: string;
  cancelledBy: string;
  originalPdfSha256: string;
  cancellationPdfRef: string;
  cancellationPdfSha256: string;
  eventId: string;
  clientEventId: string;
  correlationId: string;
  expectedVersion: 1;
  aggregateVersion: 2;
  eventSchemaVersion: 1;
};

export type ImmutableInvoiceCollectionCancellationReceipt=Omit<ImmutableInvoiceSingleCancellationReceipt,'orderId'|'orderVersion'|'reissueWithoutShipping'>&{orderId:null;orderVersion:null;collection:InvoiceCollectionOriginal;reissueWithoutShipping?:never};
export type ImmutableInvoiceCancellationReceipt=ImmutableInvoiceSingleCancellationReceipt|ImmutableInvoiceCollectionCancellationReceipt;

export type CancelInvoiceResult =
  | { code: "OK"; receipt: ImmutableInvoiceCancellationReceipt; replayed: boolean;replacementReceipt?:ImmutableInvoiceReceipt }
  | { code: "UNAUTHENTICATED"; message: string }
  | { code: "FORBIDDEN"; message: string }
  | { code: "NOT_FOUND"; message: string }
  | { code: "CONFLICT"; message: string }
  | { code: "VALIDATION_ERROR"; message: string }
  | { code: "UNAVAILABLE"; message: string };

type LockedOrder = {
  id: string;
  tenant_id: string;
  customer_id: string;
  station: string;
  status: string;
  version: number;
  payment_mode: string;
  payment_mode_version: number;
  handover_mode:string|null;
};

type InvoicePaymentInitializationRow = {
  id: string;
  tenant_id: string;
  order_id: string|null;
  gross_amount_cents: number | string | null;
  payment_contract_version: number | string | null;
  payment_mode: string | null;
  payment_status: string | null;
  payment_open_amount_cents: number | string | null;
  payment_paid_amount_cents: number | string | null;
  payment_currency: string | null;
  payment_method: string | null;
  payment_paid_at: Date | string | null;
  payment_receipt_id: string | null;
  payment_event_id: string | null;
  payment_correlation_id: string | null;
  payment_version: number | string | null;
};

type SourceRow = {
  has_quote?:boolean;
  tenant_id: string;
  order_id: string;
  freeze_id: string;
  order_number: string;
  order_title: string;
  customer_id: string;
  customer_name: string;
  customer_company_name: string | null;
  customer_contact_person: string | null;
  customer_street: string | null;
  customer_zip: string | null;
  customer_city: string | null;
  customer_country: string | null;
  customer_vat_id: string | null;
  seller_company_name: string | null;
  seller_street: string | null;
  seller_zip: string | null;
  seller_city: string | null;
  seller_country: string | null;
  seller_tax_id: string | null;
  seller_vat_id: string | null;
  seller_tax_number: string | null;
  seller_iban: string | null;
  seller_bic: string | null;
  seller_bank_name: string | null;
  invoice_vat_rate_basis_points: number | null;
  invoice_payment_term_days: number | null;
  base_lines: unknown;
  base_line_count: number;
  base_net_amount_cents: number | string;
  extra_work_lines: unknown;
  extra_work_line_count: number;
  extra_work_net_amount_cents: number | string;
  seller_config_complete: boolean;
  customer_config_complete: boolean;
  base_prices_complete: boolean;
  no_active_invoice: boolean;
  integrity_ok: boolean;
  post_goods_out_invoice_eligible: boolean;
  effective_integrity_ok: boolean;
  current_order_version: number;
  service_date: Date | string;
};

type ReceiptRow = {
  reissue_intent?:unknown;
  belegart: 'auftrag'|'versandkosten';
  ursprung_rechnung_id: string|null;
  shipping_costs_intent: unknown;
  event_id: string;
  tenant_id: string;
  order_id: string;
  event_type: string;
  client_event_id: string;
  correlation_id: string;
  event_schema_version: number;
  aggregate_version: number;
  actor_id: string;
  occurred_at: Date | string;
  invoice_id: string;
  invoice_number: string;
  order_version: number | string;
  intent_expected_version: number | string;
  current_status: string;
  cancellation_invoice_number?:string|null;
  current_version: number;
  net_amount_cents: number | string;
  vat_rate_basis_points: number|null;
  snapshot: unknown;
  vat_amount_cents: number | string;
  gross_amount_cents: number | string;
  service_date: Date | string;
  due_date: Date | string;
  pdf_ref: string;
  pdf_sha256: string;
  cancel_reason: string | null;
  original_pdf_sha256: string;
  integrity_ok: boolean;
};

type CollectionReceiptRow=Omit<ReceiptRow,'order_id'|'order_version'|'service_date'>&{order_id:null;order_version:null;service_date:null};

type LockedInvoice = {
  id: string;
  tenant_id: string;
  order_id: string;
  invoice_number: string;
  status: string;
  aggregate_version: number;
  snapshot: unknown;
  due_date: Date | string;
  pdf_ref: string;
  pdf_sha256: string;
  pdf_content: Buffer | Uint8Array;
  net_amount_cents: number | string | null;
  vat_rate_basis_points: number | string | null;
  vat_amount_cents: number | string | null;
  gross_amount_cents: number | string | null;
  payment_contract_version: number | string | null;
  payment_mode: string | null;
  payment_status: string | null;
  payment_open_amount_cents: number | string | null;
  payment_paid_amount_cents: number | string | null;
  payment_currency: string | null;
  payment_method: string | null;
  payment_paid_at: Date | string | null;
  payment_receipt_id: string | null;
  payment_event_id: string | null;
  payment_correlation_id: string | null;
  payment_version: number | string | null;
};

type LockedCancellationOrder = {
  id: string;
  tenant_id: string;
};



/**
 * F1.4 — a missing or unusable mandatory master-data value is a user-fixable
 * validation outcome, never an infrastructure failure. It is raised as its own
 * error type so `createInvoice` can fail closed with the existing
 * VALIDATION_ERROR result *before* an invoice number is allocated.
 */
class InvoiceMasterDataError extends Error {}
class InvoiceCollectionNotDueError extends Error {}
class InvoiceScrapError extends Error {
  constructor(message: string, readonly fullScrapOrderId?: string) {
    super(message);
  }
}
class InvoiceMaterialPriceError extends Error {
  constructor(readonly artikel: string[]) {
    super(artikel.map(LAGER_MATERIAL_COPY.preisFehlt).join(' · '));
  }
  result(): Extract<CreateInvoiceResult, { code: 'MATERIAL_PREIS_FEHLT' }> {
    return { code: 'MATERIAL_PREIS_FEHLT', message: this.message, artikel: this.artikel };
  }
}

function invoiceMaterialUnitFailure(error: InvoiceMaterialUnitError): Extract<CreateInvoiceResult, { code: 'MATERIAL_EINHEIT_OHNE_CODE' }> {
  return { code: 'MATERIAL_EINHEIT_OHNE_CODE', message: LAGER_MATERIAL_COPY.rechnungseinheitFehlt(error.unit), einheit: error.unit };
}
function assertInvoiceContentGlyphs(content:Pick<ImmutableInvoiceSnapshot,'seller'|'customer'|'order'|'lines'|'collection'>){
 const texts:Array<{field:string;text:string}>=[];
 for(const [section,source] of [['seller',content.seller],['customer',content.customer],['order',content.order===null?{}:content.order]] as const){
  for(const [field,value] of Object.entries(source))if(typeof value==='string')texts.push({field:section+'.'+field,text:value});
 }
 for(const member of content.collection?.members??[])for(const [field,value]of Object.entries(member))if(typeof value==='string')texts.push({field:'collection.'+member.orderId+'.'+field,text:value});
 for(const [index,line] of content.lines.entries())texts.push({field:'lines.'+index+'.name',text:line.type==='EXTRA_WORK'?line.catalogPositionName:line.name});
 assertInvoiceGlyphs(texts);
}
class InvoiceVatRateError extends InvoiceMasterDataError {
  constructor(readonly part:string,readonly missingCompany=false){super("INVOICE_LINE_VAT_RATE_MISSING");}
}
const INVOICE_EU_OUTSIDE_DE=new Set(['AT','BE','BG','HR','CY','CZ','DK','EE','FI','FR','GR','HU','IE','IT','LV','LT','LU','MT','NL','PL','PT','RO','SK','SI','ES','SE']);
function invoiceLineVat(value:unknown,part:string,reverseCharge:boolean,companyRate:number|null):0|700|1900{
  if(reverseCharge)return 0;
  if(value===null){if(companyRate===700||companyRate===1900)return companyRate;throw new InvoiceVatRateError(part,true);}
  if(value!==700&&value!==1900)throw new InvoiceVatRateError(part);
  return value;
}

function toIso(value: unknown): string {
  const parsed = value instanceof Date ? value : new Date(value as string);
  if (!Number.isFinite(parsed.getTime())) throw new Error("INVOICE_TIME_INVALID");
  return parsed.toISOString();
}

/**
 * Accepts only the canonical UTC instant the database emitted for this
 * command. No re-parsing, no fallback and no local-time interpretation: the
 * exact same string is written to invoice, event, snapshot and receipt.
 */
function requireIsoInstant(value: unknown, error: string): string {
  if (typeof value !== "string" || !ISO_INSTANT_PATTERN.test(value)) throw new Error(error);
  return value;
}

function toDateOnly(value: unknown): string {
  if (value instanceof Date) return value.toISOString().slice(0, 10);
  if (typeof value === "string" && value.length >= 10) return value.slice(0, 10);
  throw new Error("INVOICE_DATE_INVALID");
}

function toSafeInteger(value: unknown, error: string): number {
  // `Number(null)` and `Number("")` are 0; a missing numeric value must never
  // silently become a valid zero amount, quantity or term.
  if (value === null || value === undefined) throw new Error(error);
  if (typeof value === "string" && value.trim().length === 0) throw new Error(error);
  const parsed = typeof value === "number" ? value : Number(value);
  if (!Number.isSafeInteger(parsed)) throw new Error(error);
  return parsed;
}

function requiredText(value: unknown, error: string): string {
  if (typeof value !== "string") throw new Error(error);
  const trimmed = value.trim();
  if (trimmed.length === 0) throw new Error(error);
  return trimmed;
}

/** Same contract as `requiredText`, but for tenant-fixable master data. */
function masterDataText(value: unknown, error: string): string {
  if (typeof value !== "string") throw new InvoiceMasterDataError(error);
  const trimmed = value.trim();
  if (trimmed.length === 0) throw new InvoiceMasterDataError(error);
  return trimmed;
}

function optionalText(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed.length === 0 ? null : trimmed;
}

function plainObject(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function exactKeys(value: Record<string, unknown>, expected: readonly string[]): boolean {
  const actual = Object.keys(value).sort();
  const wanted = [...expected].sort();
  return actual.length === wanted.length && actual.every((key, index) => key === wanted[index]);
}

function isMeasuredBaseUnit(unit: unknown): unit is 'KGM' | 'DMK' | 'SET' {
  return unit === 'KGM' || unit === 'DMK' || unit === 'SET';
}

function parseBaseLines(value: unknown, vat?:{reverseCharge:boolean;companyRate:number|null;electronic?:true}, originalUnit?:unknown): ImmutableInvoiceBaseLine[] {
  if (!Array.isArray(value)) throw new Error("INVOICE_BASE_LINES_INVALID");
  return value.map((entry) => {
    if (!plainObject(entry) || !exactKeys(entry, [
      "itemId", "lineNetAmountCents", "name", "quantity", "unitNetAmountCents",
      ...(vat ? ["vat_rate_basis_points"] : []),
      ...(vat?.electronic?["unit"]:[]),
    ])) throw new Error("INVOICE_BASE_LINE_SHAPE_INVALID");
    const itemId = requiredText(entry.itemId, "INVOICE_BASE_LINE_ITEM_INVALID");
    const name = masterDataText(entry.name, "INVOICE_BASE_LINE_NAME_INVALID");
    // PL18Nov19:01: only an actual whole-count BASE part without a stored
    // unit receives this source marker in the new snapshot, never in the KV.
    const defaultPiece=vat?.electronic&&(entry.unit===null||entry.unit===undefined||typeof entry.unit==='string'&&!entry.unit.trim());
    const unit=vat?.electronic?(defaultPiece?{code:'C62' as const}:invoiceElectronicUnit(entry.unit)):null;
    if(vat?.electronic&&!unit)throw new InvoiceElectronicSourceError({kind:'order',itemId,field:'unit:'+name});
    const measuredUnit = unit?.code ?? originalUnit;
    const decimal = isMeasuredBaseUnit(measuredUnit) && typeof entry.quantity === 'number' && !Number.isInteger(entry.quantity);
    const quantity = decimal ? entry.quantity as number : toSafeInteger(entry.quantity, "INVOICE_BASE_LINE_QUANTITY_INVALID");
    const sourceUnitCents = toSafeInteger(entry.unitNetAmountCents, "INVOICE_BASE_LINE_UNIT_INVALID");
    const lineNetAmountCents = toSafeInteger(entry.lineNetAmountCents, "INVOICE_BASE_LINE_TOTAL_INVALID");
    if (quantity <= 0 || sourceUnitCents < 0) throw new InvoiceMasterDataError("INVOICE_BASE_LINE_MASTER_DATA_INVALID");
    let unitNetAmountCents = sourceUnitCents;
    if (decimal) {
      try {
        unitNetAmountCents = invoiceBaseUnitAmounts(quantity, lineNetAmountCents, measuredUnit).unitNetAmountCents;
      } catch {
        throw new InvoiceElectronicSourceError({kind:'order',itemId,field:'rounding'});
      }
      // Die DB-Quelle liefert den eingegebenen Preis, das Original den aus dem Betrag abgeleiteten Preis.
      const originalPriceMatches = sourceUnitCents === unitNetAmountCents;
      const sourceAmountMatches = invoiceMaterialLineNetCents(invoiceXmlAmount(sourceUnitCents)+'00', String(quantity)) === lineNetAmountCents;
      if (vat?.electronic ? !sourceAmountMatches : !originalPriceMatches) throw Error('INVOICE_BASE_LINE_INTEGRITY_INVALID');
    } else if (lineNetAmountCents < 0 || sourceUnitCents !== Number((BigInt(lineNetAmountCents)+BigInt(quantity)/BigInt(2))/BigInt(quantity))) {
      throw new Error("INVOICE_BASE_LINE_INTEGRITY_INVALID");
    }
    return { type: "BASE" as const, itemId, name, quantity, unitNetAmountCents, lineNetAmountCents,
      ...(unit?{unit:unit.code,...(defaultPiece?{unitSource:'default_piece' as const}:{}),taxCategory:invoiceLineVat(entry.vat_rate_basis_points,name,vat!.reverseCharge,vat!.companyRate)===0?'AE' as const:'S' as const}:{}),
      ...(vat ? {vat_rate_basis_points:invoiceLineVat(entry.vat_rate_basis_points,name,vat.reverseCharge,vat.companyRate)} : {}),
    };
  });
}

function parseExtraWorkLines(value: unknown, vat?:{reverseCharge:boolean;companyRate:number|null;electronic?:true}): ImmutableInvoiceExtraWorkLine[] {
  if (!Array.isArray(value)) throw new Error("INVOICE_EXTRA_WORK_LINES_INVALID");
  return value.map((entry) => {
    if (!plainObject(entry) || !exactKeys(entry, [
      "amountCents", "catalogPositionId", "catalogPositionName", "hourlyRateCents", "itemId", "minutes",
      ...(vat ? ["vat_rate_basis_points"] : []),
    ])) throw new Error("INVOICE_EXTRA_WORK_LINE_SHAPE_INVALID");
    const minutes = toSafeInteger(entry.minutes, "INVOICE_EXTRA_WORK_MINUTES_INVALID");
    const hourlyRateCents = toSafeInteger(entry.hourlyRateCents, "INVOICE_EXTRA_WORK_RATE_INVALID");
    const amountCents = toSafeInteger(entry.amountCents, "INVOICE_EXTRA_WORK_AMOUNT_INVALID");
    const itemId = requiredText(entry.itemId, "INVOICE_EXTRA_WORK_ITEM_INVALID");
    const catalogPositionId = requiredText(entry.catalogPositionId, "INVOICE_EXTRA_WORK_POSITION_ID_INVALID");
    const catalogPositionName = requiredText(entry.catalogPositionName, "INVOICE_EXTRA_WORK_POSITION_NAME_INVALID");
    if (
      !UUID_PATTERN.test(catalogPositionId)
      || minutes < 1
      || hourlyRateCents < 1
      || amountCents !== invoiceExtraWorkCents(minutes, hourlyRateCents).fullCents
    ) throw new Error("INVOICE_EXTRA_WORK_LINE_INTEGRITY_INVALID");
    return {
      type: "EXTRA_WORK" as const,
      itemId,
      catalogPositionId,
      catalogPositionName,
      minutes,
      hourlyRateCents,
      amountCents,
      ...(vat?.electronic?{unit:'HUR' as const,taxCategory:invoiceLineVat(entry.vat_rate_basis_points,catalogPositionName,vat.reverseCharge,vat.companyRate)===0?'AE' as const:'S' as const}:{}),
      ...(vat ? {vat_rate_basis_points:invoiceLineVat(entry.vat_rate_basis_points,catalogPositionName,vat.reverseCharge,vat.companyRate)} : {}),
    };
  });
}

function parseStoredMaterialLine(value: Record<string, unknown>): ImmutableInvoiceMaterialLine {
  if (!exactKeys(value, [
    'type', 'sourceOrderId', 'articleId', 'name', 'quantity', 'unit', 'unitNetAmount',
    'lineNetAmountCents', 'vat_rate_basis_points', 'taxCategory', 'eventIds',
  ])) throw Error('INVOICE_SNAPSHOT_MATERIAL_LINE_SHAPE_INVALID');

  const { sourceOrderId, articleId, name, quantity, unit, unitNetAmount, lineNetAmountCents, vat_rate_basis_points: rate, taxCategory, eventIds } = value;
  if (typeof quantity !== 'string' || typeof unitNetAmount !== 'string' || !isInvoiceMaterialUnitCode(unit)
    || typeof lineNetAmountCents !== 'number' || invoiceMaterialLineNetCents(unitNetAmount, quantity) !== lineNetAmountCents
    || (rate !== 0 && rate !== 700 && rate !== 1900) || (taxCategory !== 'S' && taxCategory !== 'AE')
    || typeof sourceOrderId !== 'string' || !sourceOrderId.trim() || sourceOrderId !== sourceOrderId.trim()
    || typeof articleId !== 'string' || !articleId.trim()
    || typeof name !== 'string' || !name.trim()
    || !Array.isArray(eventIds) || eventIds.length === 0 || eventIds.some(id => typeof id !== 'string')) {
    throw Error('INVOICE_SNAPSHOT_MATERIAL_LINE_INVALID');
  }

  return {
    type: 'MATERIAL', sourceOrderId, articleId, name,
    quantity, unit, unitNetAmount, lineNetAmountCents, vat_rate_basis_points: rate, taxCategory, eventIds,
  };
}

function parseStoredLine(value: unknown, schemaVersion: 1|2|3): ImmutableInvoiceLine {
  if (!plainObject(value) || typeof value.type !== "string") {
    throw new Error("INVOICE_SNAPSHOT_LINE_INVALID");
  }
  if (schemaVersion === 3 && value.type === 'MATERIAL') return parseStoredMaterialLine(value);
  if(value.type==='SHIPPING'){
    if(schemaVersion===1||!exactKeys(value,['type','shipmentGroupId','name','amountCents','vat_rate_basis_points',...('shippingKind'in value?['shippingKind']:[]),...(schemaVersion===3?['unit','taxCategory']:[]),...(schemaVersion===3&&'sourceOrderIds'in value?['sourceOrderIds']:[])]))throw Error('INVOICE_SNAPSHOT_SHIPPING_SHAPE_INVALID');
    const rate=value.vat_rate_basis_points;
    if(rate!==0&&rate!==700&&rate!==1900)throw Error('INVOICE_SNAPSHOT_SHIPPING_RATE_INVALID');
    if('shippingKind'in value&&(value.shippingKind!=='fee'&&value.shippingKind!=='reference'||value.shippingKind==='reference'&&value.amountCents!==0))throw Error('INVOICE_SNAPSHOT_SHIPPING_KIND_INVALID');
    return {type:'SHIPPING',...('sourceOrderIds'in value?{sourceOrderIds:value.sourceOrderIds as string[]}:{}),...(schemaVersion===3?{unit:value.unit as import('@/lib/domain/invoiceElectronicFields').InvoiceElectronicUnitCode,taxCategory:value.taxCategory as import('@/lib/domain/invoiceElectronicFields').InvoiceElectronicTaxCategory}:{}),...('shippingKind'in value?{shippingKind:value.shippingKind as 'fee'|'reference'}:{}),shipmentGroupId:requiredText(value.shipmentGroupId,'INVOICE_SNAPSHOT_SHIPPING_SOURCE_INVALID'),name:requiredText(value.name,'INVOICE_SNAPSHOT_SHIPPING_NAME_INVALID'),amountCents:toSafeInteger(value.amountCents,'INVOICE_SNAPSHOT_SHIPPING_AMOUNT_INVALID'),vat_rate_basis_points:rate};
  }
  if (value.type === "BASE") {
    if (!exactKeys(value, [
      "itemId", "lineNetAmountCents", "name", "quantity", "type", "unitNetAmountCents",
      ...(schemaVersion !== 1 ? ["vat_rate_basis_points"] : []),
      ...(schemaVersion===3?["unit","taxCategory"]:[]),
      ...(schemaVersion===3&&'sourceOrderId'in value?["sourceOrderId"]:[]),
      ...(schemaVersion===3&&'unitSource'in value?["unitSource"]:[]),
    ])) throw new Error("INVOICE_SNAPSHOT_BASE_LINE_SHAPE_INVALID");
    if('unitSource'in value&&(value.unitSource!=='default_piece'||value.unit!=='C62'||typeof value.quantity!=='number'||!Number.isSafeInteger(value.quantity)||value.quantity<1))throw Error('INVOICE_SNAPSHOT_BASE_UNIT_SOURCE_INVALID');
    const parsed = parseBaseLines([{
      itemId: value.itemId,
      lineNetAmountCents: value.lineNetAmountCents,
      name: value.name,
      quantity: value.quantity,
      unitNetAmountCents: value.unitNetAmountCents,
    }], undefined, schemaVersion === 3 ? value.unit : undefined);
    const line = parsed[0];
    if (!line) throw new Error("INVOICE_SNAPSHOT_BASE_LINE_INVALID");
    return schemaVersion !== 1 ? {...value,...line} as ImmutableInvoiceLine : line;
  }
  if (value.type === "EXTRA_WORK") {
    const hasRounding = schemaVersion === 3 && Object.hasOwn(value, "unreducedAmountCents");
    const hasApproval = hasRounding && Object.hasOwn(value, "approvalEventIds");
    if (!exactKeys(value, [
      "amountCents", "catalogPositionId", "catalogPositionName", "hourlyRateCents",
      "itemId", "minutes", "type",
      ...(schemaVersion !== 1 ? ["vat_rate_basis_points"] : []),
      ...(schemaVersion===3?["unit","taxCategory"]:[]),
      ...(schemaVersion===3&&'sourceOrderId'in value?["sourceOrderId"]:[]),
      ...(hasRounding ? ["unreducedAmountCents"] : []),
      ...(hasApproval ? ["approvalEventIds"] : []),
    ])) throw new Error("INVOICE_SNAPSHOT_EXTRA_WORK_LINE_SHAPE_INVALID");
    if (hasRounding) {
      const minutes = toSafeInteger(value.minutes, "INVOICE_EXTRA_WORK_MINUTES_INVALID");
      const rate = toSafeInteger(value.hourlyRateCents, "INVOICE_EXTRA_WORK_RATE_INVALID");
      const { fullCents, cappedCents } = invoiceExtraWorkCents(minutes, rate);
      if (value.unreducedAmountCents !== fullCents || value.amountCents !== cappedCents) {
        throw Error("INVOICE_SNAPSHOT_EXTRA_WORK_ROUNDING_INVALID");
      }
      if (hasApproval && (!Array.isArray(value.approvalEventIds) || !value.approvalEventIds.length
        || new Set(value.approvalEventIds).size !== value.approvalEventIds.length
        || value.approvalEventIds.some(id => typeof id !== "string" || !UUID_PATTERN.test(id)))) {
        throw Error("INVOICE_SNAPSHOT_EXTRA_WORK_APPROVAL_INVALID");
      }
    }
    const parsed = parseExtraWorkLines([{
      amountCents: hasRounding ? value.unreducedAmountCents : value.amountCents,
      catalogPositionId: value.catalogPositionId,
      catalogPositionName: value.catalogPositionName,
      hourlyRateCents: value.hourlyRateCents,
      itemId: value.itemId,
      minutes: value.minutes,
    }]);
    const line = parsed[0];
    if (!line) throw new Error("INVOICE_SNAPSHOT_EXTRA_WORK_LINE_INVALID");
    return schemaVersion !== 1 ? {...value, ...line, amountCents: hasRounding ? Number(value.amountCents) : line.amountCents} as ImmutableInvoiceLine : line;
  }
  throw new Error("INVOICE_SNAPSHOT_LINE_TYPE_INVALID");
}

function parseStoredSnapshot(value:unknown,invoice:{order_id:string},readVat:InvoiceVatReader):ImmutableInvoiceSingleSnapshot;
function parseStoredSnapshot(value:unknown,invoice:{order_id:string|null},readVat:InvoiceVatReader):ImmutableInvoiceSnapshot;
function parseStoredSnapshot(value: unknown, invoice: {order_id:string|null}, readVat: InvoiceVatReader): ImmutableInvoiceSnapshot {
  if (!plainObject(value) || !exactKeys(value, [
    "customer", "issuedAt", "lines", "order", "paymentTermDays", "schemaVersion",
    "seller", "serviceDate", "totals",
    ...(Object.hasOwn(value,"terms")?["terms"]:[]),
    ...(Object.hasOwn(value,"collection")?["collection"]:[]),
  ])) throw new Error("INVOICE_SNAPSHOT_SHAPE_INVALID");
  if ((value.schemaVersion !== 1 && value.schemaVersion !== 2 && value.schemaVersion !== 3) || !plainObject(value.seller) || !plainObject(value.customer)
    || !(plainObject(value.order)||(value.schemaVersion===3&&value.order===null&&Object.hasOwn(value,"collection"))) || !plainObject(value.totals) || !Array.isArray(value.lines)) {
    throw new Error("INVOICE_SNAPSHOT_TYPE_INVALID");
  }
  if (!exactKeys(value.seller, [
    "bankName", "bic", "city", "companyName", "country", "iban", "street", "zip",
    ...(value.schemaVersion===3?["vatId","taxNumber"]:["taxId"]),
  ])) throw new Error("INVOICE_SNAPSHOT_SELLER_SHAPE_INVALID");
  if (!exactKeys(value.customer, [
    "city", "companyName", "contactPerson", "country", "name", "street", "zip",
    ...(value.schemaVersion !== 1 ? ["vatId"] : []),
  ])) throw new Error("INVOICE_SNAPSHOT_CUSTOMER_SHAPE_INVALID");
  const collection=Object.hasOwn(value,"collection")?parseInvoiceCollectionOriginal(value.collection):undefined;
  if(collection&&(value.schemaVersion!==3||value.order!==null||value.serviceDate!==null||invoice.order_id!==null))throw Error("INVOICE_COLLECTION_ORIGINAL_SOURCE_INVALID");
  if (!collection&&(!plainObject(value.order)||!exactKeys(value.order, ["freezeId", "orderId", "orderNumber", "orderVersion", "title"]))) {
    throw new Error("INVOICE_SNAPSHOT_ORDER_SHAPE_INVALID");
  }
  if (!exactKeys(value.totals, [
    "grossAmountCents", "netAmountCents", "vatAmountCents", "vatRateBasisPoints",
    ...(value.schemaVersion !== 1 ? ["vatBreakdown"] : []),
  ])) throw new Error("INVOICE_SNAPSHOT_TOTALS_SHAPE_INVALID");

  const order=plainObject(value.order)?value.order:null;
  const orderVersion = order?toSafeInteger(order.orderVersion, "INVOICE_SNAPSHOT_ORDER_VERSION_INVALID"):null;
  const vat = readVat(invoice);
  const {netAmountCents,vatAmountCents,grossAmountCents,headRate:vatRateBasisPoints} = vat;
  const paymentTermDays = toSafeInteger(value.paymentTermDays, "INVOICE_SNAPSHOT_PAYMENT_TERM_INVALID");
  const issuedAt = toIso(value.issuedAt);
  const serviceDate = collection?null:toDateOnly(value.serviceDate);
  const schemaVersion = value.schemaVersion;
  const lines = value.lines.map(line => parseStoredLine(line, schemaVersion));
  if (
    (!collection&&(order?.orderId!==invoice.order_id||orderVersion===null||orderVersion<1))
    || lines.length < 1
    || netAmountCents < 0
    || paymentTermDays < 1
    || paymentTermDays > 365
  ) throw new Error("INVOICE_SNAPSHOT_INTEGRITY_INVALID");

  const originalSource=collection?{order:null,serviceDate:null,collection}:{order,serviceDate};
  assertInvoiceOriginalLineSources(originalSource,lines);
  const optionalSnapshotText = (input: unknown, error: string): string | null => {
    if (input === null) return null;
    return requiredText(input, error);
  };

  return {
    schemaVersion,
    seller: {
      companyName: requiredText(value.seller.companyName, "INVOICE_SNAPSHOT_SELLER_NAME_INVALID"),
      street: requiredText(value.seller.street, "INVOICE_SNAPSHOT_SELLER_STREET_INVALID"),
      zip: requiredText(value.seller.zip, "INVOICE_SNAPSHOT_SELLER_ZIP_INVALID"),
      city: requiredText(value.seller.city, "INVOICE_SNAPSHOT_SELLER_CITY_INVALID"),
      country: requiredText(value.seller.country, "INVOICE_SNAPSHOT_SELLER_COUNTRY_INVALID"),
      ...(schemaVersion===3?{vatId:optionalSnapshotText(value.seller.vatId,"INVOICE_SNAPSHOT_SELLER_VAT_INVALID"),taxNumber:optionalSnapshotText(value.seller.taxNumber,"INVOICE_SNAPSHOT_SELLER_TAX_NUMBER_INVALID")}:{taxId:requiredText(value.seller.taxId, "INVOICE_SNAPSHOT_SELLER_TAX_INVALID")}),
      iban: requiredText(value.seller.iban, "INVOICE_SNAPSHOT_SELLER_IBAN_INVALID"),
      bic: requiredText(value.seller.bic, "INVOICE_SNAPSHOT_SELLER_BIC_INVALID"),
      bankName: requiredText(value.seller.bankName, "INVOICE_SNAPSHOT_SELLER_BANK_INVALID"),
    },
    customer: {
      name: requiredText(value.customer.name, "INVOICE_SNAPSHOT_CUSTOMER_NAME_INVALID"),
      companyName: optionalSnapshotText(value.customer.companyName, "INVOICE_SNAPSHOT_CUSTOMER_COMPANY_INVALID"),
      contactPerson: optionalSnapshotText(value.customer.contactPerson, "INVOICE_SNAPSHOT_CUSTOMER_CONTACT_INVALID"),
      street: requiredText(value.customer.street, "INVOICE_SNAPSHOT_CUSTOMER_STREET_INVALID"),
      zip: requiredText(value.customer.zip, "INVOICE_SNAPSHOT_CUSTOMER_ZIP_INVALID"),
      city: requiredText(value.customer.city, "INVOICE_SNAPSHOT_CUSTOMER_CITY_INVALID"),
      country: requiredText(value.customer.country, "INVOICE_SNAPSHOT_CUSTOMER_COUNTRY_INVALID"),
      ...(schemaVersion !== 1 ? {vatId:optionalSnapshotText(value.customer.vatId,"INVOICE_SNAPSHOT_CUSTOMER_VAT_ID_INVALID")} : {}),
    },
    ...(collection?{order:null,collection}:{order:{
      orderId: requiredText(order?.orderId, "INVOICE_SNAPSHOT_ORDER_ID_INVALID"),
      orderVersion,
      orderNumber: requiredText(order?.orderNumber, "INVOICE_SNAPSHOT_ORDER_NUMBER_INVALID"),
      title: requiredText(order?.title, "INVOICE_SNAPSHOT_ORDER_TITLE_INVALID"),
      freezeId: requiredText(order?.freezeId, "INVOICE_SNAPSHOT_FREEZE_ID_INVALID"),
    }}),
    lines,
    totals: { netAmountCents, vatRateBasisPoints, vatAmountCents, grossAmountCents,
      ...(schemaVersion !== 1 ? {vatBreakdown:vat.groups} : {}),
    },
    serviceDate,
    issuedAt,
    paymentTermDays,
    ...(Object.hasOwn(value,"terms")?{terms:parseInvoicePaymentTerms(value.terms,paymentTermDays)}:{}),
  } as ImmutableInvoiceSnapshot;
}

type PreparedInvoiceContent = {
  seller: ImmutableInvoiceSnapshot["seller"];
  customer: ImmutableInvoiceSnapshot["customer"];
  order: NonNullable<ImmutableInvoiceSnapshot["order"]>;
  lines: ImmutableInvoiceLine[];
  totals: ImmutableInvoiceSnapshot["totals"];
};

type PreparedCollectionInvoiceContent=Omit<PreparedInvoiceContent,'order'>&{order:null;collection:InvoiceCollectionOriginal};
type PreparedInvoiceTerms={paymentTermDays:number;frozenInvoiceTerms?:InvoicePaymentTerms;serviceDate:Date|string|null;freezeId:string|null;afterGoodsOut:boolean;originalInvoiceNumber?:string;reissue?:NonNullable<ImmutableInvoiceReceiptBase['reissue']>;collectionCustomerId?:string;ignoredAgreements?:import("@/lib/server/effectiveCustomerAgreementRead").IgnoredCollectionAgreement[]};

/**
 * Builds every snapshot part that depends on live master data and frozen
 * lines. It runs *before* the number allocation so an incomplete tenant,
 * customer, order or position leaves invoice, lifecycle event and counter
 * completely untouched.
 */
/** The existing per-rate commercial rounding; no head-rate or second calculator. */
function invoiceLineTotals(lines:readonly ImmutableInvoiceLine[]){
  let netAmountCents = 0;
  const byRate=new Map<0|700|1900,number>();
  for(const line of lines){
    const rate=line.vat_rate_basis_points;
    if(rate===undefined)throw Error("INVOICE_LINE_RATE_REQUIRED");
    const amount=line.type==='BASE'||line.type==='MATERIAL'?line.lineNetAmountCents:line.amountCents;
    netAmountCents += amount;
    const accumulated=(byRate.get(rate)??0)+amount;
    if(!Number.isSafeInteger(accumulated))throw Error("INVOICE_AMOUNT_UNSAFE");
    byRate.set(rate,accumulated);
  }
  const vatBreakdown:InvoiceVatGroup[]=[...byRate].map(([rateBp,netCents])=>{
    const vatCents=Number((BigInt(netCents)*BigInt(rateBp)+BigInt(5000))/BigInt(10000));
    return {rateBp,netCents,vatCents,grossCents:netCents+vatCents};
  });
  const vatAmountCents=vatBreakdown.reduce((sum,group)=>sum+group.vatCents,0);
  const grossAmountCents=vatBreakdown.reduce((sum,group)=>sum+group.grossCents,0);
  if (
    !Number.isSafeInteger(netAmountCents)
    || !Number.isSafeInteger(vatAmountCents)
    || !Number.isSafeInteger(grossAmountCents)
    || netAmountCents < 0
  ) throw new Error("INVOICE_AMOUNT_UNSAFE");

  return {netAmountCents,vatAmountCents,grossAmountCents,vatBreakdown};
}

type InvoiceMaterialPosition = {
  auftragId: string;
  artikelId: string;
  artikel: string;
  menge: string;
  einheitCode: ImmutableInvoiceMaterialLine['unit'];
  verkaufspreis: string | null;
  betragCent: number | null;
  preisFehlt: boolean;
  eventIds: string[];
};
type InvoiceMaterialReader = (tx: PrivilegedTenantTransaction, auftragIds: readonly string[]) => Promise<readonly InvoiceMaterialPosition[]>;

type InvoiceScrapReport = { auftragId: string; itemId: string; menge: string; gesamt: string | null };
type InvoiceScrapPorts = {
  readReports: (tx: PrivilegedTenantTransaction, tenantId: string, orderIds: readonly string[]) => Promise<readonly InvoiceScrapReport[]>;
  readChargeMode: (tx: PrivilegedTenantTransaction, tenantId: string) => Promise<boolean>;
  readWork?: (tx: PrivilegedTenantTransaction, tenantId: string, orderIds: readonly string[]) => Promise<ReadonlyMap<string, Auftragsmehrarbeit>>;
  readWorkSettings?: (tx: PrivilegedTenantTransaction, tenantId: string) => Promise<{
    spielraumBasispunkte: number; stoppBasispunkte: number;
  } | null>;
  createFullScrapTask?: (tx: PrivilegedTenantTransaction, auth: AuthorizationSnapshot, orderId: string) => Promise<void>;
};

async function readInvoiceExtraWork(
  tx: PrivilegedTenantTransaction, auth: AuthorizationSnapshot, orderIds: readonly string[], ports?: InvoiceScrapPorts,
) {
  if (auth.packageSwitches?.p3_werkstatt !== true) return undefined;
  if (!ports?.readWork || !ports.readWorkSettings) throw Error('INVOICE_EXTRA_WORK_PORTS_MISSING');
  const settings = await ports.readWorkSettings(tx, auth.tenantId);
  if (!settings) throw new InvoiceElectronicSourceError({kind:'settings',field:'mehrarbeit'});
  const orders = await ports.readWork(tx, auth.tenantId, orderIds);
  return { orders, ...settings };
}

function applyInvoiceExtraWork(
  content: PreparedInvoiceContent,
  source: NonNullable<Awaited<ReturnType<typeof readInvoiceExtraWork>>>,
  basisNettoCent: number,
): PreparedInvoiceContent {
  const work = source.orders.get(content.order.orderId);
  if (!work) throw Error('INVOICE_EXTRA_WORK_ORDER_SOURCE_MISSING');
  const allocation = verteileMehrarbeit(work.positionen, basisNettoCent, source.spielraumBasispunkte, source.stoppBasispunkte, work.zusagen);
  const byPart = new Map(allocation.positionen.map(row => [
    JSON.stringify([row.position.itemId, row.position.catalogPositionId]), row,
  ]));
  const frozenCount = content.lines.filter(line => line.type === 'EXTRA_WORK').length;
  if (byPart.size !== frozenCount || allocation.positionen.length !== frozenCount) {
    throw Error('INVOICE_EXTRA_WORK_SOURCE_MISMATCH');
  }
  const lines = content.lines.flatMap((line): ImmutableInvoiceLine[] => {
    if (line.type !== 'EXTRA_WORK') return [line];
    const key = JSON.stringify([line.itemId, line.catalogPositionId]);
    const share = byPart.get(key);
    if (!share || share.position.minuten !== line.minutes || share.position.stundensatzCent !== line.hourlyRateCents) {
      throw Error('INVOICE_EXTRA_WORK_FROZEN_SOURCE_MISMATCH');
    }
    byPart.delete(key);
    const resulting: ImmutableInvoiceExtraWorkLine[] = [];
    const roundedLine = (minutes: number) => {
      const { fullCents, cappedCents } = invoiceExtraWorkCents(minutes, line.hourlyRateCents);
      return {...line, minutes, amountCents: cappedCents, unreducedAmountCents: fullCents};
    };
    if (share.zusageEventId) {
      resulting.push({...roundedLine(share.bestaetigteMinuten), approvalEventIds: [share.zusageEventId]});
    }
    const withinBudget = share.abrechenbareMinuten - share.bestaetigteMinuten;
    if (withinBudget > 0) resulting.push(share.spielraumGekappt ? roundedLine(withinBudget) : line);
    return resulting;
  });
  return {...content, lines, totals: {...invoiceLineTotals(lines), vatRateBasisPoints: null}};
}

async function readInvoiceScrap(
  tx: PrivilegedTenantTransaction, auth: AuthorizationSnapshot, orderIds: readonly string[], ports?: InvoiceScrapPorts,
) {
  if (auth.packageSwitches?.p3_werkstatt !== true) return new Map<string, Map<string, InvoiceScrapReport>>();
  if (!ports) throw Error('INVOICE_SCRAP_PORTS_MISSING');
  const byOrder = new Map(orderIds.map(id => [id, new Map<string, InvoiceScrapReport>()]));
  if (await ports.readChargeMode(tx, auth.tenantId)) return byOrder;
  for (const report of await ports.readReports(tx, auth.tenantId, orderIds)) {
    const byItem = byOrder.get(report.auftragId);
    if (!byItem || byItem.has(report.itemId)) throw Error('INVOICE_SCRAP_REPORT_INVALID');
    byItem.set(report.itemId, report);
  }
  return byOrder;
}

function applyInvoiceScrap(content: PreparedInvoiceContent, reports?: ReadonlyMap<string, InvoiceScrapReport>): PreparedInvoiceContent {
  if (!reports?.size) return content;
  let remainingPositions = 0;
  const lines = content.lines.flatMap((line): ImmutableInvoiceLine[] => {
    if (line.type !== 'BASE') return [line];
    const report = reports.get(line.itemId);
    if (!report || report.menge === '0') {
      remainingPositions++;
      return [line];
    }
    const measured = isMeasuredBaseUnit(line.unit);
    if (!measured && line.unit !== 'C62') throw Error('INVOICE_SCRAP_UNIT_INVALID');
    if (measured && (!report.gesamt || !/^[1-9]\d*$/.test(report.gesamt))) {
      throw new InvoiceScrapError(INVOICE_SCRAP_COPY.piecesMissing(line.name));
    }
    const total = measured ? Number(report.gesamt) : line.quantity;
    const scrap = Number(report.menge);
    if (!Number.isSafeInteger(total) || total < 1 || !/^[1-9]\d*$/.test(report.menge)
      || !Number.isSafeInteger(scrap) || scrap > total) throw Error('INVOICE_SCRAP_REPORT_INVALID');
    const remaining = total - scrap;
    if (!measured && remaining === 0) return [];
    if (remaining > 0) remainingPositions++;
    const quantity = measured ? line.quantity : remaining;
    const pieces = BigInt(total);
    const lineNetAmountCents = Number((BigInt(line.lineNetAmountCents)*BigInt(remaining)+pieces/BigInt(2))/pieces);
    try {
      const {unitNetAmountCents} = invoiceBaseUnitAmounts(quantity, lineNetAmountCents, line.unit);
      return [{...line, quantity, lineNetAmountCents, unitNetAmountCents}];
    } catch {
      throw new InvoiceElectronicSourceError({kind:'order',itemId:line.itemId,objectId:content.order.orderId,field:'rounding'});
    }
  });
  if (!remainingPositions) throw new InvoiceScrapError(ORDER_SCRAP_COPY.allParts, content.order.orderId);
  return {...content, lines, totals: {...invoiceLineTotals(lines), vatRateBasisPoints: null}};
}

async function applyInvoiceScrapWithinTransaction(
  tx: PrivilegedTenantTransaction,
  auth: AuthorizationSnapshot,
  content: PreparedInvoiceContent,
  reports: ReadonlyMap<string, InvoiceScrapReport> | undefined,
  ports?: InvoiceScrapPorts,
) {
  try {
    return applyInvoiceScrap(content, reports);
  } catch (error) {
    if (!(error instanceof InvoiceScrapError) || !error.fullScrapOrderId || !ports?.createFullScrapTask) throw error;
    await ports.createFullScrapTask(tx, auth, error.fullScrapOrderId);
    return {code: 'VALIDATION_ERROR', message: error.message} as const;
  }
}

async function readInvoiceMaterial(tx: PrivilegedTenantTransaction, auth: AuthorizationSnapshot, auftragIds: readonly string[], readMaterial?: InvoiceMaterialReader) {
  if (auth.packageSwitches?.p4_lager !== true) return [];
  if (!readMaterial) throw Error('INVOICE_MATERIAL_PORT_MISSING');
  const positionen = await readMaterial(tx, auftragIds);
  const requested = new Set(auftragIds);
  if (positionen.some(position => !requested.has(position.auftragId))) throw Error('INVOICE_MATERIAL_ORDER_INVALID');
  const ohnePreis = [...new Set(positionen.filter(position => position.preisFehlt).map(position => position.artikel))];
  if (ohnePreis.length > 0) throw new InvoiceMaterialPriceError(ohnePreis);
  return positionen;
}

function appendInvoiceMaterial(content: PreparedInvoiceContent, positionen: readonly InvoiceMaterialPosition[], companyRate: number | null): PreparedInvoiceContent {
  if (positionen.length === 0) return content;
  const reverseCharge = INVOICE_EU_OUTSIDE_DE.has(content.customer.country) && !!content.customer.vatId;
  const material = positionen.map((position): ImmutableInvoiceMaterialLine => {
    const name = LAGER_MATERIAL_COPY.rechnungsposition(position.artikel);
    if (position.verkaufspreis === null || position.betragCent === null) throw Error('INVOICE_MATERIAL_PRICE_INVALID');
    return {
      type: 'MATERIAL', sourceOrderId: position.auftragId, articleId: position.artikelId, name,
      quantity: position.menge, unit: position.einheitCode, unitNetAmount: position.verkaufspreis,
      lineNetAmountCents: position.betragCent, vat_rate_basis_points: invoiceLineVat(null, name, reverseCharge, companyRate),
      taxCategory: reverseCharge ? 'AE' : 'S', eventIds: position.eventIds,
    };
  });
  const lines = [...content.lines.filter(line => line.type !== 'SHIPPING'), ...material,
    ...content.lines.filter(line => line.type === 'SHIPPING')];
  return { ...content, lines, totals: { ...invoiceLineTotals(lines), vatRateBasisPoints: null } };
}

function prepareInvoiceContent(
  source: SourceRow,
  order: LockedOrder,
  shippingFees:Array<{shipmentGroupId:string;amountCents:number;name:string;shippingKind:'fee'|'reference'}>,
  shippingOnly=false,
): PreparedInvoiceContent {
  const customerCountry=masterDataText(source.customer_country,"INVOICE_CUSTOMER_COUNTRY_INVALID");
  const customerVatId=optionalText(source.customer_vat_id);
  const reverseCharge=INVOICE_EU_OUTSIDE_DE.has(customerCountry)&&customerVatId!==null;
  const vatSource={reverseCharge,companyRate:source.invoice_vat_rate_basis_points,electronic:true as const};
  // PL14Nov05:45: this document bills only the selected real shipping source.
  // Zero goods is known from its explicit kind, never a missing-price fallback.
  const baseLines = shippingOnly?[]:parseBaseLines(source.base_lines,vatSource);
  const extraWorkLines = shippingOnly?[]:parseExtraWorkLines(source.extra_work_lines,vatSource);
  const shippingLines:ImmutableInvoiceShippingLine[]=shippingFees.map(fee=>({type:'SHIPPING',unit:'C62',taxCategory:reverseCharge?'AE':'S',shippingKind:fee.shippingKind,shipmentGroupId:fee.shipmentGroupId,name:fee.name,amountCents:fee.amountCents,vat_rate_basis_points:invoiceLineVat(null,fee.name,reverseCharge,source.invoice_vat_rate_basis_points)}));
  if (
    !shippingOnly && (baseLines.length !== toSafeInteger(source.base_line_count, "INVOICE_BASE_LINE_COUNT_INVALID")
    || extraWorkLines.length !== toSafeInteger(source.extra_work_line_count, "INVOICE_EXTRA_WORK_LINE_COUNT_INVALID"))
  ) throw new Error("INVOICE_LINE_COUNT_MISMATCH");
  if ((!shippingOnly && baseLines.length < 1)||(shippingOnly&&shippingLines.length<1)) {
    throw new InvoiceMasterDataError("INVOICE_BASE_LINES_MISSING");
  }

  const baseNetAmountCents = shippingOnly?0:toSafeInteger(source.base_net_amount_cents, "INVOICE_BASE_AMOUNT_INVALID");
  const extraWorkNetAmountCents = shippingOnly?0:toSafeInteger(source.extra_work_net_amount_cents, "INVOICE_EXTRA_WORK_AMOUNT_TOTAL_INVALID");
  if (
    baseLines.reduce((sum, line) => sum + line.lineNetAmountCents, 0) !== baseNetAmountCents
    || extraWorkLines.reduce((sum, line) => sum + line.amountCents, 0) !== extraWorkNetAmountCents
  ) throw new Error("INVOICE_LINE_TOTAL_MISMATCH");

  const {netAmountCents,vatAmountCents,grossAmountCents,vatBreakdown}=invoiceLineTotals([...baseLines,...extraWorkLines,...shippingLines]);

  return {
    seller: {
      companyName: masterDataText(source.seller_company_name, "INVOICE_SELLER_NAME_INVALID"),
      street: masterDataText(source.seller_street, "INVOICE_SELLER_STREET_INVALID"),
      zip: masterDataText(source.seller_zip, "INVOICE_SELLER_ZIP_INVALID"),
      city: masterDataText(source.seller_city, "INVOICE_SELLER_CITY_INVALID"),
      country: masterDataText(source.seller_country, "INVOICE_SELLER_COUNTRY_INVALID"),
      vatId: optionalText(source.seller_vat_id),
      taxNumber: optionalText(source.seller_tax_number),
      iban: masterDataText(source.seller_iban, "INVOICE_SELLER_IBAN_INVALID"),
      bic: masterDataText(source.seller_bic, "INVOICE_SELLER_BIC_INVALID"),
      bankName: masterDataText(source.seller_bank_name, "INVOICE_SELLER_BANK_NAME_INVALID"),
    },
    customer: {
      name: masterDataText(source.customer_name, "INVOICE_CUSTOMER_NAME_INVALID"),
      companyName: optionalText(source.customer_company_name),
      contactPerson: optionalText(source.customer_contact_person),
      street: masterDataText(source.customer_street, "INVOICE_CUSTOMER_STREET_INVALID"),
      zip: masterDataText(source.customer_zip, "INVOICE_CUSTOMER_ZIP_INVALID"),
      city: masterDataText(source.customer_city, "INVOICE_CUSTOMER_CITY_INVALID"),
      country: customerCountry,
      vatId:customerVatId,
    },
    order: {
      orderId: order.id,
      orderVersion: order.version,
      orderNumber: masterDataText(source.order_number, "INVOICE_ORDER_NUMBER_INVALID"),
      title: masterDataText(source.order_title, "INVOICE_ORDER_TITLE_INVALID"),
      freezeId: requiredText(source.freeze_id, "INVOICE_FREEZE_ID_INVALID"),
    },
    lines: [...baseLines, ...extraWorkLines,...shippingLines] as ImmutableInvoiceLine[],
    totals: { netAmountCents, vatRateBasisPoints:null, vatBreakdown, vatAmountCents, grossAmountCents },
  };
}

export function mapInvoiceIssueReceipt(row:ReceiptRow,tenantId:string,actorId:string,readVat:InvoiceVatReader):ImmutableInvoiceReceipt;
export function mapInvoiceIssueReceipt(row:CollectionReceiptRow,tenantId:string,actorId:string,readVat:InvoiceVatReader):ImmutableInvoiceCollectionReceipt;
export function mapInvoiceIssueReceipt(row:ReceiptRow|CollectionReceiptRow,tenantId:string,actorId:string,readVat:InvoiceVatReader):ImmutableInvoiceReceipt|ImmutableInvoiceCollectionReceipt {
  const collection=row.order_id===null?parseStoredSnapshot(row.snapshot,row,readVat).collection:undefined;
  if(row.order_id===null&&collection===undefined)throw Error('INVOICE_COLLECTION_RECEIPT_SOURCE_INVALID');
  const reissue=readIssuedReissueIntent(row.reissue_intent,actorId);
  const kindValid=row.belegart==='auftrag'
    ?row.ursprung_rechnung_id===null&&row.shipping_costs_intent===null
    :row.belegart==='versandkosten'&&typeof row.ursprung_rechnung_id==='string'&&UUID_PATTERN.test(row.ursprung_rechnung_id)
      &&row.order_id!==null&&validShippingCosts(row.shipping_costs_intent,row.order_id,true)
      &&row.shipping_costs_intent.invoiceId===row.ursprung_rechnung_id
      &&plainObject(row.snapshot)&&Array.isArray(row.snapshot.lines)&&row.snapshot.lines.length>0
      &&row.snapshot.lines.every(line=>plainObject(line)&&line.type==='SHIPPING')
      &&row.shipping_costs_intent.expectedFeeCents===toSafeInteger(row.net_amount_cents,'INVOICE_SHIPPING_NET_INVALID');
  if(!kindValid)throw Error('INVOICE_RECEIPT_KIND_INVALID');
  const orderVersion = collection?null:toSafeInteger(row.order_version, "INVOICE_RECEIPT_ORDER_VERSION_INVALID");
  const intentExpectedVersion = toSafeInteger(
    row.intent_expected_version,
    "INVOICE_RECEIPT_INTENT_VERSION_INVALID",
  );
  const {netAmountCents,vatAmountCents,grossAmountCents,headRate:vatRateBasisPoints}=readVat(row);
  const aggregateVersion = toSafeInteger(row.aggregate_version, "INVOICE_RECEIPT_VERSION_INVALID");
  const eventSchemaVersion = toSafeInteger(row.event_schema_version, "INVOICE_RECEIPT_SCHEMA_INVALID");
  const serviceDate = collection?null:toDateOnly(row.service_date);
  const dueDate = toDateOnly(row.due_date);
  const currentLifecycleValid = (
    row.current_status === "issued"
    && row.current_version === 1
    && row.cancel_reason === null
  ) || (
    row.current_status === "cancelled"
    && row.current_version === 2
    && typeof row.cancel_reason === "string"
    && row.cancel_reason === row.cancel_reason.trim()
    && row.cancel_reason.length >= 5
    && row.cancel_reason.length <= 500
  );
  if (
    row.integrity_ok !== true
    || row.tenant_id !== tenantId
    || row.actor_id !== actorId
    || !UUID_PATTERN.test(row.actor_id)
    || (collection?row.event_type!==COLLECTION_EVENT_TYPE:(row.event_type !== EVENT_TYPE && row.event_type !== EVENT_TYPE_V2))
    || (collection?eventSchemaVersion!==3:(row.event_type === EVENT_TYPE ? eventSchemaVersion !== EVENT_SCHEMA_VERSION : eventSchemaVersion !== 2))
    || aggregateVersion !== 1
    || !currentLifecycleValid
    || (collection?intentExpectedVersion!==collection.version:(orderVersion===null||orderVersion<1||intentExpectedVersion!==orderVersion))
    || !UUID_PATTERN.test(row.event_id)
    || !UUID_PATTERN.test(row.client_event_id)
    || !UUID_PATTERN.test(row.correlation_id)
    || !UUID_PATTERN.test(row.invoice_id)
    || !INVOICE_NUMBER_PATTERN.test(row.invoice_number)
    || row.pdf_ref !== `invoice://${row.invoice_id}/original`
    || !HEX64_PATTERN.test(row.pdf_sha256)
    || row.original_pdf_sha256 !== row.pdf_sha256
    || netAmountCents < 0
    || vatAmountCents < 0
    || grossAmountCents !== netAmountCents + vatAmountCents
  ) throw new Error("INVOICE_RECEIPT_INVALID");

  const common = {
    ...(reissue?{reissue}:{}),
    invoiceId: row.invoice_id,
    invoiceNumber: row.invoice_number,
    status: "issued" as const,
    netAmountCents,
    vatRateBasisPoints,
    vatAmountCents,
    grossAmountCents,
    dueDate,
    issuedAt: toIso(row.occurred_at),
    issuedBy: row.actor_id,
    pdfRef: row.pdf_ref,
    pdfSha256: row.pdf_sha256,
    eventId: row.event_id,
    clientEventId: row.client_event_id,
    correlationId: row.correlation_id,
    aggregateVersion: 1 as const,
    ...(row.belegart==='versandkosten'?{belegart:'versandkosten' as const,ursprungRechnungId:requiredText(row.ursprung_rechnung_id,'INVOICE_SHIPPING_ORIGIN_MISSING')} : {}),
  };
  if(collection){
    if(reissue!==undefined||row.belegart!=='auftrag'||row.order_id!==null||row.order_version!==null||row.service_date!==null)throw Error('INVOICE_COLLECTION_RECEIPT_INVALID');
    return {...common,orderId:null,orderVersion:null,serviceDate:null,collection,eventSchemaVersion:3};
  }
  if(row.order_id===null||orderVersion===null||serviceDate===null)throw Error('INVOICE_RECEIPT_SOURCE_INVALID');
  const receipt:ImmutableInvoiceReceiptBase={...common,orderId:row.order_id,orderVersion,serviceDate};
  return row.event_type===EVENT_TYPE_V2?{...receipt,eventSchemaVersion:2,invoiceSourceState:'after_goods_out'}:{...receipt,eventSchemaVersion:1};
}

export function mapInvoiceCancellationReceipt(
  row: ReceiptRow|CollectionReceiptRow,
  tenantId: string,
  actorId: string,
): ImmutableInvoiceCancellationReceipt {
  const collection=row.order_id===null?parseInvoiceCollectionOriginal((row.snapshot as {collection:unknown}).collection):undefined;
  if(collection&&(row.order_version!==null||row.service_date!==null||row.reissue_intent!=null))throw Error("INVOICE_CANCEL_COLLECTION_IDENTITY_INVALID");
  const orderVersion = collection?null:toSafeInteger(row.order_version, "INVOICE_CANCEL_RECEIPT_ORDER_VERSION_INVALID");
  const expectedVersion = toSafeInteger(
    row.intent_expected_version,
    "INVOICE_CANCEL_RECEIPT_EXPECTED_VERSION_INVALID",
  );
  const aggregateVersion = toSafeInteger(row.aggregate_version, "INVOICE_CANCEL_RECEIPT_VERSION_INVALID");
  const eventSchemaVersion = toSafeInteger(
    row.event_schema_version,
    "INVOICE_CANCEL_RECEIPT_SCHEMA_INVALID",
  );
  const reason = requiredText(row.cancel_reason, "INVOICE_CANCEL_RECEIPT_REASON_INVALID");
  if(row.cancellation_invoice_number!=null&&(!INVOICE_NUMBER_PATTERN.test(row.cancellation_invoice_number)||row.cancellation_invoice_number===row.invoice_number))throw Error('INVOICE_CANCEL_RECEIPT_NUMBER_INVALID');
  if (
    row.integrity_ok !== true
    || row.tenant_id !== tenantId
    || row.actor_id !== actorId
    || row.event_type !== CANCEL_EVENT_TYPE
    || eventSchemaVersion !== EVENT_SCHEMA_VERSION
    || expectedVersion !== 1
    || aggregateVersion !== 2
    || row.current_version !== 2
    || row.current_status !== "cancelled"
    || (orderVersion!==null&&orderVersion < 1)
    || reason !== row.cancel_reason
    || reason.length < 5
    || reason.length > 500
    || !UUID_PATTERN.test(row.event_id)
    || !UUID_PATTERN.test(row.client_event_id)
    || !UUID_PATTERN.test(row.correlation_id)
    || !UUID_PATTERN.test(row.invoice_id)
    || !INVOICE_NUMBER_PATTERN.test(row.invoice_number)
    || row.pdf_ref !== `invoice://${row.invoice_id}/cancellation`
    || !HEX64_PATTERN.test(row.pdf_sha256)
    || !HEX64_PATTERN.test(row.original_pdf_sha256)
  ) throw new Error("INVOICE_CANCEL_RECEIPT_INVALID");

  const common:Omit<ImmutableInvoiceSingleCancellationReceipt,'orderId'|'orderVersion'|'reissueWithoutShipping'> = {
    invoiceId: row.invoice_id,
    invoiceNumber: row.invoice_number,
    status: "cancelled",
    reason,
    cancelledAt: toIso(row.occurred_at),
    ...(row.cancellation_invoice_number?{cancellationNumber:row.cancellation_invoice_number}:{}),
    cancelledBy: row.actor_id,
    originalPdfSha256: row.original_pdf_sha256,
    cancellationPdfRef: row.pdf_ref,
    cancellationPdfSha256: row.pdf_sha256,
    eventId: row.event_id,
    clientEventId: row.client_event_id,
    correlationId: row.correlation_id,
    expectedVersion: 1,
    aggregateVersion: 2,
    eventSchemaVersion: 1,
  };
  if(collection)return {...common,orderId:null,orderVersion:null,collection};
  if(row.order_id===null||orderVersion===null)throw Error('INVOICE_CANCEL_SINGLE_IDENTITY_INVALID');
  return {...common,orderId:row.order_id,orderVersion,...(row.reissue_intent!=null?{reissueWithoutShipping:readStoredReissueIntent(row.reissue_intent,row)}:{})};
}

function receiptMatchesIntent(receipt: ImmutableInvoiceReceipt, input: CreateInvoiceInput, row:ReceiptRow): boolean {
  return receipt.orderId === input.orderId
    && receipt.orderVersion === input.expectedVersion
    && (input.shippingCosts===undefined
      ?row.belegart==='auftrag'&&row.ursprung_rechnung_id===null&&row.shipping_costs_intent===null
      :row.belegart==='versandkosten'&&row.ursprung_rechnung_id===input.shippingCosts.invoiceId
        &&validShippingCosts(row.shipping_costs_intent,input.orderId,true)
        &&row.shipping_costs_intent.invoiceId===input.shippingCosts.invoiceId
        &&row.shipping_costs_intent.expectedVersion===input.shippingCosts.expectedVersion
        &&row.shipping_costs_intent.scope===input.shippingCosts.scope
        &&row.shipping_costs_intent.expectedFeeCents===input.shippingCosts.expectedFeeCents);
}

type NativeCollectionReceiptRead={collectionId:string;clientEventId?:string};
function createInvoiceReceiptsQuery(source:string|{orderId:string}|{orderIds:readonly string[]}|NativeCollectionReceiptRead){
 const native=typeof source==='object'&&'collectionId'in source,byKey=typeof source==='string';
 const predicate=native?sql`(snapshot#>>'{collection,collectionId}')=${source.collectionId} ${source.clientEventId===undefined?sql``:sql`AND client_event_id=${source.clientEventId}::uuid`}`:byKey?sql`client_event_id=${source}::uuid`:'orderIds'in source?sql`order_id=ANY(ARRAY[${sql.join(source.orderIds.map(id=>sql`${id}`),sql`, `)}]::text[])`:sql`order_id=${source.orderId}`;
 return sql`
  WITH receipt AS(
   SELECT * FROM private.v_invoice_receipt_v1 WHERE ${predicate} AND event_type=${native?COLLECTION_EVENT_TYPE:EVENT_TYPE}
   UNION ALL SELECT * FROM private.v_invoice_created_receipt_v2 WHERE ${predicate} AND event_type=${EVENT_TYPE_V2} AND ${!native}
  ) SELECT receipt.*,invoice.belegart,invoice.ursprung_rechnung_id::text,event.payload->'shippingCosts' AS shipping_costs_intent,event.payload->'reissue' AS reissue_intent
  FROM receipt JOIN public.invoices invoice ON invoice.tenant_id=receipt.tenant_id AND invoice.id=receipt.invoice_id
   JOIN public.events event ON event.tenant_id=receipt.tenant_id AND event.id=receipt.event_id
  ${byKey||native?sql`LIMIT 2`:sql``}`;
}
export function readCreateInvoiceReceipts(tx:PrivilegedTenantTransaction,source:string|{orderId:string}):Promise<ReceiptRow[]>;
export function readCreateInvoiceReceipts(tx:PrivilegedTenantTransaction,source:NativeCollectionReceiptRead):Promise<CollectionReceiptRow[]>;
export async function readCreateInvoiceReceipts(tx:PrivilegedTenantTransaction,source:string|{orderId:string}|NativeCollectionReceiptRead):Promise<Array<ReceiptRow|CollectionReceiptRow>>{
 if(typeof source!=='string'&&'orderId'in source){
  const receipts=await readCreateInvoiceReceiptsMany(tx,[source.orderId]),rows=receipts.get(source.orderId);
  if(rows===undefined)throw Error('SHIPPING_PROPOSAL_ORIGINAL_AMBIGUOUS');return rows;
 }
 return tx.execute<ReceiptRow|CollectionReceiptRow>(createInvoiceReceiptsQuery(source));
}
/** Same tenant-scoped receipt views and joins; no historical original is filtered out. */
export async function readCreateInvoiceReceiptsMany(tx:PrivilegedTenantTransaction,orderIds:readonly string[]):Promise<Map<string,ReceiptRow[]>>{
 const ids=[...new Set(orderIds)],result=new Map<string,ReceiptRow[]>(ids.map(id=>[id,[]]));if(!ids.length)return result;
 const rows=await tx.execute<ReceiptRow>(createInvoiceReceiptsQuery({orderIds:ids}));
 for(const row of rows){const group=result.get(row.order_id);if(!group)throw Error('SHIPPING_PROPOSAL_ORIGINAL_AMBIGUOUS');group.push(row);}
 return result;
}

/** The same canonical cancellation query serves command, reader and repair. */
export async function readCancellationInvoiceReceipts(tx:PrivilegedTenantTransaction,clientEventId:string,invoiceId?:string):Promise<Array<ReceiptRow|CollectionReceiptRow>>{
 return tx.execute<ReceiptRow|CollectionReceiptRow>(sql`SELECT receipt.*,invoice.cancellation_invoice_number,event.payload->'reissue' AS reissue_intent
  FROM private.v_invoice_receipt_v1 receipt JOIN public.events event ON event.tenant_id=receipt.tenant_id AND event.id=receipt.event_id
  JOIN public.invoices invoice ON invoice.tenant_id=receipt.tenant_id AND invoice.id=receipt.invoice_id
  WHERE receipt.client_event_id=${clientEventId}::uuid AND receipt.event_type=${CANCEL_EVENT_TYPE}
   ${invoiceId!==undefined?sql`AND receipt.invoice_id=${invoiceId}::uuid`:sql``} LIMIT 2`);
}

/** Narrow immutable R2 source. Current rights are checked at the command/task
 * boundary; original confirmer and actual replacement issuer stay distinct. */
export async function readInvoiceReissueSource(tx:PrivilegedTenantTransaction,tenantId:string,key:string,readVat:InvoiceVatReader=readInvoiceVat){
 const rows=await readCancellationInvoiceReceipts(tx,key);
 if(!rows.length)return null;
 if(rows.length!==1)throw Error('INVOICE_REISSUE_CANCELLATION_AMBIGUOUS');
 const receipt=mapInvoiceCancellationReceipt(rows[0],tenantId,rows[0].actor_id),intent=receipt.reissueWithoutShipping;
 if(!intent)return null;
 if(receipt.orderId===null)throw Error('INVOICE_REISSUE_COLLECTION_FORBIDDEN');
 const originals=await tx.execute<LockedInvoice&{customer_id:string;freeze_id:string;belegart:string}>(sql`SELECT * FROM public.invoices WHERE tenant_id=${tenantId} AND id=${receipt.invoiceId}::uuid`);
 const original=originals[0];
 if(originals.length!==1||!original||original.belegart!=='auftrag'||original.status!=='cancelled'||original.order_id!==receipt.orderId
  ||original.pdf_sha256!==intent.originalPdfSha256||!original.pdf_content||createHash('sha256').update(original.pdf_content).digest('hex')!==intent.originalPdfSha256)throw Error('INVOICE_REISSUE_ORIGINAL_INVALID');
 const snapshot=parseStoredSnapshot(original.snapshot,original,readVat),goods=snapshot.lines.filter(line=>line.type==='BASE'||line.type==='EXTRA_WORK');
 if(snapshot.schemaVersion===1||!snapshot.lines.some(line=>line.type==='SHIPPING')||goods.length===0)throw Error('INVOICE_REISSUE_GOODS_SOURCE_INVALID');
 const manual=await readInvoiceHandoverSource(tx,tenantId,intent.handoverEventId);
 if(manual.order_id!==receipt.orderId||manual.order_version!==intent.orderVersion||manual.payload.receipt.outcome!=='changed'||manual.payload.receipt.handoverMode!=='pickup')throw Error('INVOICE_REISSUE_HANDOVER_SOURCE_INVALID');
 const replacements=await readCreateInvoiceReceipts(tx,intent.replacementClientEventId);
 if(replacements.length>1)throw Error('INVOICE_REISSUE_REPLACEMENT_AMBIGUOUS');
 let replacement:ImmutableInvoiceReceipt|null=null;
 if(replacements[0]){
  const row=replacements[0];replacement=mapInvoiceIssueReceipt(row,tenantId,row.actor_id,readVat);
  const issuedSnapshot=parseStoredSnapshot(row.snapshot,row,readVat);
  if(replacement.reissue?.cancellationEventId!==receipt.eventId||replacement.reissue.confirmedBy!==receipt.cancelledBy
   ||replacement.reissue.repairActorId!==replacement.issuedBy||replacement.orderId!==receipt.orderId||replacement.orderVersion<intent.orderVersion
   ||canonicalJson(issuedSnapshot.lines.filter(line=>line.type!=='MATERIAL'))!==canonicalJson(goods)||canonicalJson(issuedSnapshot.seller)!==canonicalJson(snapshot.seller)
   ||canonicalJson(issuedSnapshot.customer)!==canonicalJson(snapshot.customer)||issuedSnapshot.paymentTermDays!==snapshot.paymentTermDays||issuedSnapshot.serviceDate!==snapshot.serviceDate)throw Error('INVOICE_REISSUE_REPLACEMENT_SOURCE_INVALID');
 }
 return {receipt,intent,original,snapshot,goods,replacement,pending:replacement===null,current:manual.current_order_version>=intent.orderVersion&&manual.current_handover_mode==='pickup'};
}

function invoiceIssueSourceQuery(orderId:string|ReturnType<typeof sql>){
 return sql`
        SELECT source.*,EXISTS(SELECT 1 FROM private.quote_conversion_receipts receipt JOIN private.quotes quote ON quote.tenant_id=receipt.tenant_id AND quote.id=receipt.quote_id AND quote.linked_order_id=receipt.order_id WHERE receipt.tenant_id=source.tenant_id AND receipt.order_id=source.order_id) AS has_quote
        FROM private.v_invoice_issue_source_v2 source
        WHERE source.order_id = ${orderId}
        LIMIT 2
      `;
}
async function readInvoiceIssueSource(tx:PrivilegedTenantTransaction,orderId:string){
 return tx.execute<SourceRow>(invoiceIssueSourceQuery(orderId));
}
async function readInvoiceIssueSourceRows(tx:PrivilegedTenantTransaction,orderIds:readonly string[]){
 const rows=await tx.execute<SourceRow&{batch_order_id:string}>(sql`SELECT requested.order_id AS batch_order_id,source.*
 FROM unnest(ARRAY[${sql.join(orderIds.map(id=>sql`${id}`),sql`, `)}]::text[]) requested(order_id)
 CROSS JOIN LATERAL (${invoiceIssueSourceQuery(sql`requested.order_id`)}) source`);
 return rows.map(({batch_order_id,...row})=>({id:batch_order_id,row}));
}

/** Nummer des Originals, das eine Ausschusskorrektur am Auftrag sperrt. */
export async function readOrderScrapInvoiceNumberInTransaction(
  tx: PrivilegedTenantTransaction, tenantId: string, orderId: string,
) {
  return readOrderInvoiceNumberInTransaction(tx, tenantId, orderId, 'not_cancelled');
}

export async function readOrderInvoiceNumberInTransaction(
  tx: PrivilegedTenantTransaction,
  tenantId: string,
  orderId: string,
  selection: 'not_cancelled' | 'issued' | 'issued_or_cancelled',
) {
  const status = {
    not_cancelled: sql`original.status IS DISTINCT FROM 'cancelled'`,
    issued: sql`original.status = 'issued'`,
    issued_or_cancelled: sql`original.status IN ('issued', 'cancelled')`,
  }[selection];
  const activeOrderFirst = selection === 'not_cancelled' ? sql`` : sql`
    CASE WHEN original.status = 'issued' AND original.order_id = ${orderId}
      AND original.belegart = 'auftrag' THEN 0 ELSE 1 END,
  `;
  const [rechnung] = await tx.execute<{ invoiceNumber: string }>(sql`
    SELECT original.invoice_number AS "invoiceNumber"
    FROM private.v_invoice_order_members_v1 mitglied
    JOIN public.invoices original ON original.tenant_id = mitglied.tenant_id AND original.id = mitglied.invoice_id
    WHERE mitglied.tenant_id = ${tenantId} AND mitglied.order_id = ${orderId}
      AND ${status}
    ORDER BY ${activeOrderFirst} original.issued_at DESC NULLS LAST, original.id DESC
    LIMIT 1
  `);
  return rechnung?.invoiceNumber ?? null;
}

/** Read the work actually billed in issued single and collection originals. */
export async function leseBerechneteMehrarbeitInTransaction(
  tx: PrivilegedTenantTransaction, tenantId: string, auftragIds: readonly string[], readVat: InvoiceVatReader,
): Promise<ReadonlyMap<string, readonly ImmutableInvoiceExtraWorkLine[]>> {
  const ergebnis = new Map<string, ImmutableInvoiceExtraWorkLine[]>();
  if (!auftragIds.length) return ergebnis;
  const ids = sql.join(auftragIds.map(id => sql`${id}`), sql`, `);
  const belege = await tx.execute<{ auftrag_id: string; invoice_id: string; order_id: string | null; snapshot: unknown }>(sql`
    SELECT mitglied.order_id AS auftrag_id, original.id::text AS invoice_id, original.order_id, original.snapshot
    FROM private.v_invoice_order_members_v1 mitglied
    JOIN public.invoices original ON original.tenant_id = mitglied.tenant_id AND original.id = mitglied.invoice_id
    WHERE mitglied.tenant_id = ${tenantId} AND mitglied.order_id IN (${ids})
      AND original.status = 'issued' AND original.contract_version = 1
      AND (original.order_id IS NULL OR original.belegart = 'auftrag')
  `);
  const originale = new Map<string, ImmutableInvoiceSnapshot>();
  for (const beleg of belege) {
    let original = originale.get(beleg.invoice_id);
    if (!original) {
      original = parseStoredSnapshot(beleg.snapshot, beleg, readVat);
      originale.set(beleg.invoice_id, original);
    }
    const positionen = ergebnis.get(beleg.auftrag_id) ?? [];
    for (const zeile of original.lines) {
      if (zeile.type === 'EXTRA_WORK' && (zeile.sourceOrderId ?? original.order?.orderId) === beleg.auftrag_id) {
        positionen.push(zeile);
      }
    }
    ergebnis.set(beleg.auftrag_id, positionen);
  }
  return ergebnis;
}

function cancellationReceiptMatchesIntent(
  receipt: ImmutableInvoiceCancellationReceipt,
  input: CancelInvoiceInput,
): boolean {
  return receipt.invoiceId === input.invoiceId
    && receipt.expectedVersion === input.expectedVersion
    && receipt.reason === input.reason
    &&(input.reissueWithoutShipping===undefined?receipt.reissueWithoutShipping===undefined:
      receipt.reissueWithoutShipping?.handoverEventId===input.reissueWithoutShipping.handoverEventId
      &&receipt.reissueWithoutShipping.replacementClientEventId===input.reissueWithoutShipping.replacementClientEventId);
}

async function readInitialPaymentState(
  tx: PrivilegedTenantTransaction,
  expected: {
    tenantId: string;
    invoiceId: string;
    orderId: string|null;
    grossAmountCents: number;
    paymentMode: PaymentMode;
  },
): Promise<void> {
  const rows = await tx.execute<InvoicePaymentInitializationRow>(sql`
    SELECT
      id::text,
      tenant_id,
      order_id,
      gross_amount_cents,
      payment_contract_version,
      payment_mode,
      payment_status,
      payment_open_amount_cents,
      payment_paid_amount_cents,
      payment_currency,
      payment_method,
      payment_paid_at,
      payment_receipt_id,
      payment_event_id,
      payment_correlation_id::text,
      payment_version
    FROM public.invoices
    WHERE id = ${expected.invoiceId}::uuid
      AND tenant_id = ${expected.tenantId}
      AND order_id IS NOT DISTINCT FROM ${expected.orderId}
    LIMIT 2
  `);
  const row = rows[0];
  if (
    rows.length !== 1 || !row || row.id !== expected.invoiceId ||
    row.tenant_id !== expected.tenantId || row.order_id !== expected.orderId ||
    toSafeInteger(row.gross_amount_cents, "INVOICE_PAYMENT_GROSS_INVALID") !== expected.grossAmountCents ||
    toSafeInteger(row.payment_contract_version, "INVOICE_PAYMENT_CONTRACT_INVALID") !== PAYMENT_CONTRACT_VERSION ||
    row.payment_mode !== expected.paymentMode || row.payment_status !== "offen" ||
    toSafeInteger(row.payment_open_amount_cents, "INVOICE_PAYMENT_OPEN_INVALID") !== expected.grossAmountCents ||
    toSafeInteger(row.payment_paid_amount_cents, "INVOICE_PAYMENT_PAID_INVALID") !== 0 ||
    row.payment_currency !== "EUR" || row.payment_method !== null || row.payment_paid_at !== null ||
    row.payment_receipt_id !== null || row.payment_event_id !== null || row.payment_correlation_id !== null ||
    toSafeInteger(row.payment_version, "INVOICE_PAYMENT_VERSION_INVALID") !== 0
  ) {
    throw new Error("INVOICE_PAYMENT_INITIALIZATION_READBACK_INVALID");
  }
}

type ShippingMember={order_id:string;customer_id:string;shipment_id:string|null};
/** The one allocator, reused by invoice issuance, read proposals and locked group changes. */
async function readShippingInvoiceAllocation(tx:PrivilegedTenantTransaction,tenantId:string,customerId:string,members:ShippingMember[],sourceKey:string,readVat:InvoiceVatReader){
 const orderIds=[...new Set(members.map(member=>member.order_id))];
 if(!members.length||members.some(member=>member.customer_id!==customerId))throw Error('INVOICE_SHIPPING_GROUP_SOURCE_INVALID');
    const quoteOrders=await tx.execute<{order_id:string}>(sql`SELECT DISTINCT order_id FROM private.quote_conversion_receipts
      WHERE tenant_id=${tenantId} AND order_id IN (${sql.join(orderIds.map(value=>sql`${value}`),sql`,`)}) ORDER BY order_id`);
    let included=false;
    for(const member of quoteOrders){
      const commercial=await readOrderCommercialQuote(tx,tenantId,member.order_id);
      if(typeof commercial.shippingIncluded!=='boolean')throw Error('INVOICE_SHIPPING_QUOTE_SOURCE_MISSING');
      if(commercial.shippingIncluded)included=true;
    }
    // PL13Nov22:20: explicitly included in one awarded quote means the whole
    // actual shipment is included. Unknown source throws above, never false.
    const sourceKeys=new Set([sourceKey,...members.flatMap(member=>['order:'+member.order_id,...(member.shipment_id===null?[]:['shipment:'+member.shipment_id])])]);
    const originals=await tx.execute<LockedInvoice&{client_event_id:string;issued_by:string}>(sql`
      SELECT invoice.* FROM public.invoices invoice
      WHERE invoice.tenant_id=${tenantId} AND invoice.order_id IN (${sql.join(orderIds.map(value=>sql`${value}`),sql`,`)})
        AND invoice.status='issued' AND invoice.contract_version=1
      ORDER BY invoice.invoice_number`);
    const charged:Array<{invoiceNumber:string;orderNumber:string}>=[];
    for(const original of originals){
      if(original.tenant_id!==tenantId||!orderIds.includes(original.order_id)||!INVOICE_NUMBER_PATTERN.test(original.invoice_number)||!original.pdf_content||!HEX64_PATTERN.test(original.pdf_sha256)
        ||createHash('sha256').update(original.pdf_content).digest('hex')!==original.pdf_sha256)throw Error('INVOICE_SHIPPING_ORIGINAL_INVALID');
      const snapshot=parseStoredSnapshot(original.snapshot,original,readVat);
      const matching=snapshot.lines.filter(line=>line.type==='SHIPPING'&&sourceKeys.has(line.shipmentGroupId)&&shippingLineKind(line)==='fee');
      if(matching.length>1)throw Error('INVOICE_SHIPPING_ALLOCATION_AMBIGUOUS');
      if(matching.length===1){
        const receipts=await readCreateInvoiceReceipts(tx,original.client_event_id);
        if(receipts.length!==1)throw Error('INVOICE_SHIPPING_ORIGINAL_RECEIPT_MISSING');
        const receipt=mapInvoiceIssueReceipt(receipts[0],tenantId,original.issued_by,readVat);
        if(receipt.invoiceId!==original.id||receipt.invoiceNumber!==original.invoice_number)throw Error('INVOICE_SHIPPING_ORIGINAL_RECEIPT_INVALID');
        charged.push({invoiceNumber:receipt.invoiceNumber,orderNumber:snapshot.order.orderNumber});
      }
    }

 return {included,charged};
}

export async function readShippingMergeAllocation(tx:PrivilegedTenantTransaction,tenantId:string,customerId:string,input:{orderId:string;shipmentId:string;otherOrderId:string;otherShipmentId:string|null;sendungId:string},readVat:InvoiceVatReader){
 const group=await tx.execute<ShippingMember>(sql`SELECT shipment.order_id,orders.customer_id,shipment.id::text AS shipment_id
  FROM public.shipments shipment JOIN public.orders orders ON orders.tenant_id=shipment.tenant_id AND orders.id=shipment.order_id
  WHERE shipment.tenant_id=${tenantId} AND shipment.sendung_id=${input.sendungId}::uuid ORDER BY shipment.order_id,shipment.id`);
 const members=[...group,{order_id:input.orderId,customer_id:customerId,shipment_id:input.shipmentId},{order_id:input.otherOrderId,customer_id:customerId,shipment_id:input.otherShipmentId}];
 const result=await readShippingInvoiceAllocation(tx,tenantId,customerId,members,'sendung:'+input.sendungId,readVat);
 return {chargedOrderNumbers:[...new Set(result.charged.map(row=>row.orderNumber))]};
}

/** Shared lock order for standalone issuance and issuance composed with goods-out. */
/** Same customer lock as the shipment writer. Only issued, fully checked originals
 * allocate a fee; proposals and retries never reserve a second money truth. */
async function readShippingInvoiceLines(tx:PrivilegedTenantTransaction,tenantId:string,order:Pick<LockedOrder,'id'|'customer_id'>,amountCents:number|null,readVat:InvoiceVatReader){
  const shipments=await tx.execute<{id:string;sendung_id:string|null}>(sql`
    SELECT id::text,sendung_id::text FROM public.shipments
    WHERE tenant_id=${tenantId} AND order_id=${order.id} ORDER BY created_at,id`);
  const groups=new Map<string,{sendungId:string|null;shipmentId:string|null}>();
  if(shipments.length===0)groups.set('order:'+order.id,{sendungId:null,shipmentId:null});
  for(const shipment of shipments){
    const key=shipment.sendung_id===null?'shipment:'+shipment.id:'sendung:'+shipment.sendung_id;
    if(!groups.has(key))groups.set(key,{sendungId:shipment.sendung_id,shipmentId:shipment.id});
  }
  const lines:Array<{shipmentGroupId:string;amountCents:number;name:string;shippingKind:'fee'|'reference'}>=[];
  let missingFee=false;
  for(const [groupKey,group] of groups){
    const members=group.sendungId===null
      ?[{order_id:order.id,customer_id:order.customer_id,shipment_id:group.shipmentId}]
      :await tx.execute<{order_id:string;customer_id:string;shipment_id:string}>(sql`
        SELECT shipment.order_id,orders.customer_id,shipment.id::text AS shipment_id
        FROM public.shipments shipment JOIN public.orders orders
          ON orders.tenant_id=shipment.tenant_id AND orders.id=shipment.order_id
        WHERE shipment.tenant_id=${tenantId} AND shipment.sendung_id=${group.sendungId}::uuid
        ORDER BY shipment.order_id,shipment.id`);
    if(members.length===0||members.some(member=>member.customer_id!==order.customer_id)||!members.some(member=>member.order_id===order.id))throw Error('INVOICE_SHIPPING_GROUP_SOURCE_INVALID');
    const {included,charged}=await readShippingInvoiceAllocation(tx,tenantId,order.customer_id,members,groupKey,readVat);
    if(included)continue;
    if(charged.length>1)throw Error('INVOICE_SHIPPING_ALLOCATION_AMBIGUOUS');
    if(charged.length===1)lines.push({shipmentGroupId:groupKey,amountCents:0,name:SHIPPING_FEE_COPY.inInvoice(charged[0].invoiceNumber),shippingKind:'reference'});
    else if(amountCents!==null)lines.push({shipmentGroupId:groupKey,amountCents,name:SHIPPING_FEE_COPY.line,shippingKind:'fee'});
    else missingFee=true; // Qualified, neither included nor already charged.
  }
  return {lines,missingFee};
}

function shippingLineKind(line:ImmutableInvoiceShippingLine){
 if(line.shippingKind)return line.shippingKind;
 // Historic positive money is a charge. Zero without a semantic source is unknown.
 if(line.amountCents>0)return 'fee';
 throw Error('INVOICE_SHIPPING_KIND_SOURCE_MISSING');
}

function shippingLinesForScope<T extends {shipmentGroupId:string}>(lines:T[],scope:string){
 return lines.filter(line=>scope.startsWith('sendung:')?line.shipmentGroupId===scope:!line.shipmentGroupId.startsWith('sendung:'));
}

/** One source predicate for both the proposal and the locked cancellation. */
function manualHandoverAllowsReissue(manual:Awaited<ReturnType<typeof readInvoiceHandoverSource>>,orderId:string,snapshot:ImmutableInvoiceSnapshot){
 return manual.order_id===orderId&&manual.current_order_version===manual.order_version&&manual.current_handover_mode==='pickup'
  &&manual.payload.receipt.outcome==='changed'&&manual.payload.receipt.handoverMode==='pickup'
  &&snapshot.schemaVersion!==1&&snapshot.lines.some(line=>line.type==='SHIPPING')&&snapshot.lines.some(line=>line.type!=='SHIPPING');
}
type InvoiceReissueProposal={originalInvoiceNumber:string;label:string;befehl:{datei:'src/app/actions/invoices.actions.ts';funktion:'cancelInvoiceAction';
 argumente:Omit<CancelInvoiceInput,'clientEventId'|'reissueWithoutShipping'>&{reissueWithoutShipping:{handoverEventId:string}}}};

/** N2 read projection only: same fee allocator and qualified original receipts
 * as issuance. No number, reservation, new click key or financial effect on read. */
type ShippingProposalInput={orderId:string;expectedVersion:number;manualHandoverEventId?:string};
type ShippingProposalSettingsReader=(tx:PrivilegedTenantTransaction,tenantId:string)=>Promise<{shippingFeeCents?:number|null}|null>;
type ShippingProposalOrder=Pick<LockedOrder,'id'|'customer_id'|'handover_mode'|'version'>&{order_number:string;station:string;current_station:string;current_station_id:string;status:string;invoice_exists:boolean;freeze_active:boolean;freeze_invalid:boolean};
type ShippingProposalReadGroup<T>={code:'OK';rows:T[]}|{code:'FAILED';cause:unknown};
type ShippingProposalHeader=ShippingProposalReadGroup<ShippingProposalOrder>;
async function readInvoiceShippingHeaders(tx:PrivilegedTenantTransaction,auth:Pick<AuthorizationSnapshot,'tenantId'>,orderIds:readonly string[]){
 return tx.execute<ShippingProposalOrder>(sql`SELECT * FROM private.read_invoice_shipping_headers_v1(${auth.tenantId},ARRAY[${sql.join(orderIds.map(value=>sql`${value}`),sql`, `)}]::text[])`);
}
function qualifyShippingProposalOrder(rows:readonly ShippingProposalOrder[],input:ShippingProposalInput,identity:{orderNumber?:string}){
 try{
  const order=rows[0];
  if(rows.length!==1||!order||order.version!==input.expectedVersion||!['pickup','shipping'].includes(order.handover_mode??''))throw Error('SHIPPING_PROPOSAL_ORDER_SOURCE_INVALID');
  identity.orderNumber=order.order_number;
  if(order.station!==order.current_station||order.station!==order.current_station_id||typeof order.invoice_exists!=='boolean'||typeof order.freeze_active!=='boolean'||typeof order.freeze_invalid!=='boolean')throw Error('SHIPPING_PROPOSAL_ORDER_SOURCE_INVALID');
  if(order.freeze_invalid)throw Error('SHIPPING_PROPOSAL_FREEZE_SOURCE_INVALID');
  // PL20.11.13:42: a proved unfinished order has no invoice follow-up yet.
  // Its absence is a named state, never an invented zero/empty proposal.
  if(['angenommen','galvanik'].includes(order.station)&&order.status===order.station&&!order.invoice_exists&&!order.freeze_active)
   return {kind:'NOT_APPLICABLE' as const,value:{code:'NOT_APPLICABLE' as const,orderId:order.id,orderVersion:order.version}};
  return {kind:'PROCEED' as const,order};
 }catch(cause){return {kind:'FAILED' as const,cause};}
}
/** Same canonical proposal reader; batch only its repeated source header.
 * Failed groups are isolated after their native transaction has rolled back. */
async function readShippingProposalGroups<T>(auth:Pick<AuthorizationSnapshot,'tenantId'>,orderIds:readonly string[],readRows:(tx:PrivilegedTenantTransaction,ids:readonly string[])=>Promise<readonly {id:string;row:T}[]>){
 const groups=new Map<string,ShippingProposalReadGroup<T>>();
 const load=async(ids:readonly string[]):Promise<void>=>{
  if(!ids.length)return;
  try{
   const rows=await withPrivilegedTenantTransaction(auth,tx=>withTenantSavepoint(tx,nested=>readRows(nested,ids)));
   for(const id of ids)groups.set(id,{code:'OK',rows:rows.filter(row=>row.id===id).map(row=>row.row)});
  }catch(cause){
   if(ids.length===1){groups.set(ids[0],{code:'FAILED',cause});return;}
   const middle=Math.ceil(ids.length/2);await Promise.all([load(ids.slice(0,middle)),load(ids.slice(middle))]);
  }
 };
 await load([...new Set(orderIds)]);return groups;
}
export async function readInvoiceShippingConsequencesBatch(auth:AuthorizationSnapshot|AuthorizedReadContext,inputs:readonly ShippingProposalInput[],readVat:InvoiceVatReader,readSettings:ShippingProposalSettingsReader){
 const readAuth='canReadArea'in auth?auth:authorizationReadContext(auth);
 const permitted=readAuth.canReadArea('preise');
 const headers=permitted?await readShippingProposalGroups(auth,inputs.map(input=>input.orderId),async(tx,ids)=>(await readInvoiceShippingHeaders(tx,auth,ids)).map(row=>({id:row.id,row}))):new Map<string,ShippingProposalHeader>();
 // This is the same canonical early gate used by the single reader. Missing,
 // invalid and not-applicable orders retain their original result in the worker.
 const sourceIds=inputs.flatMap(input=>{const header=headers.get(input.orderId);return header?.code==='OK'&&qualifyShippingProposalOrder(header.rows,input,{}).kind==='PROCEED'?[input.orderId]:[];});
 const sources=await readShippingProposalGroups(auth,sourceIds,readInvoiceIssueSourceRows);
 const readSource=async(orderId:string)=>{const source=sources.get(orderId);if(!source)throw Error('SHIPPING_PROPOSAL_INVOICE_SOURCE_MISSING');if(source.code==='FAILED')throw source.cause;return source.rows;};
 type Value=Awaited<ReturnType<typeof readInvoiceShippingConsequencesWithHeader>>;
 const values:Array<Value>=new Array(inputs.length),seen=new Set<number>();
 const load=async(indices:number[]):Promise<void>=>{
  if(!indices.length)return;
  try{
   await withPrivilegedTenantTransaction(auth,async tx=>{
    const groupSourceIds=[...new Set(indices.map(index=>inputs[index].orderId).filter(id=>sourceIds.includes(id)))];
    const settings=groupSourceIds.length?{value:await readSettings(tx,auth.tenantId)}:undefined;
    const originals=await readCreateInvoiceReceiptsMany(tx,groupSourceIds);
    for(const index of indices){const input=inputs[index];
     values[index]=await readInvoiceShippingConsequencesWithHeader(auth,input,readVat,readSettings,headers.get(input.orderId),readSource,{tx,settings,originals:originals.get(input.orderId)});seen.add(index);
    }
   });
  }catch{
   // The failed parent has completed its rollback before any child transaction.
   if(indices.length===1){const index=indices[0],input=inputs[index];values[index]=await readInvoiceShippingConsequencesWithHeader(auth,input,readVat,readSettings,headers.get(input.orderId),readSource);seen.add(index);return;}
   const half=Math.ceil(indices.length/2);await load(indices.slice(0,half));await load(indices.slice(half));
  }
 };
 if(permitted)await load(inputs.map((_,index)=>index));else for(let index=0;index<inputs.length;index++){values[index]=undefined;seen.add(index);}
 return new Map(inputs.map((input,index)=>{if(!seen.has(index))throw Error('SHIPPING_PROPOSAL_INVOICE_SOURCE_MISSING');return [input.orderId,values[index]];}));
}

export async function readInvoiceShippingConsequences(auth:AuthorizationSnapshot|AuthorizedReadContext,input:ShippingProposalInput,readVat:InvoiceVatReader,readSettings:ShippingProposalSettingsReader){
 return readInvoiceShippingConsequencesWithHeader(auth,input,readVat,readSettings);
}
async function readInvoiceShippingConsequencesWithHeader(auth:AuthorizationSnapshot|AuthorizedReadContext,input:ShippingProposalInput,readVat:InvoiceVatReader,readSettings:ShippingProposalSettingsReader,header?:ShippingProposalHeader,readSource?:(orderId:string)=>Promise<SourceRow[]>,shared?:{tx:PrivilegedTenantTransaction;settings?:{value:Awaited<ReturnType<ShippingProposalSettingsReader>>};originals?:ReceiptRow[]}){
 const readAuth='canReadArea'in auth?auth:authorizationReadContext(auth);
 if(!readAuth.canReadArea('preise'))return undefined;
 const identity:{orderNumber?:string;invoiceNumber?:string}={};
 try{const work=async(tx:PrivilegedTenantTransaction)=>{
  if(header?.code==='FAILED')throw header.cause;
  const rows=header?.code==='OK'?header.rows:await readInvoiceShippingHeaders(tx,auth,[input.orderId]);
  const qualified=qualifyShippingProposalOrder(rows,input,identity);
  if(qualified.kind==='FAILED')throw qualified.cause;
  if(qualified.kind==='NOT_APPLICABLE')return qualified.value;
  const order=qualified.order;
  const settings=shared?shared.settings?.value:await readSettings(tx,auth.tenantId);
  if(!settings||settings.shippingFeeCents===undefined)throw Error('SHIPPING_PROPOSAL_SETTINGS_SOURCE_MISSING');
  const allocation=order.handover_mode==='shipping'?await readShippingInvoiceLines(tx,auth.tenantId,order,settings.shippingFeeCents,readVat):{lines:[],missingFee:false};
  const lines=allocation.lines;
  const originals=shared?shared.originals:await readCreateInvoiceReceipts(tx,{orderId:order.id});
  if(originals===undefined)throw Error('SHIPPING_PROPOSAL_ORIGINAL_AMBIGUOUS');
  // Validate historical originals as well; a broken receipt is never silently
  // treated as absence of an issued invoice.
  const active=originals.map(row=>({row,receipt:mapInvoiceIssueReceipt(row,auth.tenantId,row.actor_id,readVat)})).filter(value=>value.row.current_status==='issued');
  const main=active.filter(value=>value.row.belegart==='auftrag');
  if(main.length===1)identity.invoiceNumber=main[0].receipt.invoiceNumber;
  const sourceRows=readSource?await readSource(order.id):await readInvoiceIssueSource(tx,order.id),source=sourceRows[0];
  if(sourceRows.length===0)throw Error('SHIPPING_PROPOSAL_INVOICE_SOURCE_MISSING');
  if(sourceRows.length!==1||!source||source.tenant_id!==auth.tenantId||source.order_id!==order.id||source.customer_id!==order.customer_id||source.current_order_version!==order.version||typeof source.no_active_invoice!=='boolean')throw Error('SHIPPING_PROPOSAL_INVOICE_SOURCE_INVALID');
  if(main.length>1||active.length>0&&main.length!==1||source.no_active_invoice!==(main.length===0))throw Error('SHIPPING_PROPOSAL_ORIGINAL_AMBIGUOUS');
  const additionalInvoices:Array<{originalInvoiceNumber:string;label:string;befehl:{datei:'src/app/actions/invoices.actions.ts';funktion:'issueInvoiceAction';argumente:Omit<CreateInvoiceInput,'clientEventId'>}}>=[];
  let reissueWithoutShipping:InvoiceReissueProposal|null=null;
  const datenluecken:string[]=[];
  if(main.length===1){
   const parent=main[0],snapshot=parseStoredSnapshot(parent.row.snapshot,parent.row,readVat);
   if(order.handover_mode==='pickup'&&snapshot.schemaVersion!==1&&snapshot.lines.some(line=>line.type==='SHIPPING')){
    try{
     if(!input.manualHandoverEventId)throw Error('SHIPPING_PROPOSAL_MANUAL_HANDOVER_MISSING');
     const manual=await withTenantSavepoint(tx,nested=>readInvoiceHandoverSource(nested,auth.tenantId,input.manualHandoverEventId!));
     if(!manualHandoverAllowsReissue(manual,order.id,snapshot)||manual.current_order_version!==order.version)throw Error('SHIPPING_PROPOSAL_MANUAL_HANDOVER_STALE');
     reissueWithoutShipping={originalInvoiceNumber:parent.receipt.invoiceNumber,label:SHIPPING_FEE_COPY.reissue(parent.receipt.invoiceNumber),
      befehl:{datei:'src/app/actions/invoices.actions.ts',funktion:'cancelInvoiceAction',argumente:{invoiceId:parent.receipt.invoiceId,expectedVersion:parent.row.current_version,reason:SHIPPING_FEE_COPY.reissueReason,reissueWithoutShipping:{handoverEventId:manual.event_id}}}};
    }catch(error){console.error('[INVOICE_REISSUE_PROPOSAL_SOURCE_INCOMPLETE]',error instanceof Error?error.message:'UnknownError');datenluecken.push('MANUAL_HANDOVER_SOURCE');}
   }
   const scopes=[...new Set(lines.map(line=>line.shipmentGroupId.startsWith('sendung:')?line.shipmentGroupId:'order:'+order.id))];
   for(const scope of scopes){
    const selected=shippingLinesForScope(lines,scope);if(!selected.some(line=>line.shippingKind==='fee'))continue;
    const amount=selected.reduce((sum,line)=>sum+line.amountCents,0);
    if(!Number.isSafeInteger(amount)||amount<0)throw Error('SHIPPING_PROPOSAL_AMOUNT_INVALID');
    if(amount===0)continue;
    // Customer display is already part of the immutable qualified invoice, not
    // a second lookup or a client-provided invoice/customer association.
    additionalInvoices.push({originalInvoiceNumber:parent.receipt.invoiceNumber,label:SHIPPING_FEE_COPY.additional(formatShippingFee(amount),snapshot.customer.name),
     befehl:{datei:'src/app/actions/invoices.actions.ts',funktion:'issueInvoiceAction',argumente:{orderId:order.id,expectedVersion:order.version,shippingCosts:{invoiceId:parent.receipt.invoiceId,expectedVersion:parent.row.current_version,scope,expectedFeeCents:amount}}}});
   }
  }
  return {code:'OK' as const,orderId:order.id,orderVersion:order.version,shippingCostMissing:allocation.missingFee,feeCents:settings.shippingFeeCents,lines,additionalInvoices,reissueWithoutShipping,...(datenluecken.length?{datenluecken}:{}),...(settings.shippingFeeCents===null?{hintKey:'versand.pauschale_fehlt' as const}: {})};
 };return shared?await withTenantSavepoint(shared.tx,work):await withPrivilegedTenantTransaction(auth,work);}catch(error){
  const reason=error instanceof Error?error.message:'UnknownError';
  reportOrderSourceIssue('[INVOICE_SHIPPING_PROPOSAL_FAILED]',input.orderId,reason);
  return {code:'SOURCE_INCOMPLETE' as const,orderId:input.orderId,orderVersion:input.expectedVersion,datenluecken:['SHIPPING_INVOICE_SOURCE'],...(identity.orderNumber?{message:SHIPPING_FEE_COPY.proposalMissing(identity.invoiceNumber??identity.orderNumber,identity.invoiceNumber!==undefined,reason==='SHIPPING_PROPOSAL_INVOICE_SOURCE_MISSING'?'freigabe':reason==='SHIPPING_PROPOSAL_SETTINGS_SOURCE_MISSING'?'einstellungen':reason==='SHIPPING_PROPOSAL_ORIGINAL_AMBIGUOUS'?'original':'quelle')}:{})};
 }
}
function formatShippingFee(cents:number){return new Intl.NumberFormat('de-DE',{minimumFractionDigits:2,maximumFractionDigits:2}).format(cents/100)+' €';}

export async function lockInvoiceCreation(tx:PrivilegedTenantTransaction,tenantId:string,input:{clientEventId:string;orderId:string}):Promise<string|null>{
  await tx.execute(sql`SELECT pg_advisory_xact_lock(hashtextextended('f1:invoice:client-event:' || ${tenantId} || ':' || ${input.clientEventId}, 0))`);
  const selected=await tx.execute<{customer_id:string}>(sql`SELECT customer_id,private.lock_shipping_customer_v1(${tenantId},customer_id) FROM public.orders WHERE tenant_id=${tenantId} AND id=${input.orderId}`);
  await tx.execute(sql`SELECT pg_advisory_xact_lock(hashtextextended('f1:invoice:order:' || ${tenantId} || ':' || ${input.orderId}, 0))`);
  return selected.length===1?selected[0].customer_id:null;
}

export async function createInvoice(input: unknown, existingTransaction?:PrivilegedTenantTransaction,readVat?:InvoiceVatReader,readShippingSettings?:(tx:PrivilegedTenantTransaction,tenantId:string)=>Promise<{shippingFeeCents?:number|null}|null>,readOriginal?:InvoiceOriginalReader,readCustomerTerms?:InvoiceCustomerTermsReader,readMaterial?:InvoiceMaterialReader,scrapPorts?:InvoiceScrapPorts): Promise<CreateInvoiceResult> {
  if (!isValidInput(input)) {
    const zeroShippingFee=plainObject(input)&&plainObject(input.shippingCosts)&&input.shippingCosts.expectedFeeCents===0;
    return { code: "VALIDATION_ERROR", message: zeroShippingFee?SHIPPING_FEE_COPY.noAdditionalInvoiceNeeded:"Ungültige Rechnungsanfrage." };
  }

  let authorization;
  try {
    authorization = await resolveAuthorization();
  } catch {
    return { code: "UNAVAILABLE", message: "Rechnung konnte nicht sicher ausgestellt werden." };
  }
  if (!authorization.ok) {
    return authorization.reason === "AUTHORIZATION_UNAVAILABLE"
      ? { code: "UNAVAILABLE", message: "Rechnung konnte nicht sicher ausgestellt werden." }
      : { code: "UNAUTHENTICATED", message: "Sitzung oder Berechtigung ist nicht verfügbar." };
  }
  const agreementDelegation = input.agreement !== undefined
    && hasAuthorizationArea(authorization.data, "auftraege");
  if (!hasAuthorizationArea(authorization.data, "preise") && !agreementDelegation) {
    return { code: "FORBIDDEN", message: FINANCIAL_ACCESS_COPY.pricesMissing };
  }

  const tenantId = authorization.data.tenantId;
  const actorId = authorization.data.userId;

  try {
    const write=async(tx:PrivilegedTenantTransaction):Promise<CreateInvoiceResult>=>{
      const lockedCustomerId=await lockInvoiceCreation(tx,tenantId,input);

      const replayRows = await readCreateInvoiceReceipts(tx, input.clientEventId);
      if (replayRows.length > 0) {
        if (replayRows.length !== 1 || !replayRows[0]) {
          return { code: "CONFLICT", message: "Anfragekennung wurde bereits anders verwendet." };
        }
        // Validate the complete persisted original before comparing the caller.
        // A valid receipt owned by another actor is a key conflict, not an outage;
        // damaged receipts still fail the unchanged integrity validator.
        const receipt = mapInvoiceIssueReceipt(replayRows[0], tenantId, replayRows[0].actor_id,requireVatReader(readVat));
        return receipt.issuedBy === actorId && receiptMatchesIntent(receipt, input,replayRows[0])
          ? { code: "OK", receipt, replayed: true }
          : { code: "CONFLICT", message: "Anfragekennung wurde bereits anders verwendet." };
      }

      const reusedEvents = await tx.execute<{ id: string }>(sql`
        SELECT id
        FROM public.events
        WHERE tenant_id = ${tenantId}
          AND client_event_id = ${input.clientEventId}
        LIMIT 1
      `);
      if (reusedEvents.length > 0) {
        return { code: "CONFLICT", message: "Anfragekennung wurde bereits anders verwendet." };
      }

      const orderRows = await tx.execute<LockedOrder>(sql`
        SELECT
          id, tenant_id, customer_id, station, status, version,
          payment_mode, payment_mode_version,handover_mode
        FROM public.orders
        WHERE id = ${input.orderId}
          AND tenant_id = ${tenantId}
        FOR UPDATE
      `);
      const order = orderRows[0];
      if (orderRows.length !== 1 || !order) {
        return { code: "NOT_FOUND", message: "Auftrag nicht verfügbar." };
      }
      if(order.customer_id!==lockedCustomerId)return {code:'CONFLICT',message:SHIPPING_FEE_COPY.changed};
      if (order.version !== input.expectedVersion) {
        return { code: "CONFLICT", message: "Auftrag wurde bereits geändert." };
      }
      if (
        !isPaymentMode(order.payment_mode) || !Number.isSafeInteger(order.payment_mode_version) ||
        order.payment_mode_version < 0
      ) {
        return { code: "VALIDATION_ERROR", message: "Zahlungsmodus des Auftrags ist nicht verfügbar." };
      }
      if(!readCustomerTerms)throw Error('INVOICE_CUSTOMER_TERMS_PORT_MISSING');
      // A malformed buyer field must keep its original actionable E-invoice
      // error. Resolve the same locked terms only after that shared validator.
      const customerInvoiceTerms=()=>readCustomerTerms(tx,tenantId,order.customer_id);
      // S38a E3/A6: the already locked order serializes membership with the
      // existing collection writer. A collection is never a single invoice.
      const membership=await tx.execute<{id:string;status:string;month:string}>(sql`
        SELECT collection.id::text,collection.status,to_char(collection.monat,'YYYY-MM-DD') AS month FROM public.invoice_collection_orders member
        JOIN public.invoice_collections collection ON collection.tenant_id=member.tenant_id AND collection.id=member.collection_id
        WHERE member.tenant_id=${tenantId} AND member.order_id=${order.id}
        FOR SHARE OF collection,member`);
      if(membership.length>1)throw Error('INVOICE_COLLECTION_MEMBERSHIP_INVALID');
      if(membership.length===1){
        if(!['offen','abgerechnet'].includes(membership[0].status))throw Error('INVOICE_COLLECTION_SOURCE_INVALID');
        const month=new Intl.DateTimeFormat('de-DE',{month:'long',year:'numeric',timeZone:'Europe/Berlin'}).format(new Date(toDateOnly(membership[0].month)+'T12:00:00Z'));
        return {code:'ORDER_IN_COLLECTION',message:E_INVOICE_COPY.orderInCollection(month,(await customerInvoiceTerms()).customerShortName)};
      }
      // Customer master data above is stable before agreement/source reads.
      const agreementLevels = await readEffectiveCustomerAgreement(tx, {
            tenantId,
            customerId: order.customer_id,
            orderId: order.id,
            invoiceTerms: true,
            lock: true,
          });
      const agreement = agreementLevels.order ?? agreementLevels.customer;
      if (
        input.agreement !== undefined
        && (
          agreement === null
          || agreement.id !== input.agreement.id
          || agreement.version !== input.agreement.version
          || agreement.type !== input.agreement.type
        )
      ) {
        return { code: "VALIDATION_ERROR", message: "Zahlung fehlt." };
      }
      const afterGoodsOut = order.station === "abgeholt" && order.status === "abgeholt";
      if (
        (order.station !== STATION || order.status !== STATION)
        && !(afterGoodsOut && order.payment_mode === "rechnung")
      ) {
        return { code: "VALIDATION_ERROR", message: "Nur ein fertiggestellter Auftrag kann in Rechnung gestellt werden." };
      }

      // service_date arrives Berlin-normalised from the read port. The command
      // never derives a calendar day from the database session time zone.
      const sourceRows = await readInvoiceIssueSource(tx,order.id);
      const source = sourceRows[0];
      if (sourceRows.length !== 1 || !source) {
        return { code: "NOT_FOUND", message: "Rechnungsgrundlage nicht verfügbar." };
      }
      if (
        source.tenant_id !== tenantId
        || source.order_id !== order.id
        || source.customer_id !== order.customer_id
        || source.current_order_version !== order.version
      ) throw new Error("INVOICE_SOURCE_INTEGRITY_INVALID");

      if (!source.no_active_invoice && input.shippingCosts===undefined) {
        return { code: "CONFLICT", message: "Für diesen Auftrag besteht bereits eine aktive Rechnung." };
      }
      // The additional document references a fully qualified released original;
      // it never changes or rebinds that document's goods prices.
      let originalInvoiceNumber:string|undefined;
      if(input.shippingCosts){
        const originals=await tx.execute<LockedInvoice&{client_event_id:string;issued_by:string;belegart:string}>(sql`
          SELECT * FROM public.invoices WHERE tenant_id=${tenantId} AND id=${input.shippingCosts.invoiceId}::uuid
            AND contract_version=1 FOR UPDATE`);
        const original=originals[0];
        if(originals.length!==1||!original||original.order_id!==order.id||original.belegart!=='auftrag'
          ||original.status!=='issued'||original.aggregate_version!==input.shippingCosts.expectedVersion){
          return {code:'CONFLICT',message:SHIPPING_FEE_COPY.changed};
        }
        if(!original.pdf_content||createHash('sha256').update(original.pdf_content).digest('hex')!==original.pdf_sha256)throw Error('INVOICE_SHIPPING_ORIGIN_PDF_INVALID');
        parseStoredSnapshot(original.snapshot,original,requireVatReader(readVat));
        const receipts=await readCreateInvoiceReceipts(tx,original.client_event_id);
        if(receipts.length!==1)throw Error('INVOICE_SHIPPING_ORIGIN_RECEIPT_MISSING');
        const originalReceipt=mapInvoiceIssueReceipt(receipts[0],tenantId,original.issued_by,requireVatReader(readVat));
        if(originalReceipt.invoiceId!==original.id)throw Error('INVOICE_SHIPPING_ORIGIN_RECEIPT_INVALID');
        originalInvoiceNumber=originalReceipt.invoiceNumber;
      }
      const prepared=await prepareQualifiedInvoiceContent(tx,authorization.data,input,order,source,afterGoodsOut,agreement,customerInvoiceTerms,requireVatReader(readVat),readShippingSettings,false,[agreementLevels.order,agreementLevels.customer],
        () => readInvoiceExtraWork(tx, authorization.data, [order.id], scrapPorts));
      if(prepared.code!=='PREPARED')return prepared;
      const {frozenInvoiceTerms,paymentTermDays}=prepared;
      let content = prepared.content;
      if (!input.shippingCosts) {
        const reports = await readInvoiceScrap(tx, authorization.data, [order.id], scrapPorts);
        const afterScrap = await applyInvoiceScrapWithinTransaction(tx, authorization.data, content, reports.get(order.id), scrapPorts);
        // Returning commits the existing task while leaving the invoice number untouched.
        if ('code' in afterScrap) return afterScrap;
        content = appendInvoiceMaterial(afterScrap, await readInvoiceMaterial(tx, authorization.data, [order.id], readMaterial), source.invoice_vat_rate_basis_points);
      }
      return persistPreparedInvoice(tx,authorization.data,input,order,content,{paymentTermDays,frozenInvoiceTerms,serviceDate:source.service_date,freezeId:source.freeze_id,afterGoodsOut,originalInvoiceNumber},requireVatReader(readVat),readOriginal);
    };
    return existingTransaction ? await write(existingTransaction) : await withPrivilegedTenantTransaction(authorization.data,write);
  } catch (error) {
    if (error instanceof InvoiceMaterialPriceError) return error.result();
    if (error instanceof InvoiceScrapError) return {code:'VALIDATION_ERROR',message:error.message};
    if (error instanceof InvoiceMaterialUnitError) return invoiceMaterialUnitFailure(error);
    if(error instanceof InvoiceElectronicSourceError)return {code:'VALIDATION_ERROR',message:E_INVOICE_COPY.missingSource(error.location.field),source:error.location.kind==='order'?{...error.location,objectId:input.orderId,orderVersion:input.expectedVersion}:error.location};
    if(error instanceof InvoiceGlyphError){
      const source:import('@/lib/domain/invoiceElectronicFields').InvoiceElectronicSourceLocation=error.field.startsWith('seller.')?{kind:'settings',field:error.field.slice(7),codePoint:error.codePoint}:error.field.startsWith('customer.')?{kind:'customer',field:error.field.slice(9),codePoint:error.codePoint}:{kind:'order',objectId:input.orderId,orderVersion:input.expectedVersion,field:error.field,codePoint:error.codePoint};
      const correctionArea=source.kind==='settings'?'einstellungen':source.kind==='customer'?'kunden':'auftraege';
      if(!hasAuthorizationArea(authorization.data,correctionArea)){
        try{
          const read=async(tx:PrivilegedTenantTransaction)=>readActiveAreaHolders(tx,authorization.data.tenantId,correctionArea);
          const holders=existingTransaction?await withTenantSavepoint(existingTransaction,read):await withPrivilegedTenantTransaction(authorization.data,read);
          const roles=[...new Set(holders.map(holder=>getRoleLabel(holder.role)))];
          return {code:'VALIDATION_ERROR',message:E_INVOICE_COPY.correctionWithoutRight(error.field,roles)};
        }catch{
          return {code:'VALIDATION_ERROR',message:E_INVOICE_COPY.correctionRolesUnavailable(error.field)};
        }
      }
      return {code:'VALIDATION_ERROR',message:E_INVOICE_COPY.missingGlyph(error.field,error.codePoint),source};
    }
    const cause = error && typeof error === "object" && "cause" in error
      ? (error as { cause?: { code?: unknown; constraint_name?: unknown } }).cause
      : undefined;
    console.error("INVOICE_CREATE_UNAVAILABLE", {
      errorName: error instanceof Error ? error.name : "UnknownError",
      electronicCode:error instanceof Error&&/^INVOICE_ELECTRONIC_[A-Z0-9_]+$/.test(error.message)?error.message:null,
      databaseCode: typeof cause?.code === "string" ? cause.code : null,
      constraint: typeof cause?.constraint_name === "string" ? cause.constraint_name : null,
    });
    return { code: "UNAVAILABLE", message: "Rechnung konnte nicht sicher ausgestellt werden." };
  }
}

type InvoiceCustomerTermsReader=(tx:PrivilegedTenantTransaction,tenantId:string,customerId:string)=>Promise<Parameters<typeof resolveInvoicePaymentTerms>[1]&{customerShortName:string}>;
type InvoiceShippingSettingsReader=(tx:PrivilegedTenantTransaction,tenantId:string)=>Promise<{shippingFeeCents?:number|null}|null>;
/** One existing per-order commercial preparation for individual and collection originals.
 * No item repricing, duplicated tax calculation, sender or number allocation. */
async function prepareQualifiedInvoiceContent(tx:PrivilegedTenantTransaction,auth:AuthorizationSnapshot,input:CreateInvoiceInput,order:LockedOrder,source:SourceRow,afterGoodsOut:boolean,agreement:Awaited<ReturnType<typeof readEffectiveCustomerAgreement>>,customerInvoiceTerms:Parameters<typeof resolveInvoicePaymentTerms>[1]|(()=>Promise<Parameters<typeof resolveInvoicePaymentTerms>[1]>),readVat:InvoiceVatReader,readShippingSettings:InvoiceShippingSettingsReader|undefined,collectionSource=false,paymentAgreements?:Parameters<typeof resolveInvoicePaymentTerms>[2],readExtraWork?:()=>ReturnType<typeof readInvoiceExtraWork>):Promise<Exclude<CreateInvoiceResult,{code:'OK'}>|{code:'PREPARED';content:PreparedInvoiceContent;frozenInvoiceTerms:InvoicePaymentTerms;paymentTermDays:number}>{
 const tenantId=auth.tenantId;
      const commercial=source.has_quote&&input.shippingCosts===undefined?await readOrderCommercialQuote(tx,tenantId,order.id):null;
      if(commercial){
        if(!Array.isArray(source.base_lines)||source.base_lines.some(line=>!plainObject(line)||typeof line.itemId!=='string'))throw Error('INVOICE_QUOTE_BASE_SOURCE_INVALID');
        const awardedItems=new Set(commercial.positions.map(row=>row.itemId));
        // A07-12/14: additional parts keep the ordinary invoice source. Only
        // the actually awarded items are replaced by the canonical KV terms.
        const additional=source.base_lines.filter(line=>!awardedItems.has(line.itemId));
        const additionalTotal=additional.some(line=>line.unitNetAmountCents===null||line.lineNetAmountCents===null)
          ? null : additional.reduce((sum,line)=>sum+toSafeInteger(line.lineNetAmountCents,'INVOICE_BASE_LINE_TOTAL_INVALID'),0);
        source.base_lines=[...commercial.positions.map(row=>{
          const quantity=row.quantity;
          return {itemId:row.itemId,name:row.name,unit:row.unit??null,quantity,unitNetAmountCents:Number((BigInt(row.lineTotalCents)+BigInt(quantity)/BigInt(2))/BigInt(quantity)),lineNetAmountCents:row.lineTotalCents,vat_rate_basis_points:row.vatRateBasisPoints??commercial.vatRateBasisPoints};
        }),...additional];
        if(!Array.isArray(source.extra_work_lines))throw Error('INVOICE_QUOTE_EXTRA_WORK_SOURCE_INVALID');
        source.extra_work_lines=source.extra_work_lines.map(line=>{
          if(!plainObject(line)||typeof line.itemId!=='string')throw Error('INVOICE_QUOTE_EXTRA_WORK_SOURCE_INVALID');
          const positions=commercial.positions.filter(position=>position.itemId===line.itemId);
          return {...line,vat_rate_basis_points:positions.length===1?(positions[0].vatRateBasisPoints??commercial.vatRateBasisPoints??null):line.vat_rate_basis_points};
        });
        // The existing canonical awarded-quote port proves these prices; no price is copied into an intake intent.
        source.base_line_count=commercial.positions.length+additional.length;
        if(additionalTotal!==null)source.base_net_amount_cents=commercial.totalNetCents+additionalTotal;
        source.base_prices_complete=additionalTotal!==null&&source.base_line_count>0&&commercial.positions.every(row=>Number.isSafeInteger(row.lineTotalCents)&&row.lineTotalCents>=0);
      }
      if(commercial||input.shippingCosts||collectionSource){
        // Recompose the existing structural guards with the canonical quote price proof.
        // The legacy SQL projection includes item prices in integrity_ok, which are
        // deliberately absent for a quote-backed intake. No structural guard is waived.
        const proofs=await tx.execute<{frozen:boolean;handed_over:boolean}>(sql`
          SELECT count(*)=1 AND bool_and(frozen_state.active AND frozen_state.integrity_ok AND frozen_state.freeze_id=${source.freeze_id}::uuid) AS frozen,
            (SELECT count(*)=1 AND bool_and(receipt.integrity_ok AND receipt.goods_out_event_id IS NOT NULL) FROM private.v_goods_out_ui_state_v1 receipt WHERE receipt.tenant_id=${tenantId} AND receipt.order_id=${order.id} AND receipt.order_version=${order.version}) AS handed_over
          FROM private.v_order_freeze_state_v1 frozen_state WHERE frozen_state.tenant_id=${tenantId} AND frozen_state.order_id=${order.id}
        `);
        const structural=proofs.length===1&&proofs[0].frozen===true&&source.seller_config_complete&&source.customer_config_complete
          &&(input.shippingCosts!==undefined||source.base_prices_complete);
        source.post_goods_out_invoice_eligible=structural&&proofs[0].handed_over===true&&order.payment_mode==='rechnung'&&order.station==='abgeholt'&&order.status==='abgeholt';
        source.effective_integrity_ok=structural&&(order.station==='fertig'||source.post_goods_out_invoice_eligible);
      }
      // S54o C3/C12: concrete original-bound field failures precede the old
      // aggregate source gate, every allocation and every invoice write.
      const sellerFields={companyName:source.seller_company_name,street:source.seller_street,zip:source.seller_zip,city:source.seller_city,country:source.seller_country,iban:source.seller_iban};
      for(const [field,value] of Object.entries(sellerFields))if(optionalText(value)===null)throw new InvoiceElectronicSourceError({kind:'settings',field});
      if(optionalText(source.seller_vat_id)===null&&optionalText(source.seller_tax_number)===null)throw new InvoiceElectronicSourceError({kind:'settings',field:'taxId'});
      if(INVOICE_EU_OUTSIDE_DE.has(source.customer_country??'')&&optionalText(source.customer_vat_id)!==null&&optionalText(source.seller_vat_id)===null)throw new InvoiceElectronicSourceError({kind:'settings',field:'vatId'});
      const buyerFields={name:source.customer_name,street:source.customer_street,zip:source.customer_zip,city:source.customer_city,country:source.customer_country};
      for(const [field,value] of Object.entries(buyerFields))if(optionalText(value)===null)throw new InvoiceElectronicSourceError({kind:'customer',objectId:order.customer_id,field});
      if(source.service_date===null||source.service_date===undefined)throw new InvoiceElectronicSourceError({kind:'order',objectId:order.id,field:'serviceDate'});
      let frozenInvoiceTerms:InvoicePaymentTerms;
      try{frozenInvoiceTerms=resolveInvoicePaymentTerms(source.invoice_payment_term_days,
        typeof customerInvoiceTerms==='function'?await customerInvoiceTerms():customerInvoiceTerms,paymentAgreements===undefined?agreement:paymentAgreements);}
      catch(error){if(!(error instanceof InvoicePaymentTermsSourceError))throw error;throw new InvoiceElectronicSourceError({kind:error.kind,field:error.field,...(error.kind==='customer'?{objectId:order.customer_id}:{})});}
      const paymentTermDays=frozenInvoiceTerms.ziel_tage;
      if (
        !source.effective_integrity_ok
        || (afterGoodsOut && !source.post_goods_out_invoice_eligible)
        || !source.seller_config_complete
        || !source.customer_config_complete
        || (input.shippingCosts===undefined&&!source.base_prices_complete)
      ) {
        return { code: "VALIDATION_ERROR", message: "Stammdaten für die Rechnungsausgabe sind unvollständig." };
      }



      // Every master-data dependent value is built before a number exists, so
      // an incomplete tenant, customer, order or position cannot consume one.
      let content: PreparedInvoiceContent;
      try {
        let shippingFees:Array<{shipmentGroupId:string;amountCents:number;name:string;shippingKind:'fee'|'reference'}>=[];
        if(order.handover_mode==='shipping'){
          if(!readShippingSettings)throw Error('INVOICE_SHIPPING_SETTINGS_PORT_MISSING');
          const settings=await readShippingSettings(tx,tenantId);
          if(!settings||settings.shippingFeeCents===undefined)throw Error('INVOICE_SHIPPING_SETTINGS_SOURCE_MISSING');
          shippingFees=(await readShippingInvoiceLines(tx,tenantId,order,settings.shippingFeeCents,requireVatReader(readVat))).lines;
        }
        if(input.shippingCosts){
          const intent=input.shippingCosts;
          shippingFees=shippingLinesForScope(shippingFees,intent.scope);
          if(shippingFees.length===0||!shippingFees.some(line=>line.shippingKind==='fee')
            ||shippingFees.reduce((sum,line)=>sum+line.amountCents,0)!==intent.expectedFeeCents){
            return {code:'CONFLICT',message:SHIPPING_FEE_COPY.changed};
          }
        }
        content = prepareInvoiceContent(source, order,shippingFees,input.shippingCosts!==undefined);
        if (content.lines.some(line => line.type === 'EXTRA_WORK') && readExtraWork) {
          const mehrarbeit = await readExtraWork();
          if (mehrarbeit) {
            const basisNettoCent = commercial?.totalNetCents ?? toSafeInteger(source.base_net_amount_cents, 'INVOICE_BASE_AMOUNT_TOTAL_INVALID');
            content = applyInvoiceExtraWork(content, mehrarbeit, basisNettoCent);
          }
        }
      } catch (error) {
        if (error instanceof InvoiceVatRateError) return {code:"VALIDATION_ERROR",message:error.missingCompany?INVOICE_VAT_COPY.missingCompanyRate(error.part):INVOICE_VAT_COPY.missingRate(error.part)};
        if (error instanceof InvoiceMasterDataError) {
          return { code: "VALIDATION_ERROR", message: "Stammdaten für die Rechnungsausgabe sind unvollständig." };
        }
        throw error;
      }
      if(commercial){
        const bound=await bindOrderQuoteCommercialTerms(tx,auth,order.id);
        const unchanged=bound.shippingIncluded===commercial.shippingIncluded&&bound.quoteId===commercial.quoteId&&bound.edition===commercial.edition
          &&bound.totalNetCents===commercial.totalNetCents&&bound.positions.length===commercial.positions.length
          &&new Set(bound.positions.map(position=>position.itemId)).size===bound.positions.length
          &&bound.positions.every(position=>{
            const prior=commercial.positions.filter(original=>original.itemId===position.itemId);
            return prior.length===1&&prior[0].quantity===position.quantity&&prior[0].lineTotalCents===position.lineTotalCents
              &&(prior[0].vatRateBasisPoints??commercial.vatRateBasisPoints??source.invoice_vat_rate_basis_points)
                ===(position.vatRateBasisPoints??bound.vatRateBasisPoints??source.invoice_vat_rate_basis_points);
          });
        if(!unchanged)throw Error('QUOTE_COMMERCIAL_TERMS_CHANGED_DURING_INVOICE');
      }

      return {code:"PREPARED",content,frozenInvoiceTerms,paymentTermDays};
}

/** S38a E3/E14: one native collection source, same preparation and fiscal writer.
 * A representative order is never persisted, returned or used as a header. */
export async function createCollectionInvoice(input:unknown,readVat?:InvoiceVatReader,readShippingSettings?:InvoiceShippingSettingsReader,readOriginal?:InvoiceOriginalReader,readCustomerTerms?:InvoiceCustomerTermsReader,readMaterial?:InvoiceMaterialReader,scrapPorts?:InvoiceScrapPorts):Promise<CreateCollectionInvoiceResult>{
 if(!isIssueCollectionInvoiceInput(input))return {code:'VALIDATION_ERROR',message:E_INVOICE_COPY.collectionInvalid};
 let authorization;
 try{authorization=await resolveAuthorization();}catch{return {code:'UNAVAILABLE',message:E_INVOICE_COPY.collectionUnavailable};}
 if(!authorization.ok)return {code:authorization.reason==='AUTHORIZATION_UNAVAILABLE'?'UNAVAILABLE':'UNAUTHENTICATED',message:E_INVOICE_COPY.collectionUnavailable};
 if(!hasAuthorizationArea(authorization.data,'preise'))return {code:'FORBIDDEN',message:FINANCIAL_ACCESS_COPY.pricesMissing};
 const auth=authorization.data,tenantId=auth.tenantId;
 try{return await withPrivilegedTenantTransaction(auth,async tx=>{
  await tx.execute(sql`SELECT pg_advisory_xact_lock(hashtextextended('f1:invoice:client-event:'||${tenantId}||':'||${input.clientEventId},0))`);
  const previous=await readCreateInvoiceReceipts(tx,{collectionId:input.collectionId,clientEventId:input.clientEventId});
  if(previous.length){
   if(previous.length!==1)throw Error('INVOICE_COLLECTION_REPLAY_AMBIGUOUS');
   const receipt=mapInvoiceIssueReceipt(previous[0],tenantId,previous[0].actor_id,requireVatReader(readVat));
   return receipt.issuedBy===auth.userId&&receipt.collection.version===input.expectedVersion?{code:'OK' as const,receipt,replayed:true}:{code:'CONFLICT' as const,message:E_INVOICE_COPY.collectionConflict};
  }
  const reused=await tx.execute<{id:string}>(sql`SELECT id FROM public.events WHERE tenant_id=${tenantId} AND client_event_id=${input.clientEventId}::uuid LIMIT 1`);
  if(reused.length)return {code:'CONFLICT',message:E_INVOICE_COPY.collectionConflict};
  type CollectionSource={id:string;customer_id:string;month:string;version:number;status:string;invoice_id:string|null};
  const readCollection=()=>tx.execute<CollectionSource>(sql`SELECT id::text,customer_id,to_char(monat,'YYYY-MM-DD') AS month,version,status,invoice_id::text FROM public.invoice_collections WHERE tenant_id=${tenantId} AND id=${input.collectionId}::uuid LIMIT 2`);
  const selected=await readCollection();
  if(selected.length!==1)return {code:'NOT_FOUND',message:E_INVOICE_COPY.collectionInvalid};
  const customerId=selected[0].customer_id;
  await tx.execute(sql`SELECT private.lock_shipping_customer_v1(${tenantId},${customerId})`);
  const readMembers=()=>tx.execute<{order_id:string}>(sql`SELECT order_id FROM public.invoice_collection_orders WHERE tenant_id=${tenantId} AND collection_id=${input.collectionId}::uuid ORDER BY order_id`);
  const initialMembers=await readMembers();
  if(initialMembers.length===0)return {code:'VALIDATION_ERROR',message:E_INVOICE_COPY.collectionEmpty};
  for(const member of initialMembers)if(await lockInvoiceCreation(tx,tenantId,{orderId:member.order_id,clientEventId:input.clientEventId})!==customerId)throw Error('INVOICE_COLLECTION_CUSTOMER_CHANGED');
  const orders=await tx.execute<LockedOrder&{order_number:string}>(sql`SELECT * FROM public.orders WHERE tenant_id=${tenantId} AND id IN (${sql.join(initialMembers.map(member=>sql`${member.order_id}`),sql`,`)}) ORDER BY id FOR UPDATE`);
  const locked=await tx.execute<{id:string}>(sql`SELECT id::text FROM public.invoice_collections WHERE tenant_id=${tenantId} AND id=${input.collectionId}::uuid FOR UPDATE`);
  const sources=await readCollection(),members=await readMembers(),source=sources[0];
  if(locked.length!==1||sources.length!==1||!source||source.customer_id!==customerId||source.version!==input.expectedVersion||canonicalJson(members)!==canonicalJson(initialMembers))return {code:'CONFLICT',message:E_INVOICE_COPY.collectionConflict};
  if(source.status!=='offen'||source.invoice_id!==null)return {code:'VALIDATION_ERROR',message:E_INVOICE_COPY.collectionNotDue};
  if(orders.length!==members.length||orders.some((order,index)=>order.id!==members[index].order_id||order.customer_id!==customerId||order.tenant_id!==tenantId||order.station!=='abgeholt'||order.status!=='abgeholt'||order.payment_mode!=='rechnung'))return {code:'CONFLICT',message:E_INVOICE_COPY.collectionConflict};
  if(!readCustomerTerms)throw Error('INVOICE_CUSTOMER_TERMS_PORT_MISSING');
  let customerTerms:ReturnType<InvoiceCustomerTermsReader>|undefined;
  const getCustomerTerms=()=>customerTerms??=readCustomerTerms(tx,tenantId,customerId);
  const collectionAgreement=await readEffectiveCustomerAgreement(tx,{tenantId,customerId,orderId:null,memberOrderIds:members.map(member=>member.order_id),lock:true});
  await tx.execute(sql`SELECT id FROM public.company_settings WHERE tenant_id=${tenantId} FOR SHARE`);
  const prepared:Array<{order:LockedOrder;source:SourceRow;content:PreparedInvoiceContent;terms:InvoicePaymentTerms}>=[];
  let extraWork: ReturnType<typeof readInvoiceExtraWork> | undefined;
  const readExtraWork = () => extraWork ??= readInvoiceExtraWork(tx, auth, orders.map(order => order.id), scrapPorts);
  for(const order of orders){
   const rows=await readInvoiceIssueSource(tx,order.id),original=rows[0];
   if(rows.length===0)return {code:'VALIDATION_ERROR',message:E_INVOICE_COPY.collectionSourceIncomplete(order.order_number,'ein Beleg')};
   if(rows.length!==1||!original||original.tenant_id!==tenantId||original.order_id!==order.id||original.customer_id!==customerId||original.current_order_version!==order.version)throw Error('INVOICE_COLLECTION_MEMBER_SOURCE_INVALID');
   if(!original.no_active_invoice)return {code:'CONFLICT',message:E_INVOICE_COPY.collectionConflict};
   const agreement=collectionAgreement.agreement;
   const value=await prepareQualifiedInvoiceContent(tx,auth,{orderId:order.id,expectedVersion:order.version,clientEventId:input.clientEventId},order,original,true,agreement,getCustomerTerms,requireVatReader(readVat),readShippingSettings,true,undefined,readExtraWork);
   if(value.code!=='PREPARED')return value;
   prepared.push({order,source:original,content:value.content,terms:value.frozenInvoiceTerms});
  }
  const common=prepared[0];
  if(!common)throw Error('INVOICE_COLLECTION_EMPTY');
  // Common party/terms values are accepted only when proven equal for EVERY
  // member. This reduction never creates a representative fiscal order.
  if(prepared.some(row=>canonicalJson(row.content.seller)!==canonicalJson(common.content.seller)||canonicalJson(row.content.customer)!==canonicalJson(common.content.customer)||canonicalJson(row.terms)!==canonicalJson(common.terms)))return {code:'CONFLICT',message:E_INVOICE_COPY.collectionConflict};
  const orderIds = orders.map(order => order.id);
  const scrap = await readInvoiceScrap(tx, auth, orderIds, scrapPorts);
  const adjusted: typeof prepared = [];
  let fullScrap: {code:'VALIDATION_ERROR'; message:string} | undefined;
  for (const row of prepared) {
    const afterScrap = await applyInvoiceScrapWithinTransaction(tx, auth, row.content, scrap.get(row.order.id), scrapPorts);
    if ('code' in afterScrap) fullScrap ??= afterScrap;
    else adjusted.push({...row, content: afterScrap});
  }
  if (fullScrap) return fullScrap;
  const material = await readInvoiceMaterial(tx, auth, orderIds, readMaterial);
  const lines:ImmutableInvoiceLine[]=[],shipping=new Map<string,ImmutableInvoiceShippingLine>();
  for(const row of adjusted)for(const line of appendInvoiceMaterial(row.content,
    material.filter(position => position.auftragId === row.order.id), row.source.invoice_vat_rate_basis_points).lines){
   if(line.type!=='SHIPPING'){lines.push({...line,sourceOrderId:row.order.id});continue;}
   const previous=shipping.get(line.shipmentGroupId);
   if(previous){
    const {sourceOrderIds:priorOrigins,...prior}=previous;void priorOrigins;
    if(canonicalJson(prior)!==canonicalJson(line))throw Error('INVOICE_COLLECTION_SHIPMENT_SOURCE_CONFLICT');
    if(!previous.sourceOrderIds)throw Error('INVOICE_COLLECTION_SHIPMENT_ORIGINS_MISSING');
    if(!previous.sourceOrderIds.includes(row.order.id))previous.sourceOrderIds.push(row.order.id);
   }else shipping.set(line.shipmentGroupId,{...line,sourceOrderIds:[row.order.id]});
  }
  lines.push(...shipping.values());
  const sums=invoiceLineTotals(lines);
  const collection=parseInvoiceCollectionOriginal({collectionId:source.id,version:source.version,month:source.month,members:prepared.map(row=>({orderId:row.order.id,orderVersion:row.order.version,orderNumber:row.content.order.orderNumber,title:row.content.order.title,freezeId:row.source.freeze_id,serviceDate:toDateOnly(row.source.service_date)}))});
  const content:PreparedCollectionInvoiceContent={seller:common.content.seller,customer:common.content.customer,order:null,collection,lines,totals:{netAmountCents:sums.netAmountCents,vatRateBasisPoints:null,vatAmountCents:sums.vatAmountCents,grossAmountCents:sums.grossAmountCents,vatBreakdown:sums.vatBreakdown}};
  return persistPreparedInvoice(tx,auth,input,null,content,{paymentTermDays:common.terms.ziel_tage,frozenInvoiceTerms:common.terms,serviceDate:null,freezeId:null,afterGoodsOut:true,collectionCustomerId:customerId,ignoredAgreements:collectionAgreement.ignored},requireVatReader(readVat),readOriginal);
 });}catch(error){
  if (error instanceof InvoiceMaterialPriceError) return error.result();
  if (error instanceof InvoiceScrapError) return {code:'VALIDATION_ERROR',message:error.message};
  if (error instanceof InvoiceMaterialUnitError) return invoiceMaterialUnitFailure(error);
  if(error instanceof InvoiceCollectionNotDueError)return {code:'VALIDATION_ERROR',message:E_INVOICE_COPY.collectionNotDue};
  if(error instanceof InvoiceElectronicSourceError)return {code:'VALIDATION_ERROR',message:E_INVOICE_COPY.missingSource(error.location.field),source:error.location};
  if(error instanceof InvoiceGlyphError)return {code:'VALIDATION_ERROR',message:E_INVOICE_COPY.missingGlyph(error.field,error.codePoint)};
  console.error('[INVOICE_COLLECTION_ISSUE_FAILED]',error instanceof Error?error.message:'UnknownError');
  return {code:'UNAVAILABLE',message:E_INVOICE_COPY.collectionUnavailable};
 }
}

/** Single existing number/PDF/payment/event/receipt writer, shared by qualified preparations. */
async function persistPreparedInvoice(tx:PrivilegedTenantTransaction,auth:AuthorizationSnapshot,input:CreateInvoiceInput,order:LockedOrder,content:PreparedInvoiceContent,terms:PreparedInvoiceTerms,readVat:InvoiceVatReader,readOriginal?:InvoiceOriginalReader):Promise<Extract<CreateInvoiceResult,{code:'OK'}>>;
async function persistPreparedInvoice(tx:PrivilegedTenantTransaction,auth:AuthorizationSnapshot,input:IssueCollectionInvoiceInput,order:null,content:PreparedCollectionInvoiceContent,terms:PreparedInvoiceTerms,readVat:InvoiceVatReader,readOriginal?:InvoiceOriginalReader):Promise<Extract<CreateCollectionInvoiceResult,{code:'OK'}>>;
async function persistPreparedInvoice(tx:PrivilegedTenantTransaction,auth:AuthorizationSnapshot,input:CreateInvoiceInput|IssueCollectionInvoiceInput,order:LockedOrder|null,content:PreparedInvoiceContent|PreparedCollectionInvoiceContent,terms:PreparedInvoiceTerms,readVat:InvoiceVatReader,readOriginal?:InvoiceOriginalReader):Promise<Extract<CreateInvoiceResult|CreateCollectionInvoiceResult,{code:'OK'}>>{
  if(!('vatId'in content.seller)||!('taxNumber'in content.seller))throw new InvoiceElectronicSourceError({kind:'settings',field:'taxId'});
  if(!content.seller.vatId&&!content.seller.taxNumber)throw new InvoiceElectronicSourceError({kind:'settings',field:'taxId'});
  const native=order===null;
  let customerId:string,paymentMode:PaymentMode,collection:InvoiceCollectionOriginal|undefined;
  let originalSource:import('@/lib/pdf/ImmutableInvoiceDocument').InvoiceSingleOrderSource|import('@/lib/pdf/ImmutableInvoiceDocument').InvoiceCollectionSource;
  if(native){
    if(!Array.isArray(terms.ignoredAgreements)||!('collection'in content)||!('collectionId'in input)||content.order!==null||content.collection.collectionId!==input.collectionId||content.collection.version!==input.expectedVersion||terms.serviceDate!==null||terms.freezeId!==null||terms.reissue!==undefined||typeof terms.collectionCustomerId!=='string'||!terms.collectionCustomerId)throw Error('INVOICE_COLLECTION_PREPARATION_INVALID');
    collection=parseInvoiceCollectionOriginal(content.collection);customerId=terms.collectionCustomerId;paymentMode='rechnung';
    originalSource={order:null,serviceDate:null,collection};
  }else{
    if('collectionId'in input||content.order===null||terms.serviceDate===null||terms.freezeId===null||!isPaymentMode(order.payment_mode))throw Error('INVOICE_PREPARATION_SOURCE_INVALID');
    customerId=order.customer_id;paymentMode=order.payment_mode;
    originalSource={order:content.order,serviceDate:toDateOnly(terms.serviceDate)};
  }
  const invoiceOrderId=order===null?null:order.id,invoiceOrderVersion=order===null?null:order.version;
  const shippingCosts='shippingCosts'in input?input.shippingCosts:undefined;
  assertInvoiceElectronicFields({...content,...originalSource,seller:content.seller,paymentTermDays:terms.paymentTermDays});
  assertInvoiceContentGlyphs(content); // C15/C12: before the number and every original/PDF write.
  const {tenantId,userId:actorId}=auth;
  const {paymentTermDays,afterGoodsOut,originalInvoiceNumber}=terms;
  const {netAmountCents,vatRateBasisPoints,vatAmountCents,grossAmountCents}=content.totals;
  // Exactly one issue instant per invoice. Berlin is the only legal
  // calendar truth for the invoice year and the due date; the same instant
  // is reused for invoice, lifecycle event, snapshot and receipt.
  const timeRows = await tx.execute<{ issued_at_iso: string; invoice_year: number; due_date: Date | string; issue_month:string }>(sql`
    WITH issue_instant AS (SELECT clock_timestamp() AS ts)
    SELECT
      to_char(ts AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"') AS issued_at_iso,
      extract(year FROM (ts AT TIME ZONE 'Europe/Berlin'))::integer AS invoice_year,
      to_char(date_trunc('month',ts AT TIME ZONE 'Europe/Berlin'),'YYYY-MM-DD') AS issue_month,
      ((ts AT TIME ZONE 'Europe/Berlin')::date + ${paymentTermDays}::integer) AS due_date
    FROM issue_instant
  `);
  const timeRow = timeRows[0];
  if (timeRows.length !== 1 || !timeRow) throw new Error("INVOICE_TIME_UNAVAILABLE");
  const issuedAtIso = requireIsoInstant(timeRow.issued_at_iso, "INVOICE_TIME_INVALID");
  const invoiceYear = toSafeInteger(timeRow.invoice_year, "INVOICE_YEAR_INVALID");
  const dueDate = toDateOnly(timeRow.due_date);
  const serviceDate = originalSource.serviceDate;
  if(collection){
    if(!/^\d{4}-\d{2}-01$/.test(timeRow.issue_month))throw Error('INVOICE_COLLECTION_MONTH_SOURCE_INVALID');
    if(collection.month>=timeRow.issue_month)throw new InvoiceCollectionNotDueError('INVOICE_COLLECTION_NOT_DUE');
  }

  const numberRows = await tx.execute<{ invoice_number: string }>(sql`
    SELECT private.allocate_invoice_number(${tenantId}, ${invoiceYear}) AS invoice_number
  `);
  const invoiceNumber = numberRows[0]?.invoice_number;
  if (!invoiceNumber || !INVOICE_NUMBER_PATTERN.test(invoiceNumber)) {
    throw new Error("INVOICE_NUMBER_ALLOCATION_FAILED");
  }

  const snapshot: Extract<ImmutableInvoiceSnapshot,{schemaVersion:3}> = {
    schemaVersion: 3,
    seller: content.seller,
    customer: content.customer,
    ...originalSource,
    lines: content.lines,
    totals: content.totals,
    issuedAt: issuedAtIso,
    paymentTermDays,
    ...(terms.frozenInvoiceTerms?{terms:terms.frozenInvoiceTerms}:{}),
  };

  let pdfBuffer: Buffer;
  try {
    pdfBuffer = await renderToBuffer(
      createImmutableInvoicePdfDocument({ invoiceNumber, dueDate, snapshot,vat:requireVatReader(readVat)(snapshot),originalInvoiceNumber }),
    );
  } catch {
    throw new Error("INVOICE_PDF_RENDER_FAILED");
  }
  pdfBuffer=await createInvoiceElectronicOriginal(pdfBuffer,{snapshot,invoiceNumber,dueDate},readOriginal);
  if (pdfBuffer.byteLength < 1 || pdfBuffer.byteLength > 20 * 1024 * 1024) {
    throw new Error("INVOICE_PDF_SIZE_INVALID");
  }
  const pdfSha256 = createHash("sha256").update(pdfBuffer).digest("hex");

  const invoiceId = randomUUID();
  const correlationId = randomUUID();
  const pdfRef = `invoice://${invoiceId}/original`;
  const invoiceEventType = native?COLLECTION_EVENT_TYPE:afterGoodsOut ? EVENT_TYPE_V2 : EVENT_TYPE;
  const invoiceEventSchemaVersion = native?3:afterGoodsOut ? 2 : EVENT_SCHEMA_VERSION;
  const invoiceEventStation = afterGoodsOut ? "abgeholt" : STATION;
  const eventPayload = {
    invoiceId,
    ...(collection?{collection,collectionVersion:input.expectedVersion,ignoredAgreements:terms.ignoredAgreements}:{freezeId:terms.freezeId,orderVersion:invoiceOrderVersion}),
    invoiceNumber,
    netAmountCents,
    vatRateBasisPoints,
    vatAmountCents,
    grossAmountCents,
    pdfSha256,
    invoiceVersion: 1,
    ...(shippingCosts?{shippingCosts}:{}),
    ...(terms.reissue?{reissue:terms.reissue}:{}),
    ...(!native&&afterGoodsOut ? { invoiceSourceState: "after_goods_out" as const } : {}),
  };

  const eventRows = await tx.execute<{ event_id: string }>(sql`
    INSERT INTO public.events (
      id, tenant_id, order_id, item_id, event_type, description, user_id,
      payload, status, station, client_event_id, event_schema_version,
      correlation_id, aggregate_version, from_station, created_at
    ) VALUES (
      gen_random_uuid()::text, ${tenantId}, ${invoiceOrderId}, NULL,
      ${invoiceEventType}, 'Unveränderliche Rechnung erstellt', ${actorId}::uuid,
      ${JSON.stringify(eventPayload)}::jsonb,
      'success', ${invoiceEventStation}, ${input.clientEventId}::uuid, ${invoiceEventSchemaVersion},
      ${correlationId}::uuid, 1, ${invoiceEventStation},
      ${issuedAtIso}::timestamptz AT TIME ZONE 'UTC'
    )
    RETURNING id AS event_id
  `);
  const event = eventRows[0];
  if (eventRows.length !== 1 || !event || !UUID_PATTERN.test(event.event_id)) {
    throw new Error("INVOICE_EVENT_INSERT_FAILED");
  }

  const invoiceRows = await tx.execute<{ id: string }>(sql`
    INSERT INTO public.invoices (
      id, tenant_id, customer_id, order_id, invoice_number, amount_total, status, due_date,
      contract_version, freeze_id, snapshot, net_amount_cents, vat_rate_basis_points,
      vat_amount_cents, gross_amount_cents, service_date, payment_term_days,
      order_version, aggregate_version, client_event_id, correlation_id, issue_event_id,
      issued_at, issued_by, pdf_ref, pdf_sha256, pdf_content,
      payment_contract_version, payment_mode, payment_status,
      payment_open_amount_cents, payment_paid_amount_cents, payment_currency,
      payment_method, payment_paid_at, payment_receipt_id, payment_event_id,
      payment_correlation_id, payment_version,belegart,ursprung_rechnung_id
    ) VALUES (
      ${invoiceId}::uuid, ${tenantId}, ${customerId}, ${invoiceOrderId},
      ${invoiceNumber}, (${grossAmountCents}::numeric / 100), 'issued', ${dueDate}::date,
      1, ${terms.freezeId}::uuid, ${JSON.stringify(snapshot)}::jsonb,
      ${netAmountCents}, ${vatRateBasisPoints}, ${vatAmountCents}, ${grossAmountCents},
      ${serviceDate}::date, ${paymentTermDays}, ${invoiceOrderVersion}, 1,
      ${input.clientEventId}::uuid, ${correlationId}::uuid,
      ${event.event_id}, ${issuedAtIso}::timestamptz, ${actorId}::uuid,
      ${pdfRef}, ${pdfSha256}, ${pdfBuffer},
      ${PAYMENT_CONTRACT_VERSION}, ${paymentMode}, 'offen',
      ${grossAmountCents}, 0, 'EUR', NULL, NULL, NULL, NULL, NULL, 0,
      ${shippingCosts?'versandkosten':'auftrag'},${shippingCosts?.invoiceId??null}::uuid
    )
    RETURNING id
  `);
  const insertedInvoice = invoiceRows[0];
  if (invoiceRows.length !== 1 || !insertedInvoice || insertedInvoice.id !== invoiceId) {
    throw new Error("INVOICE_INSERT_FAILED");
  }

  if(collection){
    const marked=await tx.execute<{id:string}>(sql`UPDATE public.invoice_collections SET status='abgerechnet',invoice_id=${invoiceId}::uuid,version=version+1
      WHERE tenant_id=${tenantId} AND id=${collection.collectionId}::uuid AND customer_id=${customerId} AND status='offen' AND invoice_id IS NULL AND version=${collection.version} RETURNING id::text`);
    if(marked.length!==1||marked[0].id!==collection.collectionId)throw Error('INVOICE_COLLECTION_MARK_FAILED');
  }
  await readInitialPaymentState(tx, {
    tenantId,
    invoiceId,
    orderId: invoiceOrderId,
    grossAmountCents,
    paymentMode,
  });

  let receipt:ImmutableInvoiceReceipt|ImmutableInvoiceCollectionReceipt;
  if(collection){
    const rows=await readCreateInvoiceReceipts(tx,{collectionId:collection.collectionId,clientEventId:input.clientEventId});
    if(rows.length!==1||!rows[0])throw Error('INVOICE_COLLECTION_RECEIPT_MISSING');
    receipt=mapInvoiceIssueReceipt(rows[0],tenantId,actorId,readVat);
    if(receipt.collection.collectionId!==collection.collectionId||receipt.collection.version!==input.expectedVersion||canonicalJson(receipt.collection)!==canonicalJson(collection))throw Error('INVOICE_COLLECTION_RECEIPT_MISMATCH');
  }else{
    const receiptRows=await readCreateInvoiceReceipts(tx,input.clientEventId);
    if(receiptRows.length!==1||!receiptRows[0]||!('orderId'in input))throw Error('INVOICE_RECEIPT_MISSING');
    receipt=mapInvoiceIssueReceipt(receiptRows[0],tenantId,actorId,readVat);
    if(!receiptMatchesIntent(receipt,input,receiptRows[0]))throw Error('INVOICE_RECEIPT_INTENT_MISMATCH');
  }
  if (
    receipt.invoiceId !== invoiceId
    || receipt.invoiceNumber !== invoiceNumber
    || receipt.netAmountCents !== netAmountCents
    || receipt.vatAmountCents !== vatAmountCents
    || receipt.grossAmountCents !== grossAmountCents
    || receipt.serviceDate !== serviceDate
    || receipt.dueDate !== dueDate
    || receipt.pdfSha256 !== pdfSha256
    // One instant on invoice, event, snapshot and receipt — proven, not assumed.
    || receipt.issuedAt !== issuedAtIso
  ) throw new Error("INVOICE_RECEIPT_MISMATCH");

  if(receipt.eventSchemaVersion===3)return {code:"OK",receipt,replayed:false};
  return { code: "OK", receipt, replayed: false };
}

export type CancellationCreditComposition={failed:(tx:PrivilegedTenantTransaction,auth:AuthorizationSnapshot,key:string)=>Promise<void>;settled:(tx:PrivilegedTenantTransaction,auth:AuthorizationSnapshot,key:string)=>Promise<void>;collectionFailed?:(tx:PrivilegedTenantTransaction,auth:AuthorizationSnapshot,key:string)=>Promise<void>;collectionSettled?:(tx:PrivilegedTenantTransaction,auth:AuthorizationSnapshot,key:string)=>Promise<void>};
export async function cancelInvoice(input: unknown,readVat?:InvoiceVatReader,creditComposition?:CancellationCreditComposition,readOriginal?:InvoiceOriginalReader,readMaterial?:InvoiceMaterialReader): Promise<CancelInvoiceResult> {
  if (!isValidCancelInput(input)) {
    return { code: "VALIDATION_ERROR", message: "Ungültige Stornoanfrage." };
  }

  let authorization;
  try {
    authorization = await resolveAuthorization();
  } catch {
    return { code: "UNAVAILABLE", message: "Rechnung konnte nicht sicher storniert werden." };
  }
  if (!authorization.ok) {
    return authorization.reason === "AUTHORIZATION_UNAVAILABLE"
      ? { code: "UNAVAILABLE", message: "Rechnung konnte nicht sicher storniert werden." }
      : { code: "UNAUTHENTICATED", message: "Sitzung oder Berechtigung ist nicht verfügbar." };
  }
  if (
    !hasAuthorizationArea(authorization.data, "zahlungen")
  ) {
    return { code: "FORBIDDEN", message: FINANCIAL_ACCESS_COPY.paymentsMissing };
  }

  const tenantId = authorization.data.tenantId;
  const actorId = authorization.data.userId;

  try {
    return await withPrivilegedTenantTransaction(authorization.data, async (tx) => {
      await tx.execute(sql`
        SELECT pg_advisory_xact_lock(
          hashtextextended('f1:invoice:client-event:' || ${tenantId} || ':' || ${input.clientEventId}, 0)
        )
      `);
      await tx.execute(sql`
        SELECT pg_advisory_xact_lock(
          hashtextextended('f1:invoice:cancel:' || ${tenantId} || ':' || ${input.invoiceId}, 0)
        )
      `);

      const replayRows = await readCancellationInvoiceReceipts(tx,input.clientEventId);
      if (replayRows.length > 0) {
        if (replayRows.length !== 1 || !replayRows[0]) {
          return { code: "CONFLICT", message: "Anfragekennung wurde bereits anders verwendet." };
        }
        const receipt = mapInvoiceCancellationReceipt(replayRows[0], tenantId, replayRows[0].actor_id);
        if((receipt.cancelledBy!==actorId&&receipt.reissueWithoutShipping===undefined)||!cancellationReceiptMatchesIntent(receipt,input))return {code:'CONFLICT',message:'Anfragekennung wurde bereits anders verwendet.'};
        if(receipt.reissueWithoutShipping)await lockInvoiceCreation(tx,tenantId,{orderId:receipt.orderId,clientEventId:receipt.reissueWithoutShipping.replacementClientEventId});
        return completeCancellationCredit(tx,authorization.data,receipt,true,creditComposition,requireVatReader(readVat),readOriginal,readMaterial);
      }

      const reusedEvents = await tx.execute<{ id: string }>(sql`
        SELECT id
        FROM public.events
        WHERE tenant_id = ${tenantId}
          AND client_event_id = ${input.clientEventId}
        LIMIT 1
      `);
      if (reusedEvents.length > 0) {
        return { code: "CONFLICT", message: "Anfragekennung wurde bereits anders verwendet." };
      }

      // Payment confirmation locks the order before the invoice. Cancellation
      // uses the same order to avoid an invoice->order / order->invoice
      // deadlock through the cancellation event's order foreign key.
      const customerRows=await tx.execute<{customer_id:string|null;order_id:string|null;snapshot:unknown}>(sql`
        SELECT customer_id,order_id,snapshot FROM public.invoices
        WHERE tenant_id=${tenantId} AND id=${input.invoiceId}::uuid LIMIT 2
      `);
      if(customerRows.length!==1||!customerRows[0]?.customer_id)return {code:'NOT_FOUND',message:CUSTOMER_CREDIT_COPY.notFound};
      const originalIdentity=customerRows[0];
      const collection=originalIdentity.order_id===null?parseInvoiceCollectionOriginal((originalIdentity.snapshot as {collection:unknown}).collection):undefined;
      if(collection&&input.reissueWithoutShipping)return {code:'VALIDATION_ERROR',message:SHIPPING_FEE_COPY.changed};
      // All credit commands acquire the same customer lock before order/invoice locks.
      if(input.reissueWithoutShipping&&originalIdentity.order_id!==null)await lockInvoiceCreation(tx,tenantId,{orderId:originalIdentity.order_id,clientEventId:input.reissueWithoutShipping.replacementClientEventId});
      await tx.execute(sql`SELECT private.lock_customer_credit_v1(${tenantId},${customerRows[0].customer_id})`);
      const orderRows = collection?await tx.execute<LockedCancellationOrder>(sql`SELECT id,tenant_id FROM public.orders WHERE tenant_id=${tenantId} AND id IN (${sql.join(collection.members.map(member=>sql`${member.orderId}`),sql`, `)}) ORDER BY id FOR UPDATE`):await tx.execute<LockedCancellationOrder>(sql`
        SELECT orders.id, orders.tenant_id
        FROM public.invoices invoice
        JOIN public.orders orders
          ON orders.id = invoice.order_id
         AND orders.tenant_id = invoice.tenant_id
        WHERE invoice.id = ${input.invoiceId}::uuid
          AND invoice.tenant_id = ${tenantId}
          AND invoice.contract_version = 1
        LIMIT 2
        FOR UPDATE OF orders
      `);
      if (
        orderRows.length !== (collection?collection.members.length:1)
        || !orderRows[0]
        || orderRows.some(order=>order.tenant_id!==tenantId)
        || (collection!==undefined&&collection.members.some(member=>!orderRows.some(order=>order.id===member.orderId)))
      ) {
        return { code: "NOT_FOUND", message: "Rechnung nicht verfügbar." };
      }

      const invoiceRows = await tx.execute<Omit<LockedInvoice,'order_id'>&{order_id:string|null}>(sql`
        SELECT
          id, tenant_id, order_id, invoice_number, status, aggregate_version,
          snapshot, due_date, pdf_ref, pdf_sha256, pdf_content,
          net_amount_cents, vat_rate_basis_points, vat_amount_cents,
          gross_amount_cents, payment_contract_version, payment_mode,
          payment_status, payment_open_amount_cents, payment_paid_amount_cents,
          payment_currency, payment_method, payment_paid_at,
          payment_receipt_id, payment_event_id, payment_correlation_id,
          payment_version
        FROM public.invoices
        WHERE id = ${input.invoiceId}::uuid
          AND tenant_id = ${tenantId}
          AND contract_version = 1
        FOR UPDATE
      `);
      const invoice = invoiceRows[0];
      if (invoiceRows.length !== 1 || !invoice) {
        return { code: "NOT_FOUND", message: "Rechnung nicht verfügbar." };
      }
      if (invoice.order_id !== originalIdentity.order_id || (collection===undefined&&invoice.order_id !== orderRows[0].id)) {
        throw new Error("INVOICE_CANCEL_ORDER_INTEGRITY_INVALID");
      }
      if (invoice.status !== "issued" || invoice.aggregate_version !== input.expectedVersion) {
        return { code: "CONFLICT", message: "Rechnung wurde bereits verändert." };
      }
      if (input.expectedVersion !== 1) {
        return { code: "CONFLICT", message: "Rechnung wurde bereits verändert." };
      }
      const paymentRows=await tx.execute<PaymentSummaryRow>(sql`
        SELECT * FROM private.v_payment_summary_v1
        WHERE tenant_id=${tenantId} AND invoice_id=${invoice.id}::uuid LIMIT 2
      `);
      let cancellationPayment:PaymentSummary;
      try{
        if(paymentRows.length!==1||!paymentRows[0])throw Error('INVOICE_CANCEL_PAYMENT_SOURCE_MISSING');
        cancellationPayment=mapPaymentSummaryRow(paymentRows[0],authorization.data);
      }catch{return {code:'CONFLICT',message:CUSTOMER_CREDIT_COPY.paymentUnknown};}
      if (
        invoice.tenant_id !== tenantId
        || !INVOICE_NUMBER_PATTERN.test(invoice.invoice_number)
        || invoice.pdf_ref !== `invoice://${invoice.id}/original`
        || !HEX64_PATTERN.test(invoice.pdf_sha256)
        || !invoice.pdf_content
      ) throw new Error("INVOICE_CANCEL_SOURCE_INVALID");
      const originalPdf = Buffer.isBuffer(invoice.pdf_content)
        ? invoice.pdf_content
        : Buffer.from(invoice.pdf_content);
      if (createHash("sha256").update(originalPdf).digest("hex") !== invoice.pdf_sha256) {
        throw new Error("INVOICE_CANCEL_ORIGINAL_PDF_INVALID");
      }
      const snapshot = parseStoredSnapshot(invoice.snapshot, invoice, requireVatReader(readVat));
      // PL14:03: pre-live originals are readable, never retrofitted. The
      // existing Action observer records this refusal in technical_protocol.
      if(snapshot.schemaVersion!==3)return {code:'VALIDATION_ERROR',message:E_INVOICE_COPY.legacyCancellation};
      if(collection&&(!('collection' in snapshot)||canonicalJson(snapshot.collection)!==canonicalJson(collection)))throw Error('INVOICE_CANCEL_COLLECTION_CHANGED');
      assertInvoiceElectronicFields(snapshot);
      let reissue:InvoiceReissueIntent|undefined;
      if(input.reissueWithoutShipping&&invoice.order_id!==null){
        const manual=await readInvoiceHandoverSource(tx,tenantId,input.reissueWithoutShipping.handoverEventId);
        if(!manualHandoverAllowsReissue(manual,invoice.order_id,snapshot))return {code:'CONFLICT',message:SHIPPING_FEE_COPY.changed};
        reissue={...input.reissueWithoutShipping,originalPdfSha256:invoice.pdf_sha256,orderVersion:manual.order_version,confirmedBy:actorId};
      }

      assertInvoiceContentGlyphs(snapshot);
      assertInvoiceGlyphs([{field:'cancellation.reason',text:input.reason},{field:'invoice.number',text:invoice.invoice_number}]);
      // Exactly one cancellation instant, reused for invoice, lifecycle event,
      // cancellation document and receipt.
      const timeRows = await tx.execute<{ cancelled_at_iso: string }>(sql`
        SELECT to_char(clock_timestamp() AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"')
          AS cancelled_at_iso
      `);
      if (timeRows.length !== 1) throw new Error("INVOICE_CANCEL_TIME_UNAVAILABLE");
      const cancelledAt = requireIsoInstant(
        timeRows[0]?.cancelled_at_iso,
        "INVOICE_CANCEL_TIME_INVALID",
      );
      const numberRows=await tx.execute<{invoice_number:string}>(sql`SELECT private.allocate_invoice_number(${tenantId},extract(year FROM ${cancelledAt}::timestamptz AT TIME ZONE 'Europe/Berlin')::integer) AS invoice_number`);
      const cancellationNumber=numberRows[0]?.invoice_number;
      if(numberRows.length!==1||!cancellationNumber||!INVOICE_NUMBER_PATTERN.test(cancellationNumber)||cancellationNumber===invoice.invoice_number)throw Error('INVOICE_CANCEL_NUMBER_ALLOCATION_FAILED');

      let cancellationPdfBuffer: Buffer;
      try {
        cancellationPdfBuffer = await renderToBuffer(
          createImmutableInvoiceCancellationPdfDocument({
            invoiceNumber: invoice.invoice_number,
            cancellationNumber,
            cancelledAt,
            cancelReason: input.reason,
            snapshot,
            vat:requireVatReader(readVat)(snapshot),
          }),
        );
      } catch {
        throw new Error("INVOICE_CANCELLATION_PDF_RENDER_FAILED");
      }
      cancellationPdfBuffer=await createInvoiceElectronicOriginal(cancellationPdfBuffer,{snapshot,invoiceNumber:invoice.invoice_number,dueDate:toDateOnly(invoice.due_date),cancellation:{number:cancellationNumber,at:cancelledAt,reason:input.reason}},readOriginal);
      if (cancellationPdfBuffer.byteLength < 1 || cancellationPdfBuffer.byteLength > 20 * 1024 * 1024) {
        throw new Error("INVOICE_CANCELLATION_PDF_SIZE_INVALID");
      }
      const cancellationPdfSha256 = createHash("sha256")
        .update(cancellationPdfBuffer)
        .digest("hex");
      const cancellationPdfRef = `invoice://${invoice.id}/cancellation`;
      const correlationId = randomUUID();

      const eventRows = await tx.execute<{ event_id: string }>(sql`
        INSERT INTO public.events (
          id, tenant_id, order_id, item_id, event_type, description, user_id,
          payload, status, station, client_event_id, event_schema_version,
          correlation_id, aggregate_version, from_station, created_at
        ) VALUES (
          gen_random_uuid()::text, ${tenantId}, ${invoice.order_id}, NULL,
          ${CANCEL_EVENT_TYPE}, ${input.reason}, ${actorId}::uuid,
          ${JSON.stringify({
            invoiceId: invoice.id,
            invoiceNumber: invoice.invoice_number,
            expectedVersion: input.expectedVersion,
            cancelReason: input.reason,
            cancellationPdfSha256,
            invoiceVersion: 2,
            ...(reissue?{reissue}:{}),
            ...(collection?{collection}:{}),
          })}::jsonb,
          'success', ${STATION}, ${input.clientEventId}::uuid, ${EVENT_SCHEMA_VERSION},
          ${correlationId}::uuid, 2, ${STATION},
          ${cancelledAt}::timestamptz AT TIME ZONE 'UTC'
        )
        RETURNING id AS event_id
      `);
      const event = eventRows[0];
      if (eventRows.length !== 1 || !event || !UUID_PATTERN.test(event.event_id)) {
        throw new Error("INVOICE_CANCEL_EVENT_INSERT_FAILED");
      }

      await tx.execute(sql`SELECT set_config('app.invoice_cancel_command', 'v1', true)`);
      const updatedRows = await tx.execute<{ id: string }>(sql`
        UPDATE public.invoices
        SET
          status = 'cancelled',
          aggregate_version = 2,
          cancel_client_event_id = ${input.clientEventId}::uuid,
          cancel_correlation_id = ${correlationId}::uuid,
          cancelled_by = ${actorId}::uuid,
          cancel_reason = ${input.reason},
          cancelled_at = ${cancelledAt}::timestamptz,
          cancel_event_id = ${event.event_id},
          cancellation_pdf_ref = ${cancellationPdfRef},
          cancellation_pdf_sha256 = ${cancellationPdfSha256},
          cancellation_pdf_content = ${cancellationPdfBuffer}
          ,cancellation_invoice_number = ${cancellationNumber}
        WHERE id = ${invoice.id}::uuid
          AND tenant_id = ${tenantId}
          AND contract_version = 1
          AND status = 'issued'
          AND aggregate_version = ${input.expectedVersion}
          AND payment_contract_version = ${PAYMENT_CONTRACT_VERSION}
          AND payment_mode IN ('vorkasse', 'abholung', 'rechnung')
          AND payment_status = ${cancellationPayment.status}
          AND payment_paid_amount_cents = ${cancellationPayment.paidAmountCents}
          AND payment_open_amount_cents = ${cancellationPayment.openAmountCents}
          AND payment_currency = 'EUR'
          AND payment_version = ${cancellationPayment.paymentVersion}
        RETURNING id
      `);
      if (updatedRows.length !== 1 || updatedRows[0]?.id !== invoice.id) {
        throw new Error("INVOICE_CANCEL_UPDATE_FAILED");
      }

      if(collection){
        const released=await tx.execute<{order_id:string}>(sql`DELETE FROM public.invoice_collection_orders WHERE tenant_id=${tenantId} AND collection_id=${collection.collectionId}::uuid RETURNING order_id`);
        if(released.length!==collection.members.length||collection.members.some(member=>!released.some(row=>row.order_id===member.orderId)))throw Error('INVOICE_CANCEL_COLLECTION_RELEASE_INCOMPLETE');
        await tx.execute(sql`SET CONSTRAINTS invoice_collection_original_complete,invoice_collection_original_members IMMEDIATE`);
        await tx.execute(sql`SET CONSTRAINTS invoice_collection_original_complete,invoice_collection_original_members DEFERRED`);

      }

      const receiptRows = await readCancellationInvoiceReceipts(tx,input.clientEventId);
      if (receiptRows.length !== 1 || !receiptRows[0]) {
        throw new Error("INVOICE_CANCEL_RECEIPT_MISSING");
      }
      const receipt = mapInvoiceCancellationReceipt(receiptRows[0], tenantId, actorId);
      if (
        !cancellationReceiptMatchesIntent(receipt, input)
        || receipt.invoiceNumber !== invoice.invoice_number
        || receipt.orderId !== invoice.order_id
        || receipt.originalPdfSha256 !== invoice.pdf_sha256
        || receipt.cancellationPdfSha256 !== cancellationPdfSha256
        || receipt.cancellationPdfRef !== cancellationPdfRef
        || receipt.cancellationNumber !== cancellationNumber
        || receipt.cancelledAt !== cancelledAt
      ) throw new Error("INVOICE_CANCEL_RECEIPT_MISMATCH");

      return completeCancellationCredit(tx,authorization.data,receipt,false,creditComposition,requireVatReader(readVat),readOriginal,readMaterial);
    });
  } catch(error) {
    if(error instanceof InvoiceElectronicSourceError)return {code:'VALIDATION_ERROR',message:E_INVOICE_COPY.missingSource(error.location.field)};
    if(error instanceof InvoiceGlyphError)return {code:'VALIDATION_ERROR',message:E_INVOICE_COPY.missingGlyph(error.field,error.codePoint)};
    return { code: "UNAVAILABLE", message: "Rechnung konnte nicht sicher storniert werden." };
  }
}

/** K4/R2 obligation is read from the real immutable cancellation, not another ledger. */
export async function readCancelledCollectionRouting(tx:PrivilegedTenantTransaction,tenantId:string,key:string,lock=false){
 const identities=await tx.execute<{client_event_id:string}>(sql`SELECT client_event_id::text FROM public.events WHERE tenant_id=${tenantId} AND event_type='INVOICE_CANCELLED_V1' AND id=${key}`);
 if(!identities.length)return null;
 if(identities.length!==1)throw Error('INVOICE_COLLECTION_ROUTING_IDENTITY_INVALID');
 const rows=await readCancellationInvoiceReceipts(tx,identities[0].client_event_id);
 if(rows.length!==1)throw Error('INVOICE_COLLECTION_ROUTING_RECEIPT_INVALID');
 const receipt=mapInvoiceCancellationReceipt(rows[0],tenantId,rows[0].actor_id);
 if(!('collection'in receipt))return null;
 const [invoice]=await tx.execute<{customer_id:string}>(sql`SELECT customer_id FROM public.invoices WHERE tenant_id=${tenantId} AND id=${receipt.invoiceId}::uuid AND status='cancelled'`);
 if(!invoice)throw Error('INVOICE_COLLECTION_ROUTING_ORIGINAL_INVALID');
 const resolution=await readEffectiveCustomerAgreement(tx,{tenantId,customerId:invoice.customer_id,orderId:null,memberOrderIds:receipt.collection.members.map(member=>member.orderId),lock});
 const agreement=resolution.agreement;
 if(!agreement)return {receipt,customerId:invoice.customer_id,agreement:null,missing:[] as string[],pending:false};
 const routed=await tx.execute<{order_id:string;integrity_ok:boolean}>(sql`SELECT member.order_id,(collection.invoice_id IS NULL) AS integrity_ok FROM public.invoice_collection_orders member JOIN public.invoice_collections collection ON collection.tenant_id=member.tenant_id AND collection.id=member.collection_id
 WHERE member.tenant_id=${tenantId} AND collection.customer_id=${invoice.customer_id} AND collection.monat=${receipt.collection.month}::date AND collection.status='offen'
 UNION SELECT member.order_id,private.invoice_original_source_valid(original.tenant_id,original.customer_id,original.order_id,original.order_version,original.freeze_id,original.service_date,original.snapshot,original.issued_at) FROM private.v_invoice_order_members_v1 member JOIN public.invoices original ON original.tenant_id=member.tenant_id AND original.id=member.invoice_id WHERE member.tenant_id=${tenantId} AND original.customer_id=${invoice.customer_id} AND original.status='issued'
 UNION SELECT removal.order_id,true FROM public.events removal WHERE removal.tenant_id=${tenantId} AND removal.event_type='ORDER_COLLECTION_MEMBER_REMOVED_V1' AND removal.created_at AT TIME ZONE 'UTC'>=${receipt.cancelledAt}::timestamptz AND private.invoice_collection_removal_source_valid(removal,false)`);
 const memberIds=receipt.collection.members.map(member=>member.orderId);
 if(routed.some(row=>memberIds.includes(row.order_id)&&row.integrity_ok!==true))throw Error('INVOICE_COLLECTION_ROUTING_SOURCE_INCOMPLETE');
 const missing=receipt.collection.members.filter(member=>!routed.some(row=>row.order_id===member.orderId)).map(member=>member.orderId);
 return {receipt,customerId:invoice.customer_id,agreement,missing,pending:missing.length>0};
}
export async function repairCancelledCollectionRouting(tx:PrivilegedTenantTransaction,auth:AuthorizationSnapshot,key:string){
 const source=await readCancelledCollectionRouting(tx,auth.tenantId,key,true);
 if(!source?.pending)return;
 if(!('collection'in source.receipt)||!source.agreement||source.agreement.targetDays===null)throw Error('INVOICE_COLLECTION_ROUTING_TERMS_MISSING');
 const physical=await tx.execute<{id:string;version:number;freeze_id:string}>(sql`SELECT orders.id,orders.version,frozen.freeze_id::text FROM public.orders orders JOIN private.v_order_freeze_state_v1 frozen ON frozen.tenant_id=orders.tenant_id AND frozen.order_id=orders.id AND frozen.active AND frozen.integrity_ok
 WHERE orders.tenant_id=${auth.tenantId} AND orders.customer_id=${source.customerId} AND orders.id=ANY(ARRAY[${sql.join(source.missing.map(id=>sql`${id}`),sql`, `)}]::text[])
 AND orders.station='abgeholt' AND orders.current_station='abgeholt' AND orders.current_station_id='abgeholt' AND orders.status='abgeholt' AND orders.payment_mode='rechnung' ORDER BY orders.id FOR UPDATE OF orders`);
 const members=source.receipt.collection.members;
 if(physical.length!==source.missing.length||physical.some(row=>!members.some(member=>member.orderId===row.id&&member.orderVersion===row.version&&member.freezeId===row.freeze_id)))throw Error('INVOICE_COLLECTION_ROUTING_PHYSICAL_SOURCE_CHANGED');
 const {attachOpenInvoiceCollection}=await import('./recordGoodsOutCommand');
 for(const orderId of source.missing)await attachOpenInvoiceCollection(tx,{tenantId:auth.tenantId,customerId:source.customerId,orderId,actorId:auth.userId,targetDays:source.agreement.targetDays,physicalMonth:source.receipt.collection.month});
 const after=await readCancelledCollectionRouting(tx,auth.tenantId,key);if(!after||after.pending)throw Error('INVOICE_COLLECTION_ROUTING_READBACK_FAILED');
}

async function completeCancellationCredit(tx:PrivilegedTenantTransaction,auth:AuthorizationSnapshot,receipt:ImmutableInvoiceCancellationReceipt,replayed:boolean,composition?:CancellationCreditComposition,readVat:InvoiceVatReader=readInvoiceVat,readOriginal?:InvoiceOriginalReader,readMaterial?:InvoiceMaterialReader):Promise<CancelInvoiceResult>{
  if(receipt.reissueWithoutShipping)return completeInvoiceReissueFollowups(tx,auth,receipt,replayed,readVat,composition,readOriginal,readMaterial);
  let collectionPending=false;
  if('collection'in receipt){
    try{
      await withTenantSavepoint(tx,nested=>repairCancelledCollectionRouting(nested,auth,receipt.eventId));
      if(composition?.collectionSettled)await withTenantSavepoint(tx,nested=>composition.collectionSettled!(nested,auth,receipt.eventId));
    }catch(error){
      console.error('[INVOICE_COLLECTION_ROUTING_PENDING]',{code:error instanceof Error&&/^[A-Z0-9_]+$/.test(error.message)?error.message:null});
      try{if(!composition?.collectionFailed)throw Error('INVOICE_COLLECTION_ROUTING_TASK_PORT_MISSING');await withTenantSavepoint(tx,nested=>composition.collectionFailed!(nested,auth,receipt.eventId));}
      catch(taskError){console.error('[INVOICE_COLLECTION_ROUTING_TASK_PENDING]',{name:taskError instanceof Error?taskError.name:'UnknownError'});}
      collectionPending=true;
    }
  }
  try{
    await withTenantSavepoint(tx,nested=>appendCancellationCredit(nested,auth.tenantId,receipt));
    if(composition)await withTenantSavepoint(tx,nested=>composition.settled(nested,auth,receipt.clientEventId));
    return collectionPending?{code:'UNAVAILABLE',message:E_INVOICE_COPY.collectionRoutingPending}:{code:'OK',receipt,replayed};
  }catch(error){
    console.error('[CUSTOMER_CREDIT_FOLLOWUP_FAILED]',{name:error instanceof Error?error.name:'UnknownError'});
    // Cancellation remains committed. Its original N5/actor/receipt is the
    // retry marker even when the ordinary task's own receipt is unavailable.
    try{if(!composition)throw Error('CUSTOMER_CREDIT_TASK_PORT_MISSING');await withTenantSavepoint(tx,nested=>composition.failed(nested,auth,receipt.clientEventId));}
    catch(taskError){console.error('[CUSTOMER_CREDIT_TASK_PENDING]',{name:taskError instanceof Error?taskError.name:'UnknownError'});}
    return {code:'UNAVAILABLE',message:CUSTOMER_CREDIT_COPY.pending};
  }
}


/** Existing immutable cancellation/replacement source, shared with the physical output gate. */
export async function readPendingInvoiceReissue(tx:PrivilegedTenantTransaction,tenantId:string,orderId:string){
 const keys=await tx.execute<{client_event_id:string}>(sql`SELECT client_event_id::text FROM public.events
  WHERE tenant_id=${tenantId} AND order_id=${orderId} AND event_type='INVOICE_CANCELLED_V1'
   AND event_schema_version=1 AND status='success' AND payload ? 'reissue' ORDER BY created_at,id`);
 for(const key of keys){const source=await readInvoiceReissueSource(tx,tenantId,key.client_event_id);if(!source)throw Error('INVOICE_REISSUE_SOURCE_MISSING');if(!source.replacement)return source.snapshot.order.orderNumber;}
 return null;
}

async function issueInvoiceReplacement(tx:PrivilegedTenantTransaction,auth:AuthorizationSnapshot,key:string,readVat:InvoiceVatReader,readOriginal?:InvoiceOriginalReader,readMaterial?:InvoiceMaterialReader){
 if(!hasAuthorizationArea(auth,'zahlungen'))throw Error('INVOICE_REISSUE_MONEY_REQUIRED');
 let source=await readInvoiceReissueSource(tx,auth.tenantId,key,readVat);
 if(!source)throw Error('INVOICE_REISSUE_SOURCE_MISSING');
 const input={orderId:source.receipt.orderId,expectedVersion:source.intent.orderVersion,clientEventId:source.intent.replacementClientEventId};
 await lockInvoiceCreation(tx,auth.tenantId,input);
 await tx.execute(sql`SELECT private.lock_customer_credit_v1(${auth.tenantId},${source.original.customer_id})`);
 const orders=await tx.execute<LockedOrder>(sql`SELECT * FROM public.orders WHERE tenant_id=${auth.tenantId} AND id=${input.orderId} FOR UPDATE`);
 const order=orders[0];
 source=await readInvoiceReissueSource(tx,auth.tenantId,key,readVat);
 if(!source||orders.length!==1||!order||order.customer_id!==source.original.customer_id)throw Error('INVOICE_REISSUE_ORDER_SOURCE_INVALID');
 // The exact completed compound result remains readable by the original N5;
 // no caller impersonates the actual issuer of the replacement.
 if(source.replacement)return source.replacement;
 if(!source.current||order.version<source.intent.orderVersion||order.handover_mode!=='pickup'||order.station!==STATION||order.status!==STATION)throw Error('INVOICE_REISSUE_ORDER_CHANGED');
 const active=await readInvoiceIssueSource(tx,order.id);
 if(active.length!==1||active[0].tenant_id!==auth.tenantId||active[0].customer_id!==order.customer_id||!active[0].no_active_invoice)throw Error('INVOICE_REISSUE_ACTIVE_ORIGINAL_CHANGED');
 const sums=invoiceLineTotals(source.goods),snapshot=source.snapshot;
 const goods:PreparedInvoiceContent={seller:snapshot.seller,customer:snapshot.customer,order:{...snapshot.order,orderVersion:order.version},lines:source.goods,
  totals:{netAmountCents:sums.netAmountCents,vatAmountCents:sums.vatAmountCents,grossAmountCents:sums.grossAmountCents,vatRateBasisPoints:null,vatBreakdown:sums.vatBreakdown}};
 const content = appendInvoiceMaterial(goods, await readInvoiceMaterial(tx, auth, [order.id], readMaterial), active[0].invoice_vat_rate_basis_points);
 await persistPreparedInvoice(tx,auth,{...input,expectedVersion:order.version},order,content,{paymentTermDays:snapshot.paymentTermDays,frozenInvoiceTerms:snapshot.terms,serviceDate:snapshot.serviceDate,freezeId:source.original.freeze_id,afterGoodsOut:false,
  reissue:{cancellationEventId:source.receipt.eventId,confirmedBy:source.receipt.cancelledBy,repairActorId:auth.userId}},readVat,readOriginal);
 const proof=await readInvoiceReissueSource(tx,auth.tenantId,key,readVat);
 if(!proof?.replacement)throw Error('INVOICE_REISSUE_RECEIPT_MISSING');
 return proof.replacement;
}

async function completeInvoiceReissueFollowups(tx:PrivilegedTenantTransaction,auth:AuthorizationSnapshot,receipt:ImmutableInvoiceCancellationReceipt,replayed:boolean,readVat:InvoiceVatReader,composition?:CancellationCreditComposition,readOriginal?:InvoiceOriginalReader,readMaterial?:InvoiceMaterialReader):Promise<CancelInvoiceResult>{
 let creditAmount:number|null=null,replacementReady=false,taskReady=false;
 try{
  await withTenantSavepoint(tx,nested=>appendCancellationCredit(nested,auth.tenantId,receipt));
  const credit=await withTenantSavepoint(tx,nested=>readCancellationCreditSource(nested,auth.tenantId,receipt.clientEventId));
  if(!credit||credit.pending)throw Error('INVOICE_REISSUE_CREDIT_NOT_PROVEN');
  creditAmount=credit.paidAmountCents;
  const replacementReceipt=await withTenantSavepoint(tx,nested=>issueInvoiceReplacement(nested,auth,receipt.clientEventId,readVat,readOriginal,readMaterial));
  replacementReady=true;
  if(composition)await withTenantSavepoint(tx,nested=>composition.settled(nested,auth,receipt.clientEventId));
  return {code:'OK',receipt,replacementReceipt,replayed};
 }catch(error){
  const cause=error&&typeof error==='object'&&'cause'in error?error.cause:undefined;
  console.error('[INVOICE_REISSUE_FOLLOWUP_FAILED]',cause instanceof Error?cause.message:error instanceof Error?error.message:'UnknownError');
  try{if(!composition)throw Error('INVOICE_REISSUE_TASK_PORT_MISSING');await withTenantSavepoint(tx,nested=>composition.failed(nested,auth,receipt.clientEventId));taskReady=true;}
  catch(taskError){console.error('[INVOICE_REISSUE_TASK_PENDING]',taskError instanceof Error?taskError.message:'UnknownError');}
  return {code:'UNAVAILABLE',message:creditAmount===null?CUSTOMER_CREDIT_COPY.pending:replacementReady?SHIPPING_FEE_COPY.reissueTaskCompletionPending:!taskReady?SHIPPING_FEE_COPY.reissueTaskPending:creditAmount===0?SHIPPING_FEE_COPY.reissueUnpaidPending:SHIPPING_FEE_COPY.reissuePending};
 }
}

/** Existing normal TaskWriter completion composes this exact financial repair. */
export async function repairInvoiceReissueTask(tx:PrivilegedTenantTransaction,auth:AuthorizationSnapshot,task:{id:string;client_key:string;art:string;bezug_typ:string;bezug_id:string|null},readOriginal?:InvoiceOriginalReader,readMaterial?:InvoiceMaterialReader){
 const source=await readInvoiceReissueSource(tx,auth.tenantId,task.client_key);
 if(!source)return false;
 if(!hasAuthorizationArea(auth,'zahlungen')||task.id!==source.receipt.eventId||task.art!=='aufgabe'||task.bezug_typ!=='auftrag'||task.bezug_id!==source.receipt.orderId)throw Error('INVOICE_REISSUE_TASK_NOT_AUTHORIZED');
 await lockInvoiceCreation(tx,auth.tenantId,{orderId:source.receipt.orderId,clientEventId:source.intent.replacementClientEventId});
 await appendCancellationCredit(tx,auth.tenantId,source.receipt);
 await issueInvoiceReplacement(tx,auth,source.receipt.clientEventId,readInvoiceVat,readOriginal,readMaterial);
 const proof=await readInvoiceReissueSource(tx,auth.tenantId,task.client_key);
 if(!proof?.replacement)throw Error('INVOICE_REISSUE_TASK_NOT_REPAIRED');
 return true;
}

function requireVatReader(reader:InvoiceVatReader|undefined):InvoiceVatReader{
 return reader??readInvoiceVat;
}
