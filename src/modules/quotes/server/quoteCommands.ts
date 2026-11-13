import "server-only";
import {OFFLINE_DEVICE_READ_COPY,QUOTE_CYCLE_COPY,SITUATION_COPY} from '@/ui/situationCatalog';

import { createHash,randomUUID } from "node:crypto";
import {scaleQuoteCalculation,type QuoteCalculation} from "../quoteCalculation";
import {appendQuoteJournal,quoteHasPreparedDocument,readQuoteComplaintSource} from "@/lib/server/quoteJournalPort";
import {readQuoteReceivedQuantities,readQuoteGoodsSummaries,readQuoteGoodsSummariesForQuotes} from "@/lib/server/quoteGoodsContextPort";
import { sql } from "drizzle-orm";
import { normaliseOrderPositionSurface, normaliseOrderPositionUnit, orderPositionSurfaceLabel, orderPositionUnitLabel, orderPositionQuantityError, orderPositionPriceError } from "@/lib/orderPositionContract";
import { withPrivilegedTenantTransaction, type PrivilegedTenantTransaction } from "@/lib/server/privilegedDb";
import type {
  ConvertQuoteInput,
  CreateQuoteInput,
  CreateQuoteResult,
  PrepareQuoteConversionResult,
  QuoteCommandContext,
  QuoteConversionReceipt,
  QuoteOrderInput,
  QuotePosition,
  QuoteReadback,
  UpdateQuoteInput,
  UpdateQuoteResult,
  ListOpenQuotesResult,
  ReadQuoteConversionReceiptResult,
  ReadQuoteCreateReceiptResult,
  ReadQuoteUpdateReceiptResult,
  ReadQuoteResult,
} from "./types";

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;
const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;
const TERM_STATUS_VALUES = ["wunsch", "bestaetigt", "verschoben", "gegenvorschlag"] as const;
const INTAKE_SOURCE_VALUES = ["persoenlich", "versand", "abholung_firma", "anfrage_mail", "anfrage_telefon"] as const;

type QuoteRow = {
  commercial_terms?:Array<{position:number;unit:string|null;minutes:number|null;vat:0|700|1900|null}>;
  fassung?:number;
  kalk_stunden?:string|number|null;stundensatz_cents?:string|number|null;ruest_cents?:string|number|null;material_cents?:string|number|null;
  vorbehalt_fassung?:number|null;vorbehalt_am?:Date|string|null;vorbehalt_grund?:string|null;
  derived_status?:string;
  gesendet_fassung?:number|null; gesendet_am?:Date|string|null; gesendet_kanal?:string|null;
  zugesagt_fassung?:number|null; zugesagt_am?:Date|string|null; zusage_nachweis?:string|null;
  abgesagt_am?:Date|string|null; absage_grund?:string|null; nachfass_am?:Date|string|null;
  quelle_intake_item_id?:string|null; quelle_nachricht_id?:string|null; sonderwuensche?:string|null;lieferzeit_wochen?:number|null;
  source_complaint_id?:string|null;
  quote_id: string;
  tenant_id: string;
  quote_number: string;
  customer_id: string;
  customer_number: string | null;
  customer_display_name: string;
  status: string;
  version: number;
  currency: string;
  due_date: Date | string;
  valid_until: Date | string | null;
  intake_term_status: string | null;
  intake_source: string | null;
  note: string | null;
  total_net_cents: number | string;
  linked_order_id: string | null;
  created_by: string;
  actor_display_name: string;
  created_at: Date | string;
  updated_at: Date | string;
  converted_at: Date | string | null;
  positions: unknown;
  integrity_ok: boolean;
};

type CreateReceiptRow = {
  receipt_id: string;
  event_id: string;
  tenant_id: string;
  quote_id: string;
  customer_id: string;
  actor_id: string;
  client_event_id: string;
  correlation_id: string;
  intent_sha256: string;
  recorded_at: Date | string;
  integrity_ok: boolean;
};

type ConversionReceiptRow = CreateReceiptRow & {
  order_id: string;
  order_intake_event_id: string;
  quote_version: number;
};

type UpdateReceiptRow = {
  receipt_id: string;
  event_id: string;
  tenant_id: string;
  quote_id: string;
  actor_id: string;
  client_event_id: string;
  correlation_id: string;
  intent_sha256: string;
  expected_version: number;
  aggregate_version: number;
  recorded_at: Date | string;
  integrity_ok: boolean;
};

