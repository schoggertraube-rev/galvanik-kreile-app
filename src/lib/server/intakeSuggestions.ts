import "server-only";

import { sql } from "drizzle-orm";
import type { AuthorizationSnapshot } from "@/lib/server/authorization";
import { withPrivilegedTenantTransaction } from "@/lib/server/privilegedDb";
import { isWorkingDay, berlinCalendarDay, plusWorkingDays, previousWorkingDay, workingDaysBetween } from "@/lib/domain/workingDays";
import { normaliseOrderPositionSurface, normaliseOrderPositionUnit, orderPositionQuantityError } from "@/lib/orderPositionContract";
import type {
  IntakePriceCase,
  IntakePriceSuggestion,
  IntakeSuggestionPositionInput,
  IntakeSuggestions,
  IntakeSuggestionsInput,
  IntakeTermSuggestion,
} from "@/lib/intakeSuggestionsContract";

export type { IntakeSuggestions, IntakeSuggestionsInput } from "@/lib/intakeSuggestionsContract";

type CatalogRow = {
  id: string;
  name: string;
  surface: string;
  unit: string;
  net_price_cents: number | string;
  standard_lead_time_working_days: number | string;
};

type HistoryRow = {
  customer_id: string;
  customer_name: string;
  item_name: string;
  catalog_service_id: string | null;
  surface_requested: string;
  unit: string | null;
  quantity: number | string;
  unit_price_cents: number | string;
  invoice_date: string;
};

type PriceCandidate = {
  customerId: string;
  customerName: string;
  name: string;
  catalogServiceId: string | null;
  surface: string;
  unit: string | null;
  quantity: number;
  unitPriceCents: number;
  invoiceDate: string;
};

const SURFACE_LEAD_DAYS: Readonly<Record<string, number>> = {
  verchromen: 5,
  vernickeln: 4,
  verzinken: 3,
};

function integer(value: number | string, code: string): number {
  const parsed = typeof value === "number" ? value : Number(value);
  if (!Number.isSafeInteger(parsed)) throw new Error(code);
  return parsed;
}

function normalized(value: string): string {
  return value
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLocaleLowerCase("de-DE")
    .replace(/[^a-z0-9]+/g, " ")
    .trim()
    .replace(/\s+/g, " ");
}

function normalizedUnit(value: string | null): string | null {
  if (value === null || !value.trim()) return null;
  const key = normaliseOrderPositionUnit(value.trim());
  if (!key) throw new Error("INTAKE_POSITION_UNIT_UNKNOWN");
  return key;
}

function quantity(value: number | string, unit: string | null): number {
  const parsed = Number(value);
  if (orderPositionQuantityError(parsed, unit)) throw new Error("INTAKE_HISTORY_QUANTITY_INVALID");
  return parsed;
}

function lineAmountCents(unitPriceCents: number, amount: number): number {
  // Three-decimal quantities use integer thousandths, matching PostgreSQL's positive numeric rounding.
  const scaled = unitPriceCents * Math.round(amount * 1000);
  if (!Number.isSafeInteger(scaled)) throw new Error("INTAKE_LINE_AMOUNT_INVALID");
  return Math.round(scaled / 1000);
}

function sharedWord(left: string, right: string): boolean {
  const rightWords = new Set(normalized(right).split(" ").filter((word) => word.length >= 4));
  return normalized(left).split(" ").some((word) => word.length >= 4 && rightWords.has(word));
}

function samePart(position: IntakeSuggestionPositionInput, candidate: PriceCandidate): boolean {
  return position.catalogServiceId
    ? position.catalogServiceId === candidate.catalogServiceId
    : candidate.catalogServiceId === null && normalized(position.name) === normalized(candidate.name);
}

function sameSurfaceAndUnit(position: IntakeSuggestionPositionInput, candidate: PriceCandidate): boolean {
  return normalized(position.surfaceRequested) === normalized(candidate.surface)
    && normalizedUnit(position.unit) === normalizedUnit(candidate.unit);
}

