import {hasAuthorizationArea} from '@/lib/auth/authorizationContract';
import {formatEuro} from '@/lib/domain/formatEuro';
import "server-only";
import {readOpenOrderComplaint,readOpenOrderComplaintsBatch} from './orderReleaseRead';

import { sql } from "drizzle-orm";
import {type AuthorizationSnapshot} from "@/lib/server/authorization";
import {type AuthorizedReadContext} from './authorizationReadContext';
import {
  canReadPaymentSummary,
  paymentReadAuthorization,
  type PaymentReadAuthorization,
  mapOrderPaymentStateRow,
  mapPaymentSummaryRow,
  readOrderPaymentSummaries,
  type OrderPaymentState,
  type OrderPaymentStateRow,
  type PaymentSummary,
  type PaymentSummaryRow,
} from "@/lib/server/paymentContract";
import { withPrivilegedTenantTransaction,withTenantSavepoint,type PrivilegedTenantTransaction } from "@/lib/server/privilegedDb";
import type {CustomerCreditResult,CustomerCreditApplicationRead} from '@/modules/accounting/public';
import {CUSTOMER_CREDIT_COPY} from '@/ui/situationCatalog';
import {SHIPPING_FEE_COPY} from '@/ui/situationCatalog';

export type PaymentSummaryReadResult =
  | { code: "OK"; data: PaymentSummary[] }
  | { code: "FORBIDDEN"; message: string }
  | { code: "UNAVAILABLE"; message: string };

export type OrderPaymentStateReadResult =
  | { code: "OK"; data: OrderPaymentState & {creditApplication?:CustomerCreditApplicationRead;complaintHold:{blocked:boolean;reason:'open_complaint';complaintIds:string[]};customerDeliveryBlock:{blocked:boolean;reason:'overdue_invoice';invoiceIds:string[]}} }
  | { code: "NOT_FOUND"; message: string }
  | { code: "FORBIDDEN"; message: string }
  | { code: "VALIDATION_ERROR"; message: string }
  | { code: "UNAVAILABLE"; message: string };

const ORDER_ID_PATTERN = /^[A-Za-z0-9][A-Za-z0-9._:-]{0,127}$/;

/** Credit belongs only to the existing payment area. Other payment facts and
 * their physical release blocks remain exactly the already qualified result. */
/** Existing credit visibility, shared by the live reader and its model mask. */
export function canReadOrderPaymentCredit(authorization:AuthorizationSnapshot|Pick<AuthorizedReadContext,'canReadArea'>){
 return 'canReadArea'in authorization?authorization.canReadArea('zahlungen'):hasAuthorizationArea(authorization,'zahlungen');
}

export function maskOrderPaymentCredit(authorization:AuthorizationSnapshot|Pick<AuthorizedReadContext,'canReadArea'>,source:OrderPaymentStateReadResult):OrderPaymentStateReadResult{
 if(source.code!=='OK'||canReadOrderPaymentCredit(authorization)||!Object.hasOwn(source.data,'creditApplication'))return source;
 const data={...source.data};
 delete data.creditApplication;
 return {...source,data};
}

/** The same canonical credit proposal for a payment view and a blocked output.
 * Both sources have already been tenant- and money-authorized by their reader. */
export function buildCustomerCreditApplication(source:CustomerCreditResult,payment:PaymentSummary|null):CustomerCreditApplicationRead{
 if(source.code!=='OK')return {code:'SOURCE_INCOMPLETE'};
 const amount=payment?Math.min(source.credit.balanceCents,payment.openAmountCents):0;
 return {code:'OK',credit:source.credit,proposal:payment&&amount>0?{label:CUSTOMER_CREDIT_COPY.applyLabel(formatEuro(amount),payment.invoiceNumber),command:'credit.apply',input:{invoiceId:payment.invoiceId,amount,expectedVersion:payment.paymentVersion,expectedOpenAmountCents:payment.openAmountCents,expectedCreditVersion:source.credit.version}}:null};
}

function readDiagnostic(error: unknown, key: "message" | "details" | "hint"): string | null {
  if (!error || typeof error !== "object") return null;
  const value = (error as Record<string, unknown>)[key];
  return typeof value === "string" && value.trim() ? value.slice(0, 500) : null;
}

function logReadFailure(label: string, error: unknown): void {
  console.error(label, {
    message: readDiagnostic(error, "message"),
    details: readDiagnostic(error, "details"),
    hint: readDiagnostic(error, "hint"),
  });
}