function plainObject(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function exactKeys(value: Record<string, unknown>, expected: readonly string[]): boolean {
  const actual = Object.keys(value).sort();
  const wanted = [...expected].sort();
  return actual.length === wanted.length && actual.every((key, index) => key === wanted[index]);
}

function text(value: unknown, min: number, max: number): string | null {
  if (typeof value !== "string") return null;
  const normalized = value.trim().replace(/\s+/g, " ");
  return normalized.length >= min && normalized.length <= max ? normalized : null;
}

function optionalText(value: unknown, max: number): string | null | undefined {
  if (value === null) return null;
  return text(value, 1, max) ?? undefined;
}

function validDate(value: unknown): value is string {
  if (typeof value !== "string" || !DATE_PATTERN.test(value)) return false;
  const parsed = new Date(`${value}T00:00:00.000Z`);
  return !Number.isNaN(parsed.getTime()) && parsed.toISOString().slice(0, 10) === value;
}

function normalizeCalculation(raw:unknown):QuoteCalculation|null{
 if(!plainObject(raw)||!exactKeys(raw,['hours','hourlyRateCents','setupCents','materialCents']))return null;
 const value=raw as QuoteCalculation,result=scaleQuoteCalculation(value,1,1);
 if(result.code!=='OK')return null;
 const [whole,fraction='']=value.hours.trim().replace(',','.').split('.'),digits=fraction.replace(/0+$/u,'');
 return {hours:BigInt(whole).toString()+(digits?'.'+digits:''),hourlyRateCents:value.hourlyRateCents,setupCents:value.setupCents,materialCents:value.materialCents};
}

function normalizeCreate(value: unknown): CreateQuoteInput | null {
  if (!plainObject(value)) return null;
  const hasIntakeMetadata = Object.hasOwn(value, "validUntil") || Object.hasOwn(value, "termStatus") || Object.hasOwn(value, "intakeSource");
  if (!exactKeys(value, ["clientEventId", "customerId", "dueDate", "note", "positions",
    ...["validUntil", "termStatus", "intakeSource"].filter(key=>Object.hasOwn(value,key)),
    ...['sourceComplaintId','source','specialRequests','deliveryWeeks','calculation'].filter(key=>Object.hasOwn(value,key))])) return null;
  if(Object.hasOwn(value,'sourceComplaintId')&&(typeof value.sourceComplaintId!=='string'||!UUID_PATTERN.test(value.sourceComplaintId)||Object.hasOwn(value,'source')))return null;
  if (Object.hasOwn(value,'source')&&(!plainObject(value.source)||!exactKeys(value.source,['itemId','version','message'])||typeof value.source.itemId!=='string'||!UUID_PATTERN.test(value.source.itemId)||!Number.isSafeInteger(value.source.version)||Number(value.source.version)<1||typeof value.source.message!=='boolean')) return null;
  if (Object.hasOwn(value,'specialRequests')&&value.specialRequests!==null&&(typeof value.specialRequests!=='string'||value.specialRequests.trim().length<1||value.specialRequests.length>4000)) return null;
  if (Object.hasOwn(value,'deliveryWeeks')&&value.deliveryWeeks!==null&&(!Number.isSafeInteger(value.deliveryWeeks)||Number(value.deliveryWeeks)<1||Number(value.deliveryWeeks)>104)) return null;
  if (typeof value.clientEventId !== "string" || !UUID_PATTERN.test(value.clientEventId)) return null;
  const customerId = text(value.customerId, 1, 128);
  const note = optionalText(value.note, 2000);
  if (!customerId || !validDate(value.dueDate) || note === undefined || !Array.isArray(value.positions) || value.positions.length < 1 || value.positions.length > 20) return null;
  if (value.validUntil!==undefined&&value.validUntil!==null&&!validDate(value.validUntil)
    ||value.termStatus!==undefined&&value.termStatus!==null&&!TERM_STATUS_VALUES.includes(value.termStatus as typeof TERM_STATUS_VALUES[number])
    ||value.intakeSource!==undefined&&value.intakeSource!==null&&!INTAKE_SOURCE_VALUES.includes(value.intakeSource as typeof INTAKE_SOURCE_VALUES[number])) return null;
  const positions = [];
  for (const candidate of value.positions) {
    if (!plainObject(candidate) || !exactKeys(candidate, ["material", "name", "quantity", "surfaceRequested", "unitPriceCents", ...['lineTotalCents','unit','plannedMinutes'].filter(key=>Object.hasOwn(candidate,key))])) return null;
    const name = text(candidate.name, 2, 160);
    const material = candidate.material === null ? null : text(candidate.material, 1, 120);
    const surfaceRequested = normaliseOrderPositionSurface(candidate.surfaceRequested);
    if (!name || material === null && candidate.material !== null || !surfaceRequested
      || typeof candidate.quantity !== "number" || orderPositionQuantityError(candidate.quantity, null) !== null
      || typeof candidate.unitPriceCents !== "number" || orderPositionPriceError(candidate.unitPriceCents, true) !== null) return null;
    if (Object.hasOwn(candidate,"lineTotalCents") && (typeof candidate.lineTotalCents!=="number" || !Number.isSafeInteger(candidate.lineTotalCents) || candidate.lineTotalCents<0 || candidate.lineTotalCents>999999999999)) return null;
    if(candidate.unit!==undefined&&candidate.unit!==null&&!normaliseOrderPositionUnit(candidate.unit))return null;
    if(candidate.plannedMinutes!==undefined&&candidate.plannedMinutes!==null&&(!Number.isSafeInteger(candidate.plannedMinutes)||Number(candidate.plannedMinutes)<0||Number(candidate.plannedMinutes)>9999999))return null;
    positions.push({ name, quantity: candidate.quantity, material, surfaceRequested, unitPriceCents: candidate.unitPriceCents, ...(Object.hasOwn(candidate,"lineTotalCents")?{lineTotalCents:candidate.lineTotalCents as number}:{}),...(Object.hasOwn(candidate,'unit')?{unit:normaliseOrderPositionUnit(candidate.unit)}:{}),...(Object.hasOwn(candidate,'plannedMinutes')?{plannedMinutes:candidate.plannedMinutes as number|null}:{}) });
  }
  const calculation=Object.hasOwn(value,'calculation')?normalizeCalculation(value.calculation):undefined;
  if(calculation===null)return null;
  return {
    clientEventId: value.clientEventId, customerId, dueDate: value.dueDate, note, positions,
    ...(calculation?{calculation}:{}),
    ...(Object.hasOwn(value,'sourceComplaintId')?{sourceComplaintId:value.sourceComplaintId as string}:{}),
    ...(hasIntakeMetadata ? {
      validUntil: value.validUntil===undefined?null:value.validUntil as string|null,
      termStatus: value.termStatus===undefined?null:value.termStatus as typeof TERM_STATUS_VALUES[number]|null,
      intakeSource: value.intakeSource===undefined?null:value.intakeSource as typeof INTAKE_SOURCE_VALUES[number]|null,
    } : {}),
    ...(Object.hasOwn(value,'source')?{source:value.source as CreateQuoteInput['source']}:{}),
    ...(Object.hasOwn(value,'specialRequests')?{specialRequests:typeof value.specialRequests==='string'?value.specialRequests.trim():null}:{}),
    ...(Object.hasOwn(value,'deliveryWeeks')?{deliveryWeeks:value.deliveryWeeks as number|null}:{}),
  };
}

function normalizeConvert(value: unknown): ConvertQuoteInput | null {
  if (!plainObject(value) || !exactKeys(value, ["clientEventId", "confirmedAward", "confirmedOrderDueDate", "expectedVersion", "handoverMode", "paymentMode", "quoteId",...(plainObject(value)&&Object.hasOwn(value,"goodsReceiptId")?["goodsReceiptId"]:[])])) return null;
  if (typeof value.quoteId !== "string" || !UUID_PATTERN.test(value.quoteId)
    || typeof value.clientEventId !== "string" || !UUID_PATTERN.test(value.clientEventId)
    || (value.goodsReceiptId!==undefined&&(typeof value.goodsReceiptId!=="string"||!UUID_PATTERN.test(value.goodsReceiptId)))
    || value.confirmedAward !== true || typeof value.expectedVersion !== "number"
    || !Number.isSafeInteger(value.expectedVersion) || value.expectedVersion < 1
    || !validDate(value.confirmedOrderDueDate)
    || (value.handoverMode !== "pickup" && value.handoverMode !== "shipping")
    || (value.paymentMode !== "vorkasse" && value.paymentMode !== "abholung" && value.paymentMode !== "rechnung")
    || (value.paymentMode === "abholung" && value.handoverMode !== "pickup")) return null;
  return value as ConvertQuoteInput;
}

function normalizeUpdate(value: unknown): UpdateQuoteInput | null {
  if (!plainObject(value) || !exactKeys(value, ["clientEventId", "dueDate", "expectedVersion", "note", "positions", "quoteId",...["calculation","source","termStatus"].filter(key=>Object.hasOwn(value,key))])) return null;
  if (typeof value.quoteId !== "string" || !UUID_PATTERN.test(value.quoteId)
    || typeof value.clientEventId !== "string" || !UUID_PATTERN.test(value.clientEventId)
    || typeof value.expectedVersion !== "number" || !Number.isSafeInteger(value.expectedVersion) || value.expectedVersion < 1) return null;
  const created = normalizeCreate({
    clientEventId: value.clientEventId,
    customerId: "placeholder",
    ...Object.fromEntries(["calculation","source","termStatus"].filter(key=>Object.hasOwn(value,key)).map(key=>[key,value[key]])),
    dueDate: value.dueDate,
    note: value.note,
    positions: value.positions,
  });
  if (!created) return null;
  return {
    quoteId: value.quoteId,
    clientEventId: value.clientEventId,
    expectedVersion: value.expectedVersion,
    dueDate: created.dueDate,
    note: created.note,
    positions: created.positions,
    ...(created.calculation?{calculation:created.calculation}:{}),
    ...(created.source?{source:created.source}:{}),
    ...(Object.hasOwn(value,"termStatus")?{termStatus:created.termStatus}:{}),
  };
}

function hashIntent(value: unknown): string {
  return createHash("sha256").update(JSON.stringify(value), "utf8").digest("hex");
}

function quoteContent(quote:QuoteReadback){return JSON.stringify({customerId:quote.customerId,validUntil:quote.validUntil,intakeSource:quote.intakeSource,note:quote.note,positions:quote.positions.map(p=>({name:p.name,quantity:p.quantity,material:p.material,surface:p.surfaceRequested,price:p.unitPriceCents,total:p.lineTotalCents})),calculation:quote.lifecycle?.calculation,specialRequests:quote.lifecycle?.specialRequests,deliveryWeeks:quote.lifecycle?.deliveryWeeks});}

/** Holds the quote only during pending-mail preparation, never during Graph I/O. */
export async function lockQuoteDeliverySnapshot(tx:PrivilegedTenantTransaction,tenantId:string,input:{id:string;version:number;edition:number}){
 const rows=await tx.execute(sql`SELECT id FROM private.quotes WHERE tenant_id=${tenantId} AND id=${input.id}::uuid AND version=${input.version} AND fassung=${input.edition} FOR SHARE`);return rows.length===1;
}

function hashQuoteWriteIntent(input: CreateQuoteInput | UpdateQuoteInput): string {
  // Preserve existing immutable receipts while current position rows store keys.
  return hashIntent({ ...input, positions: input.positions.map(position => ({
    ...position, surfaceRequested: orderPositionSurfaceLabel(position.surfaceRequested),
  })) });
}

function hashOrderIntent(input: QuoteOrderInput): string {
  return hashIntent({
    geprueft: input.geprueft,
    clientEventId: input.clientEventId,
    customer: input.customer,
    dueDate: input.dueDate,
    termStatus: input.termStatus,
    intakeSource: input.intakeSource,
    handoverMode: input.handoverMode,
    items: input.items.map((item) => ({
      catalogServiceId: item.catalogServiceId,
      name: item.name,
      quantity: item.quantity,
      material: item.material,
      surfaceRequested: orderPositionSurfaceLabel(item.surfaceRequested),
      executionRequested: "offen",
      unit: item.unit === null ? null : orderPositionUnitLabel(item.unit),
      unitPriceCents: item.unitPriceCents,
      vatRateBasisPoints: item.vatRateBasisPoints,
    })),
    note: input.note,
    paymentMode: input.paymentMode,
  });
}

function iso(value: Date | string | null): string | null {
  if (value === null) return null;
  const parsed = value instanceof Date ? value : new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed.toISOString();
}

function parsePositions(value: unknown): QuotePosition[] | null {
  if (!Array.isArray(value) || value.length < 1 || value.length > 20) return null;
  if (!value.every(plainObject)) return null;
  const positions = value.map((position) => ({
    id: String(position.id),
    position: Number(position.position),
    name: String(position.name),
    quantity: Number(position.quantity),
    material: position.material === null ? null : String(position.material),
    surfaceRequested: String(position.surfaceRequested),
    unitPriceCents: Number(position.unitPriceCents),
    lineTotalCents: Number(position.lineTotalCents),
  }));
  const valid = positions.every((position,index) => UUID_PATTERN.test(position.id)
    && Number.isSafeInteger(position.position) && position.position >= 1 && position.position <= 20
    && Boolean(text(position.name, 2, 160)) && Number.isSafeInteger(position.quantity) && position.quantity >= 1
    && (position.material === null || Boolean(text(position.material, 1, 120)))
    && Boolean(text(position.surfaceRequested, 2, 160))
    && Number.isFinite(position.unitPriceCents) && position.unitPriceCents >= 0
    && Number.isSafeInteger(position.lineTotalCents)
    && position.lineTotalCents >= 0
    && (value[index].explicitLineTotal === true
      ? Math.abs(position.quantity * position.unitPriceCents-position.lineTotalCents)<0.0001
      : Number.isSafeInteger(position.unitPriceCents) && position.lineTotalCents === position.quantity * position.unitPriceCents));
  return valid ? positions : null;
}

function quoteFromRow(row: QuoteRow, tenantId: string): QuoteReadback | null {
  let lifecycle:QuoteReadback['lifecycle'];
  if (row.fassung!==undefined) {
    if (!Number.isSafeInteger(row.fassung)||row.fassung<1||!['entwurf','versendet','geaendert_seit_versand','zugesagt','umgewandelt','abgesagt','abgelaufen'].includes(row.derived_status??'')) return null;
    for (const value of [row.gesendet_fassung,row.zugesagt_fassung]) if (value!==null&&(!Number.isSafeInteger(value)||Number(value)<1||Number(value)>row.fassung)) return null;
    for (const value of [row.gesendet_am,row.zugesagt_am,row.abgesagt_am]) if (value!==null&&(!value||!iso(value))) return null;
    if (![null,'mail','druck'].includes(row.gesendet_kanal===undefined?'missing':row.gesendet_kanal)||[row.quelle_intake_item_id,row.quelle_nachricht_id].some(value=>value!==null&&(typeof value!=='string'||!UUID_PATTERN.test(value)))) return null;
    if ((row.gesendet_fassung===null)!==(row.gesendet_am===null)||(row.gesendet_fassung===null)!==(row.gesendet_kanal===null)||(row.zugesagt_fassung===null)!==(row.zugesagt_am===null)||(row.zugesagt_fassung===null)!==(row.zusage_nachweis===null)) return null;
    if (row.vorbehalt_fassung!==undefined&&row.vorbehalt_fassung!==null&&(!Number.isSafeInteger(row.vorbehalt_fassung)||row.vorbehalt_fassung<1||row.vorbehalt_fassung>row.fassung||!iso(row.vorbehalt_am??null)||!row.vorbehalt_grund?.trim()||row.zugesagt_fassung===row.vorbehalt_fassung)) return null;
    let calculation:QuoteCalculation|null=null;
    if(row.kalk_stunden!==null&&row.kalk_stunden!==undefined){calculation={hours:String(row.kalk_stunden),hourlyRateCents:row.stundensatz_cents==null?null:Number(row.stundensatz_cents),setupCents:row.ruest_cents==null?null:Number(row.ruest_cents),materialCents:row.material_cents==null?null:Number(row.material_cents)};if(scaleQuoteCalculation(calculation,1,1).code!=='OK')return null;}
    lifecycle={calculation,edition:row.fassung,stage:row.derived_status as NonNullable<QuoteReadback['lifecycle']>['stage'],sentEdition:row.gesendet_fassung!,sentAt:iso(row.gesendet_am!),sentChannel:row.gesendet_kanal as 'mail'|'druck'|null,acceptedEdition:row.zugesagt_fassung!,acceptedAt:iso(row.zugesagt_am!),acceptanceEvidence:row.zusage_nachweis!,conditional:row.vorbehalt_fassung?{edition:row.vorbehalt_fassung,recordedAt:iso(row.vorbehalt_am!)!,reason:row.vorbehalt_grund!}:null,declinedAt:iso(row.abgesagt_am!),declineReason:row.absage_grund!,followupAt:row.nachfass_am===null?null:row.nachfass_am instanceof Date?row.nachfass_am.toISOString().slice(0,10):String(row.nachfass_am).slice(0,10),sourceItemId:row.quelle_intake_item_id!,sourceMessageId:row.quelle_nachricht_id!,specialRequests:row.sonderwuensche!,deliveryWeeks:row.lieferzeit_wochen!};
  }
  const positions = parsePositions(row.positions);
  const createdAt = iso(row.created_at);
  const updatedAt = iso(row.updated_at);
  const convertedAt = iso(row.converted_at);
  const dueDate = row.due_date instanceof Date ? row.due_date.toISOString().slice(0, 10) : String(row.due_date).slice(0, 10);
  const validUntil = row.valid_until === null ? null : row.valid_until instanceof Date
    ? row.valid_until.toISOString().slice(0, 10) : String(row.valid_until).slice(0, 10);
  const total = Number(row.total_net_cents);
  if (row.integrity_ok !== true || row.tenant_id !== tenantId || !UUID_PATTERN.test(row.quote_id)
    || !/^KV-\d{4}-\d{4,}$/.test(row.quote_number) || !positions || !validDate(dueDate)
    || !Number.isSafeInteger(total) || total !== positions.reduce((sum, item) => sum + item.lineTotalCents, 0)
    || !createdAt || !updatedAt || (row.converted_at !== null && !convertedAt)
    || (validUntil !== null && !validDate(validUntil))
    || (row.intake_term_status !== null && !TERM_STATUS_VALUES.includes(row.intake_term_status as typeof TERM_STATUS_VALUES[number]))
    || (row.intake_source !== null && !INTAKE_SOURCE_VALUES.includes(row.intake_source as typeof INTAKE_SOURCE_VALUES[number]))
    || !["draft", "converted"].includes(row.status) || !Number.isSafeInteger(row.version) || row.version < 1
    || row.currency !== "EUR" || !UUID_PATTERN.test(row.created_by)) return null;
  return {
    ...(lifecycle?{lifecycle}:{}),quoteId: row.quote_id, quoteNumber: row.quote_number, customerId: row.customer_id,
    customerNumber: row.customer_number, customerDisplayName: row.customer_display_name,
    status: row.status as QuoteReadback["status"], version: row.version, currency: "EUR",
    dueDate, validUntil, termStatus: row.intake_term_status as QuoteReadback["termStatus"],
    intakeSource: row.intake_source as QuoteReadback["intakeSource"],
    note: row.note, totalNetCents: total, linkedOrderId: row.linked_order_id,
    ...(row.source_complaint_id?{sourceComplaintId:row.source_complaint_id}:{}),
    actorId: row.created_by, actorDisplayName: row.actor_display_name, createdAt, updatedAt, convertedAt, positions,
  };
}

function diagnostic(error: unknown, key: "message" | "details" | "hint" | "code" | "constraint_name"): string | null {
  if (!error || typeof error !== "object") return null;
  const record = error as Record<string, unknown>;
  const source = record.cause && typeof record.cause === "object" ? record.cause as Record<string, unknown> : record;
  const value = source[key] ?? (key === "details" ? source.detail : null);
  if (typeof value !== "string") return null;
  return /\b(?:select|insert|update|delete)\b|params:/i.test(value) ? "DATABASE_OPERATION_FAILED" : value.replace(/\s+/g, " ").slice(0, 500);
}

export async function readQuote(tx: PrivilegedTenantTransaction, tenantId: string, quoteId: string): Promise<QuoteReadback | null> {
  const rows = await tx.execute<QuoteRow>(sql`SELECT projection.*,original.quelle_reklamation_id AS source_complaint_id,
    (SELECT coalesce(jsonb_agg(jsonb_build_object('position',terms.position,'unit',terms.unit,'minutes',terms.aufwand_min,'vat',terms.vat_rate_basis_points) ORDER BY terms.position),'[]'::jsonb) FROM private.quote_positions terms WHERE terms.tenant_id=projection.tenant_id AND terms.quote_id=projection.quote_id AND terms.revision=projection.version) AS commercial_terms
    FROM private.v_quotes_v1 projection JOIN private.quotes original ON original.tenant_id=projection.tenant_id AND original.id=projection.quote_id WHERE projection.quote_id = ${quoteId}::uuid LIMIT 2`);
  if (rows.length === 0) return null;
  if (rows.length !== 1 || !rows[0]) throw new Error("QUOTE_READBACK_AMBIGUOUS");
  const quote = quoteFromRow(rows[0], tenantId);
  if (!quote) throw new Error("QUOTE_READBACK_INVALID");
  const terms=rows[0].commercial_terms;
  if(!Array.isArray(terms)||terms.length!==quote.positions.length)throw Error('QUOTE_COMMERCIAL_TERMS_INVALID');
  quote.positions=quote.positions.map((position,index)=>{
    if(terms[index].position!==position.position)throw Error('QUOTE_COMMERCIAL_TERMS_INVALID');
    return {...position,unit:terms[index].unit,plannedMinutes:terms[index].minutes,vatRateBasisPoints:terms[index].vat};
  });
  if(quote.lifecycle)quote.lifecycle.goods=await readQuoteGoodsSummaries(tx,tenantId,quoteId);
  return quote;
}

export type QuoteFollowupBinding=(tx:PrivilegedTenantTransaction,input:{quote:QuoteReadback;action:'sent'|'changed'|'accept'|'reject'|'conditional';phase:'before'|'after'})=>Promise<string|null>;
export type QuoteSourceBinding=(tx:PrivilegedTenantTransaction,input:{source:NonNullable<CreateQuoteInput['source']>;quoteId:string;customerId:string;clientEventId:string;effect?:'ware'|'accept'|'reject'|'conditional'|'amend'})=>Promise<void|{code:'FORBIDDEN'|'NOT_FOUND'|'CONFLICT'|'VALIDATION_ERROR'|'UNAVAILABLE';message:string}>;
class QuoteSourceFailure extends Error {constructor(readonly result:Exclude<CreateQuoteResult,{code:'OK'}>){super(result.message);}}
export async function createQuoteCommand(authorization: QuoteCommandContext, input: unknown,bindSource?:QuoteSourceBinding): Promise<CreateQuoteResult> {
  const normalized = normalizeCreate(input);
  if (!normalized) return { code: "VALIDATION_ERROR", message: "KV-Daten sind unvollständig oder ungültig." };
  if (!authorization.capabilities.canCreateQuote) return { code: "FORBIDDEN", message: "KVs dürfen mit dieser Rolle nicht angelegt werden." };
  if(normalized.sourceComplaintId&&normalized.positions.reduce((total,p)=>total+(p.lineTotalCents??p.quantity*p.unitPriceCents),0)<=0)return {code:'VALIDATION_ERROR',message:'KV aus einer Reklamation benötigt einen berechneten Preis.'};
  const intentSha256 = hashQuoteWriteIntent(normalized);
  try {
    return await withPrivilegedTenantTransaction(authorization, async (tx) => {
      const result = await tx.execute<{ result_code: string; result_quote_id: string | null; replayed: boolean }>(sql`
        SELECT * FROM private.create_quote_v1(
          ${authorization.tenantId}, ${authorization.userId}::uuid, ${normalized.clientEventId}::uuid,
          ${intentSha256}, ${normalized.customerId}, ${normalized.dueDate}::date,
          ${normalized.validUntil ?? null}::date, ${normalized.termStatus ?? null}, ${normalized.intakeSource ?? null}, ${normalized.note},
          ${JSON.stringify(normalized.positions)}::jsonb
        )
      `);
      const outcome = result.length === 1 ? result[0] : null;
      if (!outcome || outcome.result_code !== "OK" || !outcome.result_quote_id || !UUID_PATTERN.test(outcome.result_quote_id)) {
        if (outcome?.result_code === "CONFLICT" || outcome?.result_code === "NOT_FOUND" || outcome?.result_code === "VALIDATION_ERROR") {
          return { code: outcome.result_code, message: outcome.result_code === "CONFLICT" ? "Anfragekennung wurde bereits anders verwendet." : outcome.result_code === "NOT_FOUND" ? "Kunde ist nicht verfügbar." : "KV-Daten sind ungültig." };
        }
        throw new Error("QUOTE_CREATE_RESULT_INVALID");
      }
      if (!outcome.replayed) {
        if(normalized.sourceComplaintId){
          const source=await readQuoteComplaintSource(tx,authorization.tenantId,normalized.sourceComplaintId);
          if(!source||source.customerId!==normalized.customerId||source.assessment!=='abgelehnt')throw new QuoteSourceFailure({code:'VALIDATION_ERROR',message:'KV benötigt die abgelehnte Reklamation desselben Kunden.'});
          await tx.execute(sql`UPDATE private.quotes SET quelle_reklamation_id=${source.id} WHERE tenant_id=${authorization.tenantId} AND id=${outcome.result_quote_id}::uuid`);
          await appendQuoteJournal(tx,authorization,{id:randomUUID(),type:'QUOTE_COMPLAINT_LINKED_V1',clientEventId:randomUUID(),correlationId:normalized.clientEventId,version:1,description:'KV aus Reklamation '+source.number,payload:{quoteId:outcome.result_quote_id,complaintId:source.id,complaintNumber:source.number,customerId:source.customerId}});
        }
        if (normalized.source) {
          if (!bindSource) throw new QuoteSourceFailure({code:'UNAVAILABLE',message:'Quellverknüpfung ist nicht verfügbar. Nichts gespeichert.'});
          const failure=await bindSource(tx,{source:normalized.source,quoteId:outcome.result_quote_id,customerId:normalized.customerId,clientEventId:normalized.clientEventId});
          if (failure) throw new QuoteSourceFailure(failure);
        }
        if (normalized.source||Object.hasOwn(normalized,'specialRequests')||Object.hasOwn(normalized,'deliveryWeeks')) await tx.execute(sql`UPDATE private.quotes SET quelle_intake_item_id=${normalized.source?.itemId??null}::uuid,quelle_nachricht_id=${normalized.source?.message?normalized.source.itemId:null}::uuid,sonderwuensche=${normalized.specialRequests??null},lieferzeit_wochen=${normalized.deliveryWeeks??null} WHERE tenant_id=${authorization.tenantId} AND id=${outcome.result_quote_id}::uuid`);
      }
      if(!outcome.replayed&&normalized.calculation)await writeCalculationSnapshot(tx,authorization,outcome.result_quote_id,normalized.clientEventId,normalized.calculation,null);
      const quote = await readQuote(tx, authorization.tenantId, outcome.result_quote_id);
      const receipts = await tx.execute<CreateReceiptRow>(sql`
        SELECT * FROM private.v_quote_create_receipts_v1
        WHERE actor_id = ${authorization.userId}::uuid AND client_event_id = ${normalized.clientEventId}::uuid LIMIT 2
      `);
      const receipt = receipts.length === 1 ? receipts[0] : null;
      const recordedAt = receipt ? iso(receipt.recorded_at) : null;
      if (!quote || !receipt || receipt.integrity_ok !== true || receipt.tenant_id !== authorization.tenantId
        || receipt.quote_id !== quote.quoteId || receipt.customer_id !== normalized.customerId
        || receipt.actor_id !== authorization.userId || receipt.client_event_id !== normalized.clientEventId
        || receipt.intent_sha256 !== intentSha256 || !recordedAt
        || quote.validUntil !== (normalized.validUntil ?? null)
        || quote.termStatus !== (normalized.termStatus ?? null)
        || quote.intakeSource !== (normalized.intakeSource ?? null)) throw new Error("QUOTE_CREATE_READBACK_INVALID");
      return { code: "OK", quote, replayed: outcome.replayed, receipt: {
        receiptId: receipt.receipt_id, eventId: receipt.event_id, quoteId: receipt.quote_id,
        customerId: receipt.customer_id, actorId: receipt.actor_id, clientEventId: receipt.client_event_id,
        correlationId: receipt.correlation_id, recordedAt, aggregateVersion: 1,
      } };
    });
  } catch (error) {
    console.error("quote_create_command_failed", { message: diagnostic(error, "message"), details: diagnostic(error, "details"), hint: diagnostic(error, "hint") });
    if (error instanceof QuoteSourceFailure) return error.result;
    // The event key is tenant-wide, while the original receipt is actor-bound.
    // A different actor must get a conflict after rollback, never a second KV
    // or a misleading temporary-outage response. Other constraints stay errors.
    if (diagnostic(error, "code") === "23505" && diagnostic(error, "constraint_name") === "events_tenant_client_event_uidx") {
      return { code: "CONFLICT", message: "Anfragekennung wurde bereits anders verwendet." };
    }
    return { code: "UNAVAILABLE", message: "KV konnte nicht sicher gespeichert werden." };
  }
}

export async function readQuoteCommand(authorization: QuoteCommandContext, input: { quoteId: string }): Promise<ReadQuoteResult> {
  if (!plainObject(input) || !exactKeys(input, ["quoteId"]) || typeof input.quoteId !== "string" || !UUID_PATTERN.test(input.quoteId)) return { code: "VALIDATION_ERROR", message: "KV-Kennung ist ungültig." };
  if (!authorization.capabilities.canReadQuote) return { code: "FORBIDDEN", message: "KV darf mit dieser Rolle nicht gelesen werden." };
  try {
    return await withPrivilegedTenantTransaction(authorization, async (tx) => {
      const quote = await readQuote(tx, authorization.tenantId, input.quoteId);
      return quote ? { code: "OK", quote } : { code: "NOT_FOUND", message: "KV ist nicht verfügbar." };
    });
  } catch (error) {
    console.error("quote_read_failed", { message: diagnostic(error, "message"), details: diagnostic(error, "details"), hint: diagnostic(error, "hint") });
    return { code: "UNAVAILABLE", message: "KV konnte nicht sicher gelesen werden." };
  }
}

/** Lists only the caller's tenant-bound draft aggregates. */
export async function listOpenQuotesCommand(authorization: QuoteCommandContext, customerId?:string,changedSince?:string): Promise<ListOpenQuotesResult> {
  if (!authorization.capabilities.canReadQuote) return { code: "FORBIDDEN", message: "Offene KVs dürfen mit dieser Rolle nicht gelesen werden." };
  if(customerId!==undefined&&!UUID_PATTERN.test(customerId))return {code:'VALIDATION_ERROR',message:'Kunde ist ungültig.'};
  if(changedSince!==undefined&&(typeof changedSince!=='string'||!Number.isFinite(Date.parse(changedSince))||new Date(changedSince).toISOString()!==changedSince))return {code:'VALIDATION_ERROR',message:OFFLINE_DEVICE_READ_COPY.invalidWindow};
  try {
    return await withPrivilegedTenantTransaction(authorization, async (tx) => {
      const rows = await tx.execute<QuoteRow>(sql`SELECT projection.*,original.quelle_reklamation_id AS source_complaint_id FROM private.v_quotes_v1 projection JOIN private.quotes original ON original.tenant_id=projection.tenant_id AND original.id=projection.quote_id WHERE (${customerId??null}::text IS NULL OR projection.customer_id=${customerId??null}::text)
      AND (EXISTS(SELECT 1 FROM private.v_open_quotes_v1 opened WHERE opened.tenant_id=projection.tenant_id AND opened.quote_id=projection.quote_id) OR (${changedSince??null}::timestamptz IS NOT NULL AND projection.updated_at>=${changedSince??null}::timestamptz))
      ORDER BY projection.updated_at DESC, projection.quote_number ASC`);
      const quotes = rows.map((row) => quoteFromRow(row, authorization.tenantId));
      if (quotes.some((quote) => quote === null)) throw new Error("QUOTE_LIST_READBACK_INVALID");
        const goods=await readQuoteGoodsSummariesForQuotes(tx,authorization.tenantId,quotes.filter(quote=>quote?.lifecycle).map(quote=>quote!.quoteId));
        for(const quote of quotes)if(quote?.lifecycle)quote.lifecycle.goods=goods.get(quote.quoteId)??[];
      return { code: "OK", quotes: quotes as QuoteReadback[] };
    });
  } catch (error) {
    console.error("quote_list_open_failed", { message: diagnostic(error, "message"), details: diagnostic(error, "details"), hint: diagnostic(error, "hint") });
    return { code: "UNAVAILABLE", message: "Offene KVs konnten nicht sicher gelesen werden." };
  }
}

export async function updateQuoteCommand(authorization: QuoteCommandContext, input: unknown,followup:QuoteFollowupBinding,bindSource?:QuoteSourceBinding): Promise<UpdateQuoteResult> {
  const normalized = normalizeUpdate(input);
  if (!normalized) return { code: "VALIDATION_ERROR", message: "KV-Daten sind unvollständig oder ungültig." };
  if (!authorization.capabilities.canUpdateQuote) return { code: "FORBIDDEN", message: "KVs dürfen mit dieser Rolle nicht bearbeitet werden." };
  const intentSha256 = hashQuoteWriteIntent(normalized);
  try {
    return await withPrivilegedTenantTransaction(authorization, async (tx) => {
      await tx.execute(sql`SELECT id FROM private.quotes WHERE tenant_id=${authorization.tenantId} AND id=${normalized.quoteId}::uuid FOR UPDATE`);
      const before=await readQuote(tx,authorization.tenantId,normalized.quoteId);
      const calculationBefore=normalized.calculation?await readCalculationSnapshot(tx,authorization.tenantId,normalized.quoteId):null;
      const result = await tx.execute<{ result_code: string; result_quote_id: string | null; replayed: boolean }>(sql`
        SELECT * FROM private.update_quote_v1(
          ${authorization.tenantId}, ${authorization.userId}::uuid, ${normalized.clientEventId}::uuid,
          ${normalized.quoteId}::uuid, ${normalized.expectedVersion}, ${intentSha256}, ${normalized.dueDate}::date,
          ${normalized.note}, ${JSON.stringify(normalized.positions)}::jsonb
        )
      `);
      const outcome = result.length === 1 ? result[0] : null;
      if (!outcome || outcome.result_code !== "OK" || outcome.result_quote_id !== normalized.quoteId) {
        if (outcome?.result_code === "CONFLICT" || outcome?.result_code === "NOT_FOUND" || outcome?.result_code === "VALIDATION_ERROR") {
          return { code: outcome.result_code, message: outcome.result_code === "CONFLICT" ? "Der KV wurde zwischenzeitlich geändert oder diese Kennung anders verwendet." : outcome.result_code === "NOT_FOUND" ? "KV ist nicht verfügbar." : "KV-Daten sind ungültig." };
        }
        throw new Error("QUOTE_UPDATE_RESULT_INVALID");
      }
      if(!outcome.replayed&&normalized.calculation)await writeCalculationSnapshot(tx,authorization,normalized.quoteId,normalized.clientEventId,normalized.calculation,calculationBefore);
      if(!outcome.replayed&&Object.hasOwn(normalized,'termStatus'))await tx.execute(sql`UPDATE private.quotes SET intake_term_status=${normalized.termStatus??null} WHERE tenant_id=${authorization.tenantId} AND id=${normalized.quoteId}::uuid`);
      let quote = await readQuote(tx, authorization.tenantId, normalized.quoteId);
      if(!outcome.replayed&&before?.lifecycle&&quote?.lifecycle&&quote.lifecycle.edition===before.lifecycle.edition&&quoteContent(before)!==quoteContent(quote)&&await quoteHasPreparedDocument(tx,authorization.tenantId,normalized.quoteId,before.lifecycle.edition)){
        await tx.execute(sql`UPDATE private.quotes SET fassung=fassung+1 WHERE tenant_id=${authorization.tenantId} AND id=${normalized.quoteId}::uuid`);
        quote=await readQuote(tx,authorization.tenantId,normalized.quoteId);
      }
      if(!outcome.replayed&&normalized.source){
        if(!bindSource||!quote)throw new QuoteSourceFailure({code:'UNAVAILABLE',message:'Nachtrags-Original konnte nicht mitgespeichert werden. Nichts geändert.'});
        const failure=await bindSource(tx,{source:normalized.source,quoteId:quote.quoteId,customerId:quote.customerId,clientEventId:normalized.clientEventId,effect:'amend'});
        if(failure)throw new QuoteSourceFailure(failure);
      }
      if(!outcome.replayed&&quote?.lifecycle?.stage==='geaendert_seit_versand'){await followup(tx,{quote,action:'changed',phase:'after'});quote=await readQuote(tx,authorization.tenantId,normalized.quoteId);}
      const rows = await tx.execute<UpdateReceiptRow>(sql`
        SELECT * FROM private.v_quote_update_receipts_v1
        WHERE quote_id = ${normalized.quoteId}::uuid AND actor_id = ${authorization.userId}::uuid
          AND client_event_id = ${normalized.clientEventId}::uuid LIMIT 2
      `);
      const receipt = rows.length === 1 ? rows[0] : null;
      const recordedAt = receipt ? iso(receipt.recorded_at) : null;
      if (!quote || !receipt || receipt.integrity_ok !== true || receipt.tenant_id !== authorization.tenantId
        || receipt.quote_id !== normalized.quoteId || receipt.actor_id !== authorization.userId
        || receipt.client_event_id !== normalized.clientEventId || receipt.intent_sha256 !== intentSha256
        || receipt.expected_version !== normalized.expectedVersion || receipt.aggregate_version !== normalized.expectedVersion + 1
        || quote.version !== receipt.aggregate_version || !recordedAt) throw new Error("QUOTE_UPDATE_READBACK_INVALID");
      return { code: "OK", quote, replayed: outcome.replayed, receipt: {
        receiptId: receipt.receipt_id, eventId: receipt.event_id, quoteId: receipt.quote_id, actorId: receipt.actor_id,
        clientEventId: receipt.client_event_id, correlationId: receipt.correlation_id, recordedAt,
        expectedVersion: receipt.expected_version, aggregateVersion: receipt.aggregate_version,
      } };
    });
  } catch (error) {
    if(error instanceof QuoteSourceFailure){console.error('[QUOTE_SOURCE_REJECTED]',error.result.code);return error.result;}
    console.error("quote_update_command_failed", { message: diagnostic(error, "message"), details: diagnostic(error, "details"), hint: diagnostic(error, "hint") });
    return { code: "UNAVAILABLE", message: "KV konnte nicht sicher aktualisiert werden." };
  }
}

/** Read-only recovery for an interrupted KV create using the original client event. */
export async function readQuoteCreateReceiptCommand(
  authorization: QuoteCommandContext,
  input: unknown,
): Promise<ReadQuoteCreateReceiptResult> {
  const normalized = normalizeCreate(input);
  if (!normalized) return { code: "VALIDATION_ERROR", message: "Die gespeicherte KV-Anfrage kann nicht sicher geprüft werden." };
  if (!authorization.capabilities.canReadQuote) return { code: "FORBIDDEN", message: "Der gespeicherte KV-Stand darf mit dieser Rolle nicht gelesen werden." };
  const intentSha256 = hashQuoteWriteIntent(normalized);
  try {
    return await withPrivilegedTenantTransaction(authorization, async (tx) => {
      const rows = await tx.execute<CreateReceiptRow>(sql`
        SELECT * FROM private.v_quote_create_receipts_v1
        WHERE actor_id = ${authorization.userId}::uuid AND client_event_id = ${normalized.clientEventId}::uuid LIMIT 2
      `);
      if (rows.length === 0) return { code: "NOT_FOUND", message: "Zu dieser Anfrage wurde noch kein sicherer KV-Stand gefunden." };
      const receipt = rows.length === 1 ? rows[0] : null;
      const recordedAt = receipt ? iso(receipt.recorded_at) : null;
      if (!receipt || receipt.integrity_ok !== true || receipt.tenant_id !== authorization.tenantId
        || receipt.customer_id !== normalized.customerId || receipt.actor_id !== authorization.userId
        || receipt.client_event_id !== normalized.clientEventId || receipt.intent_sha256 !== intentSha256 || !recordedAt) {
        throw new Error("QUOTE_CREATE_RECEIPT_INVALID");
      }
      const quote = await readQuote(tx, authorization.tenantId, receipt.quote_id);
      if (!quote || quote.customerId !== normalized.customerId
        || quote.validUntil !== (normalized.validUntil ?? null)
        || quote.termStatus !== (normalized.termStatus ?? null)
        || quote.intakeSource !== (normalized.intakeSource ?? null)) throw new Error("QUOTE_CREATE_RECEIPT_READBACK_INVALID");
      return { code: "OK", quote, receipt: {
        receiptId: receipt.receipt_id, eventId: receipt.event_id, quoteId: receipt.quote_id, customerId: receipt.customer_id,
        actorId: receipt.actor_id, clientEventId: receipt.client_event_id, correlationId: receipt.correlation_id,
        recordedAt, aggregateVersion: 1,
      } };
    });
  } catch (error) {
    console.error("quote_create_receipt_read_failed", { message: diagnostic(error, "message"), details: diagnostic(error, "details"), hint: diagnostic(error, "hint") });
    return { code: "UNAVAILABLE", message: "Der gespeicherte KV-Stand konnte nicht sicher gelesen werden." };
  }
}

/** Read-only recovery for an interrupted KV edit using its original client event. */
export async function readQuoteUpdateReceiptCommand(
  authorization: QuoteCommandContext,
  input: unknown,
): Promise<ReadQuoteUpdateReceiptResult> {
  const normalized = normalizeUpdate(input);
  if (!normalized) return { code: "VALIDATION_ERROR", message: "Die gespeicherte KV-Änderung kann nicht sicher geprüft werden." };
  if (!authorization.capabilities.canReadQuote) return { code: "FORBIDDEN", message: "Der gespeicherte KV-Stand darf mit dieser Rolle nicht gelesen werden." };
  const intentSha256 = hashQuoteWriteIntent(normalized);
  try {
    return await withPrivilegedTenantTransaction(authorization, async (tx) => {
      const rows = await tx.execute<UpdateReceiptRow>(sql`
        SELECT * FROM private.v_quote_update_receipts_v1
        WHERE quote_id = ${normalized.quoteId}::uuid AND actor_id = ${authorization.userId}::uuid
          AND client_event_id = ${normalized.clientEventId}::uuid LIMIT 2
      `);
      if (rows.length === 0) return { code: "NOT_FOUND", message: "Zu dieser Änderung wurde noch kein sicherer KV-Stand gefunden." };
      const receipt = rows.length === 1 ? rows[0] : null;
      const recordedAt = receipt ? iso(receipt.recorded_at) : null;
      if (!receipt || receipt.integrity_ok !== true || receipt.tenant_id !== authorization.tenantId
        || receipt.quote_id !== normalized.quoteId || receipt.actor_id !== authorization.userId
        || receipt.client_event_id !== normalized.clientEventId || receipt.intent_sha256 !== intentSha256
        || receipt.expected_version !== normalized.expectedVersion || receipt.aggregate_version !== normalized.expectedVersion + 1 || !recordedAt) {
        throw new Error("QUOTE_UPDATE_RECEIPT_INVALID");
      }
      const quote = await readQuote(tx, authorization.tenantId, normalized.quoteId);
      if (!quote || quote.version !== receipt.aggregate_version) throw new Error("QUOTE_UPDATE_RECEIPT_READBACK_INVALID");
      return { code: "OK", quote, receipt: {
        receiptId: receipt.receipt_id, eventId: receipt.event_id, quoteId: receipt.quote_id, actorId: receipt.actor_id,
        clientEventId: receipt.client_event_id, correlationId: receipt.correlation_id, recordedAt,
        expectedVersion: receipt.expected_version, aggregateVersion: receipt.aggregate_version,
      } };
    });
  } catch (error) {
    console.error("quote_update_receipt_read_failed", { message: diagnostic(error, "message"), details: diagnostic(error, "details"), hint: diagnostic(error, "hint") });
    return { code: "UNAVAILABLE", message: "Der gespeicherte KV-Stand konnte nicht sicher gelesen werden." };
  }
}

export async function prepareQuoteConversionCommand(authorization: QuoteCommandContext, input: unknown,options:{transaction?:PrivilegedTenantTransaction;planOnly?:boolean;pendingGoodsId?:string;pendingAcceptance?:{edition:number;beforeVersion:number};pendingQuantities?:Array<{itemId:string;confirmed:boolean;expected:number;received:number|null}>}={}): Promise<PrepareQuoteConversionResult> {
  const normalized = normalizeConvert(input);
  if (!normalized) return { code: "VALIDATION_ERROR", message: "Beauftragungsdaten sind ungültig." };
  if (!authorization.capabilities.canConvertQuote) return { code: "FORBIDDEN", message: "KV darf mit dieser Rolle nicht beauftragt werden." };
  const intentSha256 = hashIntent(normalized);
  try {
    const run=async(tx:PrivilegedTenantTransaction):Promise<PrepareQuoteConversionResult>=>{
      await tx.execute(sql`SELECT id FROM private.quotes WHERE tenant_id=${authorization.tenantId} AND id=${normalized.quoteId}::uuid FOR UPDATE`);
      const quote = await readQuote(tx, authorization.tenantId, normalized.quoteId);
      if (!quote) return { code: "NOT_FOUND", message: "KV ist nicht verfügbar." };
      const pendingAcceptance=Boolean(options.planOnly&&options.pendingAcceptance&&quote.lifecycle&&!quote.linkedOrderId
        &&quote.version===options.pendingAcceptance.beforeVersion&&normalized.expectedVersion===quote.version+1
        &&quote.lifecycle.edition===options.pendingAcceptance.edition&&quote.lifecycle.sentEdition===quote.lifecycle.edition
        &&quote.lifecycle.stage!=='abgelaufen'&&!quote.lifecycle.declinedAt&&quote.lifecycle.conditional?.edition!==quote.lifecycle.edition);
      if(!quote.linkedOrderId&&quote.version+(pendingAcceptance?1:0)!==normalized.expectedVersion)return {code:'CONFLICT',message:'KV-Fassung wurde geaendert. Neu lesen und abgleichen.'};
      if(normalized.confirmedOrderDueDate!==quote.dueDate)return {code:"VALIDATION_ERROR",message:"Auftragstermin muss dem aktuellen KV-Termin entsprechen."};
      if(!normalized.goodsReceiptId)return {code:'VALIDATION_ERROR',message:`Auftrag entsteht mit dem Wareneingang · Ware zu KV ${quote.quoteNumber} annehmen`};
      if(!quote.lifecycle||!pendingAcceptance&&(quote.lifecycle.acceptedEdition!==quote.lifecycle.edition||!quote.lifecycle.acceptedAt||!quote.lifecycle.acceptanceEvidence?.trim())||quote.lifecycle.declinedAt)return {code:'VALIDATION_ERROR',message:'Aktuelle KV-Fassung ohne Vorbehalt zusagen; danach Ware zum Auftrag buchen.'};
      const goods=quote.lifecycle.goods?.find(row=>row.id===normalized.goodsReceiptId);
      if(goods?.blocked&&!pendingAcceptance){
        const reason=goods.deviations?.join(', ')||goods.procedureNote||SITUATION_COPY.goods.inspection(goods.condition??null,goods.packagesReceived??null,goods.packagesTotal??null);
        return {code:'VALIDATION_ERROR',message:QUOTE_CYCLE_COPY.retainedGoodsBlocked(reason)};
      }
      if((!goods&&!(options.planOnly&&!quote.linkedOrderId&&options.pendingGoodsId===normalized.goodsReceiptId))||(goods&&(goods.blocked&&!pendingAcceptance||goods.orderId!==quote.linkedOrderId)))return {code:'VALIDATION_ERROR',message:'Passender angenommener Warenbeleg fehlt oder ist gesperrt.'};
      if(quote.linkedOrderId){
        const prior=await tx.execute<{order_id:string;intent_sha256:string}>(sql`SELECT order_id,intent_sha256 FROM private.quote_conversion_receipts WHERE tenant_id=${authorization.tenantId} AND quote_id=${normalized.quoteId}::uuid AND actor_id=${authorization.userId}::uuid AND client_event_id=${normalized.clientEventId}::uuid`);
        if(prior.length!==1||prior[0].order_id!==quote.linkedOrderId||prior[0].intent_sha256!==intentSha256)return {code:'CONFLICT',message:'KV wurde bereits mit einer anderen Buchung zum Auftrag.'};
      }
      const sourceOrderInput: Omit<QuoteOrderInput, "handoverMode" | "paymentMode"> = {
        // The selected canonical goods record has passed the inspection.
        geprueft: true,
        clientEventId: normalized.clientEventId,
        customer: { mode: "EXISTING", customerId: quote.customerId },
        dueDate: quote.dueDate,
        termStatus: quote.termStatus === null ? null : "bestaetigt",
        intakeSource: quote.intakeSource,
        note: [quote.note,quote.lifecycle?.specialRequests?"Sonderwünsche: "+quote.lifecycle.specialRequests:null].filter(value=>value!==null).join(" · ").replace(/\s+/gu," ")||null,
        items: quote.positions.map(({ name, quantity, material, surfaceRequested }) => ({
          catalogServiceId: null,
          name, quantity, material, surfaceRequested,
          unit: null,
          unitPriceCents: null,
          vatRateBasisPoints: null,
        })),
      };
      // Only the current quote date may enter the immutable order intent.
      // A later quote-date amendment must be read before conversion.
      const storedQuantities=await readQuoteReceivedQuantities(tx,authorization.tenantId,quote.quoteId,normalized.goodsReceiptId);
      const pending=options.pendingGoodsId&&!quote.lifecycle.goods?.some(row=>row.id===options.pendingGoodsId)?options.pendingQuantities?.map(row=>({kv_position:quote.positions.find(position=>position.id===row.itemId)?.position,bestaetigt:row.confirmed?row.expected:row.received})):undefined;
      const received=pending?quote.positions.map(position=>({kv_position:position.position,bestaetigt:Number(storedQuantities?.find(row=>row.kv_position===position.position)?.bestaetigt??0)+Number(pending.find(row=>row.kv_position===position.position)?.bestaetigt??NaN)})):storedQuantities;
      if(!received||!received.some(row=>Number(row.bestaetigt)>0)||received.length!==quote.positions.length||received.some((row,index)=>!Number.isSafeInteger(row.bestaetigt)||Number(row.bestaetigt)<0||row.kv_position!==index+1))return {code:'VALIDATION_ERROR',message:'Angenommene Menge fuer jede KV-Position pruefen.'};
      const orderInput: QuoteOrderInput = {
        ...sourceOrderInput,
        items:sourceOrderInput.items.map((item,index)=>({...item,quantity:Number(received[index].bestaetigt)})).filter(item=>item.quantity>0),
        dueDate: normalized.confirmedOrderDueDate,
        handoverMode: normalized.handoverMode,
        paymentMode: normalized.paymentMode,
      };
      if(options.planOnly)return {code:"OK",quoteId:normalized.quoteId,orderInput,replayed:Boolean(quote.linkedOrderId)};
      const orderIntentSha256 = hashOrderIntent(orderInput);
      const rows = await tx.execute<{ result_code: string; order_input: unknown; replayed: boolean }>(sql`
        SELECT * FROM private.prepare_quote_conversion_v1(
          ${authorization.tenantId}, ${authorization.userId}::uuid, ${normalized.quoteId}::uuid,
          ${normalized.clientEventId}::uuid, ${intentSha256}, ${orderIntentSha256}, ${normalized.expectedVersion}
        )
      `);
      const result = rows.length === 1 ? rows[0] : null;
      if (!result || result.result_code !== "OK") {
        if (result?.result_code === "CONFLICT" || result?.result_code === "NOT_FOUND" || result?.result_code === "VALIDATION_ERROR") {
          return { code: result.result_code, message: result.result_code === "CONFLICT" ? "KV wurde bereits beauftragt oder zwischenzeitlich geändert." : result.result_code === "NOT_FOUND" ? "KV ist nicht verfügbar." : "Beauftragungsdaten sind ungültig." };
        }
        throw new Error("QUOTE_CONVERSION_PLAN_INVALID");
      }
      let persistedOrderInput: unknown = result.order_input;
      if (typeof persistedOrderInput === "string") {
        try {
          persistedOrderInput = JSON.parse(persistedOrderInput) as unknown;
        } catch {
          throw new Error("QUOTE_ORDER_INPUT_INVALID");
        }
      }
      // SQL preserves the current quote snapshot and immutable order-intent hash.
      // AF-7 rejects any different client date before this reservation exists.
      if (!plainObject(persistedOrderInput) || !plainObject(persistedOrderInput.customer)
        || persistedOrderInput.clientEventId !== normalized.clientEventId
        || persistedOrderInput.customer.mode !== "EXISTING" || persistedOrderInput.customer.customerId !== sourceOrderInput.customer.customerId
        || persistedOrderInput.dueDate !== sourceOrderInput.dueDate || persistedOrderInput.note !== quote.note
        || !Array.isArray(persistedOrderInput.items) || persistedOrderInput.items.length !== sourceOrderInput.items.length
        || !persistedOrderInput.items.every((item, index) => plainObject(item)
          && item.name === sourceOrderInput.items[index]?.name
          && item.quantity === sourceOrderInput.items[index]?.quantity
          && item.material === sourceOrderInput.items[index]?.material
          && item.surfaceRequested === sourceOrderInput.items[index]?.surfaceRequested)) throw new Error("QUOTE_ORDER_INPUT_INVALID");
      return { code: "OK", quoteId: normalized.quoteId, orderInput, replayed: result.replayed };
    };
    return options.transaction?await run(options.transaction):await withPrivilegedTenantTransaction(authorization,run);
  } catch (error) {
    console.error("quote_conversion_prepare_failed", { message: diagnostic(error, "message"), details: diagnostic(error, "details"), hint: diagnostic(error, "hint") });
    return { code: "UNAVAILABLE", message: "KV konnte nicht sicher beauftragt werden." };
  }
}

export async function readQuoteConversionReceiptCommand(
  authorization: QuoteCommandContext,
  input: { quoteId: string; clientEventId: string },
): Promise<ReadQuoteConversionReceiptResult> {
  if (!plainObject(input) || !exactKeys(input, ["clientEventId", "quoteId"]) || typeof input.quoteId !== "string" || !UUID_PATTERN.test(input.quoteId)
    || typeof input.clientEventId !== "string" || !UUID_PATTERN.test(input.clientEventId)) return { code: "VALIDATION_ERROR", message: "Receipt-Kennung ist ungültig." };
  if (!authorization.capabilities.canReadQuote) return { code: "FORBIDDEN", message: "Beauftragungsbeleg darf mit dieser Rolle nicht gelesen werden." };
  try {
    return await withPrivilegedTenantTransaction(authorization, async (tx) => {
      const rows = await tx.execute<ConversionReceiptRow>(sql`
        SELECT * FROM private.v_quote_conversion_receipts_v1
        WHERE quote_id = ${input.quoteId}::uuid AND actor_id = ${authorization.userId}::uuid
          AND client_event_id = ${input.clientEventId}::uuid LIMIT 2
      `);
      const row = rows.length === 1 ? rows[0] : null;
      const recordedAt = row ? iso(row.recorded_at) : null;
      const quote = await readQuote(tx, authorization.tenantId, input.quoteId);
      if (!row) return { code: "NOT_FOUND", message: "Beauftragungsbeleg ist nicht verfügbar." };
      if(quote&&row.integrity_ok===true&&row.tenant_id===authorization.tenantId&&row.order_id!==quote.linkedOrderId)return {code:'CONFLICT',message:'Diese Umwandlung wurde zurückgenommen. Der alte Auftrag bleibt im Verlauf erhalten.'};
      if (!quote || row.integrity_ok !== true || row.tenant_id !== authorization.tenantId || row.quote_version !== quote.version
        || row.quote_id !== quote.quoteId || row.order_id !== quote.linkedOrderId || !recordedAt) throw new Error("QUOTE_CONVERSION_RECEIPT_INVALID");
      const receipt: QuoteConversionReceipt = {
        receiptId: row.receipt_id, eventId: row.event_id, quoteId: row.quote_id, customerId: row.customer_id,
        orderId: row.order_id, orderIntakeEventId: row.order_intake_event_id, actorId: row.actor_id,
        clientEventId: row.client_event_id, correlationId: row.correlation_id, recordedAt, aggregateVersion: row.quote_version,
      };
      return { code: "OK", receipt, quote };
    });
  } catch (error) {
    console.error("quote_conversion_receipt_failed", { message: diagnostic(error, "message"), details: diagnostic(error, "details"), hint: diagnostic(error, "hint") });
    return { code: "UNAVAILABLE", message: "Beauftragungsbeleg konnte nicht sicher gelesen werden." };
  }
}


type CalculationSnapshot={hours:string|null;hourlyRateCents:number|null;setupCents:number|null;materialCents:number|null;edition:number;sentEdition:number|null};
async function readCalculationSnapshot(tx:PrivilegedTenantTransaction,tenantId:string,quoteId:string):Promise<CalculationSnapshot|null>{
 const rows=await tx.execute<CalculationSnapshot>(sql`SELECT kalk_stunden::text AS hours,stundensatz_cents::float8 AS "hourlyRateCents",ruest_cents::float8 AS "setupCents",material_cents::float8 AS "materialCents",fassung AS edition,gesendet_fassung AS "sentEdition" FROM private.quotes WHERE tenant_id=${tenantId} AND id=${quoteId}::uuid FOR UPDATE`);
 return rows.length===1?rows[0]:null;
}
async function writeCalculationSnapshot(tx:PrivilegedTenantTransaction,auth:QuoteCommandContext,quoteId:string,requestKey:string,calculation:QuoteCalculation,before:CalculationSnapshot|null){
 const changed=before!==null&&(before.hours===null||Number(before.hours)!==Number(calculation.hours)||before.hourlyRateCents!==calculation.hourlyRateCents||before.setupCents!==calculation.setupCents||before.materialCents!==calculation.materialCents);
 const rows=await tx.execute<{edition:number;version:number}>(sql`UPDATE private.quotes SET kalk_stunden=${calculation.hours}::numeric,stundensatz_cents=${calculation.hourlyRateCents},ruest_cents=${calculation.setupCents},material_cents=${calculation.materialCents},fassung=CASE WHEN ${changed&&before?.sentEdition!==null} AND fassung=${before?.edition??null} THEN fassung+1 ELSE fassung END WHERE tenant_id=${auth.tenantId} AND id=${quoteId}::uuid RETURNING fassung AS edition,version`);
 if(rows.length!==1)throw Error('QUOTE_CALCULATION_WRITE_FAILED');
 await appendQuoteJournal(tx,auth,{id:randomUUID(),type:'QUOTE_CALCULATION_V04',clientEventId:randomUUID(),correlationId:randomUUID(),version:rows[0].version,description:'KV-Kalkulation in derselben Speicherung gesichert',payload:{quoteId,requestKey,edition:rows[0].edition,before,after:calculation}});
}

/** Copy the stored integer input alongside its exact total, never reverse-round the display price. */
export async function readQuoteCopyCommand(authorization: QuoteCommandContext, input: { quoteId: string }) {
 if (!plainObject(input) || !exactKeys(input,['quoteId']) || typeof input.quoteId!=='string' || !UUID_PATTERN.test(input.quoteId)) return {code:'VALIDATION_ERROR' as const,message:'KV-Kennung ist ungueltig.'};
 if (!authorization.capabilities.canReadQuote) return {code:'FORBIDDEN' as const,message:'KV darf nicht gelesen werden.'};
 try {
  return await withPrivilegedTenantTransaction(authorization,async tx=>{
   const quote=await readQuote(tx,authorization.tenantId,input.quoteId);
   if(!quote)return {code:'NOT_FOUND' as const,message:'KV ist nicht verfuegbar.'};
   const rows=await tx.execute<{position:number;unitPriceCents:number;lineTotalCents:number;storedLineTotalCents:number|null}>(sql`SELECT position,unit_price_cents::float8 AS "unitPriceCents",zeilen_gesamt_cents::float8 AS "storedLineTotalCents",coalesce(zeilen_gesamt_cents,line_total_cents)::float8 AS "lineTotalCents" FROM private.quote_positions WHERE tenant_id=${authorization.tenantId} AND quote_id=${input.quoteId}::uuid AND revision=${quote.version} ORDER BY position`);
   if(rows.length!==quote.positions.length||rows.some((row,index)=>row.position!==quote.positions[index].position||!Number.isSafeInteger(row.unitPriceCents)||row.unitPriceCents<0||row.lineTotalCents!==quote.positions[index].lineTotalCents))throw Error('QUOTE_COPY_SOURCE_INVALID');
   return {code:'OK' as const,quote,storedLineTotals:rows.map(row=>row.storedLineTotalCents),positions:quote.positions.map((position,index)=>({name:position.name,quantity:position.quantity,material:position.material,surfaceRequested:position.surfaceRequested,unitPriceCents:rows[index].unitPriceCents,lineTotalCents:rows[index].lineTotalCents}))};
  });
 }catch(error){console.error('[QUOTE_COPY_READ_FAILED]',error);return {code:'UNAVAILABLE' as const,message:'KV-Kopiervorlage konnte nicht sicher gelesen werden.'};}
}