function priceCase(candidate: PriceCandidate, kind: "gleich" | "aehnlich"): IntakePriceCase {
  return {
    kind,
    customerName: candidate.customerName,
    partName: candidate.name,
    surface: candidate.surface,
    quantity: candidate.quantity,
    invoiceDate: candidate.invoiceDate,
    unitPriceCents: candidate.unitPriceCents,
  };
}

export function choosePriceSuggestion(
  position: IntakeSuggestionPositionInput,
  customerId: string | null,
  history: PriceCandidate[],
  catalog: CatalogRow | null,
): IntakePriceSuggestion | null {
  const equal = customerId
    ? history.filter((candidate) => candidate.customerId === customerId && sameSurfaceAndUnit(position, candidate) && samePart(position, candidate))
    : [];
  if (equal[0]) {
    const unitPriceCents = equal[0].unitPriceCents;
    return {
      positionKey: position.key,
      source: "gleich",
      unit: normalizedUnit(position.unit) ?? normalizedUnit(equal[0].unit),
      unitPriceCents,
      lineTotalCents: lineAmountCents(unitPriceCents, position.quantity),
      caseCount: equal.length,
      cases: equal.slice(0, 5).map((candidate) => priceCase(candidate, "gleich")),
    };
  }

  const similar = history.filter((candidate) => sameSurfaceAndUnit(position, candidate)
    && (position.catalogServiceId
      ? position.catalogServiceId === candidate.catalogServiceId
      : candidate.catalogServiceId === null && sharedWord(position.name, candidate.name)));
  if (similar.length >= 3) {
    const prices = similar.map((candidate) => candidate.unitPriceCents).sort((a, b) => a - b);
    const middle = Math.floor(prices.length / 2);
    const unitPriceCents = prices.length % 2 === 1 ? prices[middle] : Math.round((prices[middle - 1] + prices[middle]) / 2);
    return {
      positionKey: position.key,
      source: "aehnlich",
      unit: normalizedUnit(position.unit) ?? normalizedUnit(similar[0].unit),
      unitPriceCents,
      lineTotalCents: lineAmountCents(unitPriceCents, position.quantity),
      caseCount: similar.length,
      cases: similar.slice(0, 5).map((candidate) => priceCase(candidate, "aehnlich")),
    };
  }

  if (!catalog) return null;
  const unitPriceCents = integer(catalog.net_price_cents, "INTAKE_CATALOG_PRICE_INVALID");
  return {
    positionKey: position.key,
    source: "katalog",
    unit: normalizedUnit(catalog.unit),
    unitPriceCents,
    lineTotalCents: lineAmountCents(unitPriceCents, position.quantity),
    caseCount: 1,
    cases: [{
      kind: "katalog",
      customerName: "Leistungskatalog",
      partName: catalog.name,
      surface: catalog.surface,
      quantity: null,
      invoiceDate: null,
      unitPriceCents,
    }],
  };
}

export type IntakeSchedulingSettings={handoverBufferDays:number;fitsPercent:number;tightPercent:number;priorityPercent:number};
export type IntakeCapacityOrder={intakeDate:string;dueDate:string;valueCents:number};
const addDays=(date:string,count:number)=>new Date(Date.parse(date+"T00:00:00Z")+count*86_400_000).toISOString().slice(0,10);
const weekStart=(date:string)=>addDays(date,-((new Date(date+"T00:00:00Z").getUTCDay()+6)%7));
function workdaysInclusive(from:string,to:string){const dates:string[]=[];for(let date=from;date<=to;date=addDays(date,1))if(isWorkingDay(date))dates.push(date);return dates;}