export async function readPaymentSummary(
  authorization: AuthorizationSnapshot|PaymentReadAuthorization,
): Promise<PaymentSummaryReadResult> {
  const readAuth='canReadSummary'in authorization?authorization:paymentReadAuthorization(authorization);
  if (!canReadPaymentSummary(readAuth)) {
    return { code: "FORBIDDEN", message: "Zahlungsübersicht ist mit dieser Rolle nicht erlaubt." };
  }

  try {
    const data = await withPrivilegedTenantTransaction(authorization, async (tx) => {
      const rows = await tx.execute<PaymentSummaryRow>(sql`
        SELECT *
        FROM private.v_payment_summary_v1
        ORDER BY invoice_number DESC NULLS LAST, invoice_id
        LIMIT 251
      `);
      if (rows.length > 250) throw new Error("PAYMENT_SUMMARY_AMBIGUOUS");
      return rows.map((row) => mapPaymentSummaryRow(row, readAuth));
    });
    return { code: "OK", data };
  } catch (error) {
    logReadFailure("readPaymentSummary database error", error);
    return { code: "UNAVAILABLE", message: "Zahlungsübersicht konnte nicht sicher geladen werden." };
  }
}

type PaymentStateSourceRow=OrderPaymentStateRow & {credit_customer_id:string;customer_overdue_invoice_ids:string[]};
type CreditSourceRead=(tx:PrivilegedTenantTransaction,tenantId:string,customerId:string)=>Promise<CustomerCreditResult>;