/** The single scheduling kernel: calendar helpers, order load and the proposed order. */
export function calculateTermSuggestion(input:{today:string;wishDate:string|null;positions:IntakeSuggestionPositionInput[];catalogById:ReadonlyMap<string,CatalogRow>;dailyOutputEur:number;settings:IntakeSchedulingSettings;openOrders:IntakeCapacityOrder[];priority:boolean;processingWeeks?:number|null;kind?:"ORDER"|"QUOTE"}):IntakeTermSuggestion|null{
 const eligible=input.positions.filter(position=>normaliseOrderPositionSurface(position.surfaceRequested)!=="offen");
 if(!eligible.length)return null;
 let lead=0,leadSurface=eligible[0].surfaceRequested;
 for(const position of eligible){
  const catalog=position.catalogServiceId?input.catalogById.get(position.catalogServiceId):undefined;
  const days=catalog?.standard_lead_time_working_days!=null?integer(catalog.standard_lead_time_working_days,"INTAKE_CATALOG_LEAD_INVALID"):SURFACE_LEAD_DAYS[normalized(position.surfaceRequested)]??3;
  if(days>=lead){lead=days;leadSurface=position.surfaceRequested;}
 }
 const value=input.positions.reduce((sum,position)=>sum+lineAmountCents(position.unitPriceCents??0,position.quantity),0);
 const plan=input.kind==="QUOTE"?input.positions.reduce((sum,position)=>sum+(position.effortMinutes??0),0):0;
 const effort=Math.max(1,Math.ceil(Math.max(value/(input.dailyOutputEur*100),plan/420)));
 const estimatedWeeks=Math.ceil((1+lead+effort)/5),weeks=input.processingWeeks??estimatedWeeks;
 const leadDate=plusWorkingDays(input.today,1+lead),baseDate=plusWorkingDays(input.today,1+lead+effort+input.settings.handoverBufferDays),weeksDate=plusWorkingDays(input.today,weeks*5);
 if(!leadDate||!baseDate||!weeksDate)throw Error("INTAKE_TERM_CALENDAR_INVALID");
 const minimum=baseDate>weeksDate?baseDate:weeksDate,horizon=addDays(input.today,26*7),limit=input.priority?input.settings.priorityPercent:input.settings.tightPercent;
 const existing=new Map<string,number>();
 const allocate=(map:Map<string,number>,start:string,end:string,amount:number)=>{
  if(end<input.today){const week=weekStart(input.today);map.set(week,(map.get(week)??0)+amount);return;}
  const dates=workdaysInclusive(start<input.today?input.today:start,end);
  if(!dates.length){const week=weekStart(end);map.set(week,(map.get(week)??0)+amount);return;}
  for(const day of dates){const week=weekStart(day);map.set(week,(map.get(week)??0)+amount/dates.length);}
 };
 for(const order of input.openOrders)allocate(existing,order.intakeDate,order.dueDate,order.valueCents);
 const utilization=(date:string)=>{
  const week=weekStart(date),days=workdaysInclusive(week,addDays(week,6)).length;
  if(!days)return null;
  const proposed=new Map<string,number>();allocate(proposed,input.today,date,value);
  return ((existing.get(week)??0)+(proposed.get(week)??0))/(input.dailyOutputEur*100*days)*100;
 };
 const find=(from:string)=>{
  for(let date=from<minimum?minimum:from;date<=horizon;date=addDays(date,1)){
   if(!isWorkingDay(date))continue;const load=utilization(date);if(load!==null&&load<=limit)return date;
  }return null;
 };
 const achievableDate=find(minimum),effectiveWish=input.wishDate?previousWorkingDay(input.wishDate):null;
 const bufferWorkingDays=achievableDate&&effectiveWish?workingDaysBetween(achievableDate,effectiveWish):null;
 const wishLoad=effectiveWish?utilization(effectiveWish):null;
 const rating=!input.wishDate?null:effectiveWish&&effectiveWish<leadDate?"unmoeglich" as const:!achievableDate||!effectiveWish||effectiveWish<achievableDate||wishLoad===null||wishLoad>limit?"nicht_machbar" as const:bufferWorkingDays!==null&&(bufferWorkingDays<=2||wishLoad>input.settings.fitsPercent)?"knapp" as const:"passt" as const;
 const proposals:NonNullable<IntakeTermSuggestion["proposals"]>=[];
 if(achievableDate)for(const [id,title,offset]of [["schnell","Schnell",0],["empfohlen","Empfohlen",7],["entspannt","Entspannt",14]] as const){
  const date=find(addDays(achievableDate,offset));if(date){const load=utilization(date);if(load!==null)proposals.push({id,title,date,utilization:Math.round(load),rating:load<=input.settings.fitsPercent?"Luft":"voll"});}
 }
 return {achievableDate,wishDate:input.wishDate,rating,bufferWorkingDays,estimatedWeeks,proposals,
  offerDate:input.wishDate?find(input.wishDate):achievableDate,
  ...(!achievableDate?{unavailableReason:"Kein Termin in den nächsten 26 Wochen – Rücksprache"}:{}),
  reasons:[{kind:"lead",text:leadSurface+": "+lead+" Arbeitstage Durchlauf"},{kind:"effort",text:effort+" Aufwandstage"},...(effectiveWish&&wishLoad!==null?[{kind:"capacity" as const,text:"Auslastung der Woche: "+Math.round(wishLoad)+" %"}]:[])]};
}

function validInput(input: IntakeSuggestionsInput): boolean {
  return (input.customerId === null || /^[0-9a-f-]{36}$/i.test(input.customerId))
    && (input.wishDate === null || /^\d{4}-\d{2}-\d{2}$/.test(input.wishDate))
    && (input.handoverMode===undefined||input.handoverMode===null||input.handoverMode==="pickup"||input.handoverMode==="shipping")
    && (input.processingWeeks==null||[1,2,3,5].includes(input.processingWeeks))
    && input.positions.length >= 1
    && input.positions.length <= 20
    && input.positions.every((position) => position.key.length >= 1
      && position.key.length <= 80
      && (position.catalogServiceId === null || /^[0-9a-f-]{36}$/i.test(position.catalogServiceId))
      && position.name.trim().length >= 2
      && position.name.trim().length <= 160
      && orderPositionQuantityError(position.quantity, position.unit) === null
      && normaliseOrderPositionSurface(position.surfaceRequested) !== null
      && (position.unit === null || normaliseOrderPositionUnit(position.unit) !== null)
      && (position.unitPriceCents === null || Number.isSafeInteger(position.unitPriceCents) && position.unitPriceCents >= 0));
}

export async function readIntakeSuggestions(
  authorization: AuthorizationSnapshot,
  input: IntakeSuggestionsInput,
): Promise<IntakeSuggestions> {
  if (!validInput(input)) throw new Error("INTAKE_SUGGESTION_INPUT_INVALID");
  const canReadMoney = authorization.areas?.includes("geld") === true;

  return withPrivilegedTenantTransaction(authorization, async (tx) => {
    const [settings, catalogRows, historyRows, capacityRows,customerRows] = await Promise.all([
      tx.execute<{ tagesleistung_eur: number | string;uebergabepuffer_tage:number;auslastung_passt_pct:number;auslastung_knapp_pct:number;auslastung_vorrang_pct:number }>(sql`
        SELECT tagesleistung_eur,uebergabepuffer_tage,auslastung_passt_pct,auslastung_knapp_pct,auslastung_vorrang_pct
        FROM public.company_settings
        WHERE tenant_id = ${authorization.tenantId}
        ORDER BY updated_at DESC, id
        LIMIT 2
      `),
      tx.execute<CatalogRow>(sql`
        SELECT id::text, name, surface, unit, net_price_cents, standard_lead_time_working_days
        FROM public.catalog_services
        WHERE tenant_id = ${authorization.tenantId}
          AND active = true
        ORDER BY name, surface, id
      `),
      canReadMoney ? tx.execute<HistoryRow>(sql`
        SELECT invoice.customer_id::text AS customer_id,
               coalesce(nullif(invoice.snapshot->'customer'->>'companyName', ''), invoice.snapshot->'customer'->>'name') AS customer_name,
               item.name AS item_name,
               item.catalog_service_id::text AS catalog_service_id,
               item.surface_requested,
               item.unit,
               item.quantity,
               (line.value->>'unitNetAmountCents')::bigint AS unit_price_cents,
               to_char(invoice.issued_at AT TIME ZONE 'Europe/Berlin', 'YYYY-MM-DD') AS invoice_date
        FROM public.invoices invoice
        CROSS JOIN LATERAL jsonb_array_elements(invoice.snapshot->'lines') line(value)
        JOIN public.items item
          ON item.tenant_id = invoice.tenant_id
         AND item.id = line.value->>'itemId'
        WHERE invoice.tenant_id = ${authorization.tenantId}
          AND invoice.contract_version = 1
          AND invoice.status = 'issued'
          AND invoice.cancelled_at IS NULL
          AND invoice.issued_at >= statement_timestamp() - interval '24 months'
          AND jsonb_typeof(invoice.snapshot->'lines') = 'array'
          AND jsonb_typeof(line.value->'unitNetAmountCents') = 'number'
          AND item.surface_requested IS NOT NULL
        ORDER BY invoice.issued_at DESC, invoice.id, item.id
        LIMIT 500
      `) : Promise.resolve([]),
      tx.execute<{intakeDate:string;dueDate:string;valueCents:number|string}>(sql`SELECT coalesce(order_record.intake_date::date,order_record.created_at::date)::text AS "intakeDate",order_record.due_date::date::text AS "dueDate",coalesce(sum(round(position.quantity*position.preis_netto*100)),0)::bigint AS "valueCents"
       FROM public.orders order_record LEFT JOIN public.items position ON position.tenant_id=order_record.tenant_id AND position.order_id=order_record.id
       WHERE order_record.tenant_id=${authorization.tenantId} AND order_record.due_date IS NOT NULL AND order_record.station IN ('angenommen','galvanik') AND order_record.status<>'storniert'
       GROUP BY order_record.id,order_record.intake_date,order_record.created_at,order_record.due_date`),
      input.customerId?tx.execute<{vorrang:boolean}>(sql`SELECT vorrang FROM public.customers WHERE tenant_id=${authorization.tenantId} AND id=${input.customerId}`):Promise.resolve([]),
    ]);

    if (settings.length !== 1) throw new Error("INTAKE_DAILY_OUTPUT_MISSING_OR_AMBIGUOUS");
    const dailyOutputEur = integer(settings[0].tagesleistung_eur, "INTAKE_DAILY_OUTPUT_INVALID");
    if (dailyOutputEur < 1 || dailyOutputEur > 99_999) throw new Error("INTAKE_DAILY_OUTPUT_INVALID");
    const catalogById = new Map(catalogRows.map((row) => [row.id, row]));
    const history: PriceCandidate[] = historyRows.map((row) => ({
      customerId: row.customer_id,
      customerName: row.customer_name,
      name: row.item_name,
      catalogServiceId: row.catalog_service_id,
      surface: row.surface_requested,
      unit: normalizedUnit(row.unit),
      quantity: quantity(row.quantity, row.unit),
      unitPriceCents: integer(row.unit_price_cents, "INTAKE_HISTORY_PRICE_INVALID"),
      invoiceDate: row.invoice_date,
    }));

    return {
      term: input.handoverMode===null?null:calculateTermSuggestion({
        today: berlinCalendarDay(),
        wishDate: input.wishDate,
        positions: input.positions.map(position=>!canReadMoney&&position.catalogServiceId?{...position,unitPriceCents:catalogById.has(position.catalogServiceId)?Number(catalogById.get(position.catalogServiceId)!.net_price_cents):null}:position),
        catalogById,
        dailyOutputEur,
        settings:{handoverBufferDays:settings[0].uebergabepuffer_tage,fitsPercent:settings[0].auslastung_passt_pct,tightPercent:settings[0].auslastung_knapp_pct,priorityPercent:settings[0].auslastung_vorrang_pct},
        openOrders:capacityRows.map(row=>({...row,valueCents:Number(row.valueCents)})),priority:customerRows[0]?.vorrang===true,processingWeeks:input.processingWeeks,kind:input.kind,
      }),
      prices: canReadMoney
        ? input.positions.flatMap((position) => {
            const suggestion = choosePriceSuggestion(
              position,
              input.customerId,
              history,
              position.catalogServiceId ? catalogById.get(position.catalogServiceId) ?? null : null,
            );
            return suggestion ? [suggestion] : [];
          })
        : [],
    };
  });
}