async function qualifyPaymentState(tx:PrivilegedTenantTransaction,authorization:PaymentReadAuthorization,rows:PaymentStateSourceRow[],complaint:Awaited<ReturnType<typeof readOpenOrderComplaint>>,readCredit?:CreditSourceRead){
      if (rows.length === 0) return null;
      if (rows.length !== 1 || !rows[0]) throw new Error("ORDER_PAYMENT_STATE_AMBIGUOUS");
      if (!Array.isArray(rows[0].customer_overdue_invoice_ids) || rows[0].customer_overdue_invoice_ids.some(id=>typeof id!=='string'||!/^[0-9a-f-]{36}$/.test(id))) throw new Error("ORDER_CUSTOMER_DEBT_STATE_INVALID");
      const paymentContext={orderId:rows[0].order_id,mode:rows[0].payment_mode,station:rows[0].station};
      if(!canReadPaymentSummary(authorization,paymentContext))return {code:"FORBIDDEN" as const};
      const mapped = mapOrderPaymentStateRow(rows[0], authorization);
      const additionalPayments:NonNullable<OrderPaymentState['additionalPayments']>=[];
      if(Number(rows[0].active_invoice_count)>1){
        const payments=await readOrderPaymentSummaries(tx,authorization.tenantId,mapped.orderId);
        if(payments.length!==Number(rows[0].active_invoice_count)||!mapped.payment)throw Error('ORDER_ADDITIONAL_PAYMENTS_SOURCE_MISSING');
        const checked=payments.map(row=>mapPaymentSummaryRow(row,authorization,paymentContext));
        if(checked.filter(payment=>payment.invoiceId===mapped.payment!.invoiceId).length!==1)throw Error('ORDER_MAIN_PAYMENT_SOURCE_MISSING');
        for(const payment of checked){
          if(payment.invoiceId===mapped.payment.invoiceId)continue; // known main, projected above
          const source=payments.filter(row=>row.invoice_id===payment.invoiceId);
          if(source.length!==1||source[0].belegart!=='versandkosten'||!source[0].ursprung_rechnung_id
            ||!source[0].ursprung_rechnung_nummer)throw Error('ORDER_ADDITIONAL_INVOICE_ORIGIN_MISSING');
          additionalPayments.push({...payment,belegart:'versandkosten',ursprungRechnungId:source[0].ursprung_rechnung_id,
            ursprungRechnungNummer:source[0].ursprung_rechnung_nummer,label:SHIPPING_FEE_COPY.relatedInvoice(source[0].ursprung_rechnung_nummer)});
        }
      }
      let creditApplication:CustomerCreditApplicationRead|undefined;
      if(readCredit){
        try{
          const source=await readCredit(tx,authorization.tenantId,rows[0].credit_customer_id);
          creditApplication=buildCustomerCreditApplication(source,mapped.payment);
        }catch{creditApplication={code:'SOURCE_INCOMPLETE'};}
      }
      return { ...mapped,...(additionalPayments.length?{additionalPayments}:{}),...(creditApplication?{creditApplication}:{}),complaintHold:{blocked:complaint!==null,reason:'open_complaint' as const,complaintIds:complaint?.complaintIds??[]}, customerDeliveryBlock:{blocked:rows[0].payment_mode!=="keiner"&&rows[0].customer_overdue_invoice_ids.length>0,reason:'overdue_invoice' as const,invoiceIds:rows[0].customer_overdue_invoice_ids} };
}
async function readPaymentStateGroup(authorization:PaymentReadAuthorization,orderIds:string[],readCredit?:CreditSourceRead){
 return withPrivilegedTenantTransaction(authorization,async tx=>{
  const grouped=new Map<string,PaymentStateSourceRow[]>(orderIds.map(orderId=>[orderId,[]]));
  {
   const requested=sql`ARRAY[${sql.join(orderIds.map(orderId=>sql`${orderId}`),sql`, `)}]::text[]`;
   const records=await tx.execute<PaymentStateSourceRow & {batch_order_id:string}>(sql`SELECT * FROM private.read_order_payment_states_v1(${authorization.tenantId},${requested})`);
   const seen=new Set<string>();
   for(const record of records){
    const rows=grouped.get(record.batch_order_id);if(!rows)throw Error("ORDER_PAYMENT_STATE_AMBIGUOUS");seen.add(record.batch_order_id);
    if(record.order_id===null)continue; // explicit empty LEFT JOIN, not an unreadable source
    if(record.order_id!==record.batch_order_id)throw Error("ORDER_PAYMENT_STATE_AMBIGUOUS");
    const {batch_order_id,...source}=record;void batch_order_id;rows.push(source);
   }
   if(seen.size!==orderIds.length)throw Error("ORDER_PAYMENT_STATE_AMBIGUOUS");
  }
  const eligible=orderIds.filter(id=>{const rows=grouped.get(id);return rows?.length===1&&canReadPaymentSummary(authorization,{orderId:rows[0].order_id,mode:rows[0].payment_mode,station:rows[0].station});});
  const eligibleIds=new Set(eligible);
  const complaints=await readOpenOrderComplaintsBatch(tx,authorization.tenantId,eligible);
  const credits=new Map<string,Promise<CustomerCreditResult>>();
  const readGroupCredit:CreditSourceRead|undefined=readCredit?(_nested,tenantId,customerId)=>{
   const prior=credits.get(customerId);if(prior)return prior;
   const source=withTenantSavepoint(tx,nested=>readCredit(nested,tenantId,customerId));
   credits.set(customerId,source);return source;
  }:undefined;
  const result=new Map<string,OrderPaymentStateReadResult>();
  for(const orderId of orderIds){
   const rows=grouped.get(orderId);if(!rows)throw Error("ORDER_PAYMENT_STATE_AMBIGUOUS");
   if(eligibleIds.has(orderId)&&!complaints.has(orderId))throw Error('ORDER_PAYMENT_STATE_AMBIGUOUS');
   // Only absent/denied rows lack a complaint read; their qualifier exits before using it.
   const data=await qualifyPaymentState(tx,authorization,rows,complaints.get(orderId)??null,readGroupCredit);
   result.set(orderId,data&&"code" in data?{code:"FORBIDDEN",message:"Zahlungs- und Warenausgangsdaten sind mit dieser Rolle nicht erlaubt."}:data?{code:"OK",data}:{code:"NOT_FOUND",message:"Zahlungs- und Warenausgangsdaten sind nicht verfügbar."});
  }
  return result;
 });
}
export async function getPaymentStatesBatch(authorization:AuthorizationSnapshot|PaymentReadAuthorization,orderIds:readonly string[],readCredit?:CreditSourceRead):Promise<Map<string,OrderPaymentStateReadResult>>{
 const readAuth='canReadSummary'in authorization?authorization:paymentReadAuthorization(authorization);
 const result=new Map<string,OrderPaymentStateReadResult>(),valid:string[]=[],allowed=readAuth.canReadOrderStates;
 for(const orderId of new Set(orderIds)){
  if(typeof orderId!=="string"||!ORDER_ID_PATTERN.test(orderId)){result.set(orderId,{code:"VALIDATION_ERROR",message:"Ungültige Zahlungsabfrage."});continue;}
  if(!allowed){result.set(orderId,{code:"FORBIDDEN",message:"Zahlungs- und Warenausgangsdaten sind mit dieser Rolle nicht erlaubt."});continue;}
  valid.push(orderId);
 }
 const read=async(ids:string[]):Promise<void>=>{
  if(!ids.length)return;
  try{const rows=await readPaymentStateGroup(readAuth,ids,readCredit);for(const orderId of ids){const value=rows.get(orderId);if(!value)throw Error("ORDER_PAYMENT_STATE_AMBIGUOUS");result.set(orderId,value);}}
  catch(error){
   if(ids.length>1){const middle=Math.floor(ids.length/2);await read(ids.slice(0,middle));await read(ids.slice(middle));return;}
   logReadFailure("getPaymentState database error",error);result.set(ids[0],{code:"UNAVAILABLE",message:"Zahlungs- und Warenausgangsdaten konnten nicht sicher geladen werden."});
  }
 };
 await read(valid);return result;
}
export async function getPaymentState(authorization:AuthorizationSnapshot|PaymentReadAuthorization,orderId:unknown,readCredit?:CreditSourceRead):Promise<OrderPaymentStateReadResult>{
 if(typeof orderId!=="string"||!ORDER_ID_PATTERN.test(orderId))return {code:"VALIDATION_ERROR",message:"Ungültige Zahlungsabfrage."};
 const rows=await getPaymentStatesBatch(authorization,[orderId],readCredit);
 return rows.get(orderId)??{code:"UNAVAILABLE",message:"Zahlungs- und Warenausgangsdaten konnten nicht sicher geladen werden."};
}
