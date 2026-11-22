import type {TodayReadSettings,PageReadSettings} from '@/modules/fundament/public';
import {projectTodayOrderSources} from './todayOrderRead';
import {withPageReadPhase,logPageReadPhase,configurePageReadBudget} from '@/db/readBudget';
import {readUnsentInvoiceMailGroups} from './communicationDocumentPort';
import {V45_TEXT,SHIPPING_FEE_COPY,SITUATION_COPY,PAGE_READ_COPY,SURFACE_ASSIGNMENT_COPY,TODAY_MODEL_COPY} from '@/ui/situationCatalog';
import {suggestOrderPositionSurface,orderPositionSurfaceLabel} from '@/lib/orderPositionContract';
import {listOpenQuotesAction,readQuoteAction} from '@/app/actions/quotes.actions';
import {v45QuoteFacts} from '@/lib/server/v45QuoteRead';
import type {U2Read} from '@/lib/domain/u2ReadContract';
import "server-only";
import {classifyOverdue} from "./paymentContract";
import {readOrderResponsibilityForToday} from "@/lib/server/orderTaskAssignmentRead";

import { sql } from "drizzle-orm";
import {hasAuthorizationArea} from "@/lib/auth/authorizationContract";
import {hasAnyAuthorizationArea,type AuthorizationSnapshot} from "@/lib/server/authorization";
import {authorizationReadContext,type AuthorizedReadContext} from "@/lib/server/authorizationReadContext";
import { getOperationalOrders } from "@/lib/server/operationalOrders";
import {observeTodayModelShadow,TODAY_PROJECTOR_VERSION,TODAY_MODEL_LIST_KINDS} from './todayProjectionSchedule';
import {getTodayOrderReadAction,readPageReadSettingsAction} from '@/app/actions/orders.actions';
import {getIntakeTaskAction,getIntakeMessagesAction} from "@/app/actions/eingang.actions";
import { withTenantSavepoint, type PrivilegedTenantTransaction, withPrivilegedTenantTransaction } from "@/lib/server/privilegedDb";
import {complaintAttention,type ComplaintReadResult} from '@/modules/complaints/public';
import { projectIntakeTaskSchedule,projectQuoteSchedule,projectTodayInvoiceMoney,isOverdueInvoiceForToday,type TodayOrderScheduleRow,projectOrderSchedule,readTodayCalendar,projectTodayChallenges,sortTodayByResponsibility,classifyMoneyForToday, defaultTodayLayout, deriveOrderGuidance, deriveTodayReminder, filterTodayLayout, isBundleStationForToday, parseTodayLayout, type TodayLayoutField, type TodayLayoutItem, type TodayOrderGuidance, type TodayReminderMode } from "@/lib/today/todayDashboardPolicy";

export type TodayField = "action" | "today" | "assign" | "money" | "bundle";
export type TodayVisibleField = Exclude<TodayField, "action">;
export type { TodayLayoutItem } from "@/lib/today/todayDashboardPolicy";
export type TodayItem = {
  key: string;
  field: TodayField;
  kind: "order" | "mail" | "invoice" | "bundle" | "complaint" | "task";
  title: string;
  meta: string;
  urgency: "conflict" | "decision" | "warning";
  orderId?: string;
  orderVersion?: number;
  surfaceAssignments?:Array<{itemId:string;rawValue:string;proposals:Array<{key:string;label:string}>}>;
  invoiceId?: string;
  invoiceMail?:{customerId:string;documentId:string;expectedInvoiceIds:string[];number:string;count:number;customerName:string;companyName?:string;singleInvoice:true};
  graphMessageId?: string;
  target?:{screen:'reklamation'|'mail'|'aufgabe'|'kv';arg:string};
  bundleSurface?: string;
  dueDate?: string;
  snoozedUntil?: string;
  assignedToName?: string;
  assignmentVersion?: number;
  primaryActionLabel?: ReturnType<typeof V45_TEXT.out$action$unsent> | typeof SITUATION_COPY.quote.openOrder | typeof SURFACE_ASSIGNMENT_COPY.open | typeof TODAY_MODEL_COPY.reload | TodayOrderGuidance["primaryActionLabel"] | "Erinnern" | "Zahlung bestätigen" | "Bündel öffnen" | "Ergebnis festlegen" | "Gutschrift erteilen" | "Kunde informieren" | "Öffnen" | "Kunde erinnern";
};

export type TodayCollectionNotice = {
  id: string;
  customerName: string;
  month: string;
  orderCount: number;
};

export type TodayQuoteActionRow={quoteId:string;version:number;read:U2Read;facts:Readonly<Record<string,unknown>>;validUntil:string|null;followupAt:string|null};
export type TodayDashboard = {
  hauptaktion?:U2Read['hauptaktion'];
  hauptaktionsQuelle?:{key:string;id:string;version:number}|null;
  messageActions?:{code:'OK'|'SOURCE_INCOMPLETE';rows:Array<{messageId:string;version:number;read:U2Read}>;missingMessageIds:string[]};
  taskSchedule?:ReturnType<typeof projectIntakeTaskSchedule>;
  quoteSchedule?:ReturnType<typeof projectQuoteSchedule>;
  quoteActions?:{code:'OK'|'SOURCE_INCOMPLETE';rows:TodayQuoteActionRow[];missingQuoteIds:string[]};
  calendar?:ReturnType<typeof readTodayCalendar>;
  orderSchedule?:ReturnType<typeof projectOrderSchedule>;
  datenluecken?:readonly string[];
  challenges?:{code:'OK'|'SOURCE_INCOMPLETE';groups:ReturnType<typeof projectTodayChallenges>['groups'];missing:readonly string[]};
  orderActions?:{code:'OK'|'SOURCE_INCOMPLETE';rows:TodayOrderScheduleRow[];missingOrderIds:string[]};
  moneySources?:{invoices:{code:'OK';count:number}|{code:'SOURCE_INCOMPLETE'};prepayments:{code:'OK';count:number}|{code:'SOURCE_INCOMPLETE'};collections:{code:'OK';count:number}|{code:'SOURCE_INCOMPLETE'}};
  invoiceMoney?:ReturnType<typeof projectTodayInvoiceMoney>;
  moneyMetric?:{code:'OK';count:number;sources:Array<{id:string;version:number}>}|{code:'SOURCE_INCOMPLETE'};
  assignmentMetric?:{code:'OK';count:number;sources:Array<{id:string;version:number}>}|{code:'SOURCE_INCOMPLETE'};
  items: TodayItem[];
  /**
   * Open collections are deliberately not actions until AP-ABS-b provides the
   * invoice-draft contract.  The optional property keeps older read-only
   * render fixtures compatible while the server reader always supplies it.
   */
  collectionNotices?: TodayCollectionNotice[];
  visibleFields: TodayVisibleField[];
  layout: TodayLayoutItem[];
  defaultLayout: TodayLayoutItem[];
  allowedFields: readonly TodayVisibleField[];
  delegationTargets: Array<{ userId: string; displayName: string }>;
  outlookMessage: string | null;
};

type PreferenceRow = { visible_fields: string[]; layout: unknown | null };
type ReminderRow = { item_key: string; reminder_until: Date | string };
type InvoiceRow = { overdue:boolean;overdue_as_of:string;payment_version:number;id: string; invoice_number: string; order_id: string | null; customer_name: string; customer_country: string | null; due_date: Date | string | null; open_amount_cents: number | string; payment_mode: string; payment_status: string; station: string | null };
type PrepaymentRow = { order_id: string; order_number: string; customer_name: string; customer_country: string | null; due_date: Date | string | null; invoice_id: string | null; open_amount_cents: number | string | null; payment_status: string | null; station: string; goods_out_event_count: number | string };
type UserRow = { id: string; full_name: string };
type AssignmentRow = { integrity_ok:boolean;order_id: string; assigned_to_name: string; current_order_version: number };
type CollectionRow = { id: string; customer_name: string; monat: Date | string; order_count: number | string };

const DEFAULT_FIELDS: TodayVisibleField[] = ["today", "assign", "money", "bundle"];
const STAGE2_TODAY_FEATURES = new Set<"bundle">();
function allowedTodayFields(auth: AuthorizationSnapshot): Set<TodayLayoutField> {
  const allowed = new Set<TodayLayoutField>(["action"]);
  if (hasAuthorizationArea(auth, "auftraege")) {
    allowed.add("today");
    if (STAGE2_TODAY_FEATURES.has("bundle")) allowed.add("bundle");
  }
  if (hasAuthorizationArea(auth, "mails")) allowed.add("assign");
  if (hasAuthorizationArea(auth, "zahlungen")) allowed.add("money");
  return allowed;
}

function dateOnly(value: Date | string) {
  return (value instanceof Date ? value.toISOString() : value).slice(0, 10);
}

function euro(cents: number | string) {
  return new Intl.NumberFormat("de-DE", { style: "currency", currency: "EUR" }).format(Number(cents) / 100);
}

function formatCollectionMonth(value: Date | string) {
  const month = dateOnly(value);
  if (!/^\d{4}-\d{2}-01$/.test(month)) throw new Error("TODAY_COLLECTION_MONTH_INVALID");
  return new Intl.DateTimeFormat("de-DE", {
    month: "long",
    year: "numeric",
    timeZone: "Europe/Berlin",
  }).format(new Date(`${month}T12:00:00.000Z`));
}

function toPositiveInteger(value: number | string) {
  const normalized = Number(value);
  return Number.isSafeInteger(normalized) && normalized > 0 ? normalized : null;
}

function countTodaySource(source:{code:'OK';data:{length:number}}|{code:'SOURCE_INCOMPLETE'}):{code:'OK';count:number}|{code:'SOURCE_INCOMPLETE'}{return source.code==='OK'?{code:'OK',count:source.data.length}:{code:'SOURCE_INCOMPLETE'};}

/** A failed SQL read must not poison the other daily sources in this transaction. */
export async function readTodaySource<T>(tx:PrivilegedTenantTransaction,read:(nested:PrivilegedTenantTransaction)=>Promise<T>):Promise<{code:'OK';data:T}|{code:'SOURCE_INCOMPLETE'}>{
  try{return {code:'OK',data:await withPageReadPhase('today.source',()=>withTenantSavepoint(tx,read))};}
  catch(error){console.error('[TODAY_SOURCE_FAILED]',{quelle:'query',name:error instanceof Error?error.name:'UnknownError'});return {code:'SOURCE_INCOMPLETE'};}
}

/** Keep the canonical reader's limit while retaining one transaction for the whole source. */
export async function readTodayResponsibilities(auth:AuthorizationSnapshot,ids:readonly string[]){
 return withPrivilegedTenantTransaction(auth,async tx=>{
  return readTodayResponsibilitiesInTransaction(tx,auth,ids);
 }).catch(()=>({code:'SOURCE_INCOMPLETE' as const}));
}

export async function readTodayResponsibilitiesInTransaction(tx:PrivilegedTenantTransaction,auth:AuthorizationSnapshot,ids:readonly string[]){
  const result=Object.assign(new Map<string,string|null>(),{unavailableOrderIds:[] as string[]});
  for(let offset=0;offset<ids.length;offset+=1000){
   const block=await readTodaySource(tx,nested=>readOrderResponsibilityForToday(nested,auth,ids.slice(offset,offset+1000)));
   if(block.code!=='OK')return {code:'SOURCE_INCOMPLETE' as const};
   for(const [id,userId] of block.data)result.set(id,userId);
   result.unavailableOrderIds.push(...block.data.unavailableOrderIds);
  }
  return {code:'OK' as const,data:result};
}

/** One source-access mask for the existing live composition and the prepared
 * model. This only reuses canonical area gates, never constructs an identity. */
export function todaySourceAccess(auth:Pick<AuthorizedReadContext,'canReadArea'>){
 const invoiceMail=auth.canReadArea('preise');
 return {
  orders:auth.canReadArea('auftraege'),messages:auth.canReadArea('mails'),money:auth.canReadArea('zahlungen'),
  complaints:(['auftraege','entscheiden','zahlungen','kunden'] as const).some(area=>auth.canReadArea(area)),
  invoiceMail,company:invoiceMail,
 };
}
/** Existing tenant-wide money facts; personal preferences and assignments stay live. */
async function readTodayMoneySources(auth:AuthorizationSnapshot|AuthorizedReadContext,today:string,access:ReturnType<typeof todaySourceAccess>){
 const {money:moneyAllowed}=access;
 return withPrivilegedTenantTransaction(auth,async tx=>{
      const invoiceSource=moneyAllowed ? await readTodaySource(tx,nested=>nested.execute<InvoiceRow>(sql`
          SELECT invoice.id, invoice.payment_version, invoice.invoice_number, invoice.order_id, customer.name AS customer_name,
                 customer.country AS customer_country, invoice.due_date,
                 ${classifyOverdue(today)} AS overdue,${today}::text AS overdue_as_of,
                 invoice.payment_open_amount_cents AS open_amount_cents,
                 COALESCE(orders.payment_mode, invoice.payment_mode) AS payment_mode, invoice.payment_status, orders.station
          FROM public.invoices invoice
          LEFT JOIN public.orders orders ON orders.tenant_id=invoice.tenant_id AND orders.id=invoice.order_id
          JOIN public.customers customer ON customer.tenant_id=invoice.tenant_id AND customer.id=invoice.customer_id
          WHERE invoice.tenant_id=${auth.tenantId} AND invoice.status='issued'
            AND invoice.payment_status IN ('offen', 'teilbezahlt')
          ORDER BY invoice.due_date, invoice.invoice_number
        `)) : {code:'OK' as const,data:[] as InvoiceRow[]};
      const prepaymentSource=moneyAllowed ? await readTodaySource(tx,nested=>nested.execute<PrepaymentRow>(sql`
          SELECT payment.order_id, payment.order_number, customer.name AS customer_name,
                 customer.country AS customer_country, orders.due_date, payment.invoice_id,
                 payment.payment_open_amount_cents AS open_amount_cents,
                 payment.payment_status, payment.station, payment.goods_out_event_count
          FROM private.v_goods_out_ui_state_v1 payment
          JOIN public.orders orders ON orders.tenant_id=payment.tenant_id AND orders.id=payment.order_id
          JOIN public.customers customer ON customer.tenant_id=orders.tenant_id AND customer.id=orders.customer_id
          WHERE payment.tenant_id=${auth.tenantId}
            AND payment.payment_mode='vorkasse'
            AND payment.station='fertig'
            AND payment.goods_out_event_count=0
            AND payment.integrity_ok=true
            AND (payment.invoice_state='not_issued' OR payment.payment_status IN ('offen', 'teilbezahlt'))
          ORDER BY orders.due_date NULLS LAST, payment.order_number
        `)) : {code:'OK' as const,data:[] as PrepaymentRow[]};
      const collectionSource=moneyAllowed ? await readTodaySource(tx,nested=>nested.execute<CollectionRow>(sql`
          SELECT collection.id::text, customer.name AS customer_name, collection.monat,
                 count(collection_order.order_id)::integer AS order_count
          FROM public.invoice_collections collection
          JOIN public.customers customer
            ON customer.tenant_id=collection.tenant_id AND customer.id=collection.customer_id
          JOIN public.invoice_collection_orders collection_order
            ON collection_order.tenant_id=collection.tenant_id AND collection_order.collection_id=collection.id
          WHERE collection.tenant_id=${auth.tenantId}
            AND collection.status='offen'
            AND collection.monat < date_trunc('month', ${today}::date)::date
          GROUP BY collection.id, collection.monat, customer.name
          HAVING count(collection_order.order_id)>0
          ORDER BY collection.monat, customer.name, collection.id
        `)) : {code:'OK' as const,data:[] as CollectionRow[]};
      const invoiceMailSource=access.invoiceMail?await readTodaySource(tx,nested=>readUnsentInvoiceMailGroups(nested,auth.tenantId)):{code:'OK' as const,data:{groups:[],missing:[]}};

   return {supportMissing:invoiceMailSource.code!=='OK'?['TODAY_UNSENT_INVOICE_SOURCE']:invoiceMailSource.data.missing,invoiceMailSource,invoiceSource,invoices:invoiceSource.code==='OK'?invoiceSource.data:[],prepaymentSource,prepayments:prepaymentSource.code==='OK'?prepaymentSource.data:[],collectionSource,collections:collectionSource.code==='OK'?collectionSource.data:[]};
  }).catch(error=>{console.error('[TODAY_SOURCE_FAILED]',{quelle:'support',name:error instanceof Error?error.name:'UnknownError'});
   return unknownTodayMoneySupport();
  });
}
export function unknownTodayMoneySupport(){
 return {supportMissing:['TODAY_SUPPORT_SOURCE','TODAY_UNSENT_INVOICE_SOURCE'],invoiceMailSource:{code:'SOURCE_INCOMPLETE' as const},invoiceSource:{code:'SOURCE_INCOMPLETE' as const},invoices:[] as InvoiceRow[],prepaymentSource:{code:'SOURCE_INCOMPLETE' as const},prepayments:[] as PrepaymentRow[],collectionSource:{code:'SOURCE_INCOMPLETE' as const},collections:[] as CollectionRow[]};
}
/** One visibility mask for live SQL results and qualified stored money facts. */
export function maskTodayMoneySupport(auth:AuthorizationSnapshot|AuthorizedReadContext,source:Awaited<ReturnType<typeof readTodayMoneySources>>){
 const access=todaySourceAccess('canReadArea'in auth?auth:authorizationReadContext(auth));
 const invoiceMailSource=access.invoiceMail?source.invoiceMailSource:{code:'OK' as const,data:{groups:[],missing:[]}};
 const supportMissing=invoiceMailSource.code!=='OK'?['TODAY_UNSENT_INVOICE_SOURCE']:[...invoiceMailSource.data.missing];
 if((access.money||access.invoiceMail)&&source.supportMissing.includes('TODAY_SUPPORT_SOURCE'))supportMissing.unshift('TODAY_SUPPORT_SOURCE');
 return {...source,supportMissing,invoiceMailSource,
  invoiceSource:access.money?source.invoiceSource:{code:'OK' as const,data:[] as InvoiceRow[]},invoices:access.money?source.invoices:[] as InvoiceRow[],
  prepaymentSource:access.money?source.prepaymentSource:{code:'OK' as const,data:[] as PrepaymentRow[]},prepayments:access.money?source.prepayments:[] as PrepaymentRow[],
  collectionSource:access.money?source.collectionSource:{code:'OK' as const,data:[] as CollectionRow[]},collections:access.money?source.collections:[] as CollectionRow[]};
}
export async function readTodayMoneySupport(auth:AuthorizationSnapshot|AuthorizedReadContext,today:string,access=todaySourceAccess('canReadArea'in auth?auth:authorizationReadContext(auth))){
 return maskTodayMoneySupport(auth,await readTodayMoneySources(auth,today,access));
}
export async function readTodayPersonalSupportInTransaction(tx:PrivilegedTenantTransaction,auth:AuthorizationSnapshot){
      const preferencesSource = await readTodaySource(tx,nested=>
        nested.execute<PreferenceRow>(sql`SELECT preference.visible_fields, to_jsonb(preference)->'layout' AS layout FROM private.today_preferences preference WHERE preference.tenant_id=${auth.tenantId} AND preference.actor_id=${auth.userId}::uuid LIMIT 1`));
      const remindersSource = await readTodaySource(tx,nested=>
        nested.execute<ReminderRow>(sql`SELECT item_key, reminder_until FROM private.today_reminders WHERE tenant_id=${auth.tenantId} AND actor_id=${auth.userId}::uuid`));

   return {supportMissing:[...(preferencesSource.code!=='OK'?['TODAY_PREFERENCES_SOURCE']:[]),...(remindersSource.code!=='OK'?['TODAY_REMINDERS_SOURCE']:[])],preferences:preferencesSource.code==='OK'?preferencesSource.data:[],reminders:remindersSource.code==='OK'?remindersSource.data:[]};
}

export async function readTodayDelegationSupportInTransaction(tx:PrivilegedTenantTransaction,auth:AuthorizationSnapshot,access:ReturnType<typeof todaySourceAccess>){
 const {orders:ordersAllowed}=access;
      const delegationSource =
        ordersAllowed ? await readTodaySource(tx,nested=>nested.execute<UserRow>(sql`
          SELECT users.id, users.full_name
          FROM public.app_users users
          WHERE users.tenant_id=${auth.tenantId}
            AND users.active=true
            AND users.id<>${auth.userId}::uuid
            AND EXISTS (
              SELECT 1 FROM public.app_user_rights rights
              WHERE rights.tenant_id=users.tenant_id
                AND rights.user_id=users.id
                AND rights.bereich='auftraege'
            )
          ORDER BY users.full_name, users.id
        `)) : {code:'OK' as const,data:[] as UserRow[]};
      const assignmentSource =
        ordersAllowed ? await readTodaySource(tx,nested=>nested.execute<AssignmentRow>(sql`
          SELECT order_id, assigned_to_name, current_order_version, integrity_ok
          FROM private.v_order_task_assignment_v1
          WHERE tenant_id=${auth.tenantId}
            AND assigned_by=${auth.userId}::uuid
            AND active=true
        `)) : {code:'OK' as const,data:[] as AssignmentRow[]};
      const assignments=assignmentSource.code==='OK'?assignmentSource.data:[];

   return {supportMissing:delegationSource.code!=='OK'?['TODAY_DELEGATION_SOURCE']:[],delegationTargets:delegationSource.code==='OK'?delegationSource.data:[],assignmentSourceIncomplete:assignmentSource.code!=='OK'||assignments.some(row=>!row.integrity_ok),assignments:assignments.filter(row=>row.integrity_ok)};
}

async function readTodaySupport(auth:AuthorizationSnapshot,today:string,access:ReturnType<typeof todaySourceAccess>){
 const [money,person,orders]=await Promise.all([
  readTodayMoneySupport(auth,today,access),
  withPrivilegedTenantTransaction(auth,async tx=>{
   return readTodayPersonalSupportInTransaction(tx,auth);
  }).catch(error=>{console.error('[TODAY_SOURCE_FAILED]',{quelle:'support',name:error instanceof Error?error.name:'UnknownError'});
   return {supportMissing:['TODAY_PREFERENCES_SOURCE','TODAY_REMINDERS_SOURCE'],preferences:[] as PreferenceRow[],reminders:[] as ReminderRow[]};
  }),
  withPrivilegedTenantTransaction(auth,async tx=>{
   return readTodayDelegationSupportInTransaction(tx,auth,access);
  }).catch(error=>{console.error('[TODAY_SOURCE_FAILED]',{quelle:'support',name:error instanceof Error?error.name:'UnknownError'});
   return {supportMissing:['TODAY_DELEGATION_SOURCE'],delegationTargets:[] as UserRow[],assignmentSourceIncomplete:true,assignments:[] as AssignmentRow[]};
  }),
 ]);
 return {supportMissing:[...money.supportMissing,...person.supportMissing,...orders.supportMissing],invoiceMailSource:money.invoiceMailSource,preferences:person.preferences,reminders:person.reminders,invoiceSource:money.invoiceSource,invoices:money.invoices,prepaymentSource:money.prepaymentSource,prepayments:money.prepayments,collectionSource:money.collectionSource,collections:money.collections,delegationTargets:orders.delegationTargets,assignmentSourceIncomplete:orders.assignmentSourceIncomplete,assignments:orders.assignments};
}

export type TodayQuoteFollowup={isMine?:boolean;id:string;title:string;dueDate:string;quoteId:string;quoteNumber:string;customerName:string};
export function todayResponsibilityIds(auth:AuthorizationSnapshot,orders:Awaited<ReturnType<typeof getOperationalOrders>>,support:Pick<Awaited<ReturnType<typeof readTodaySupport>>,'invoices'|'prepayments'|'invoiceMailSource'>,complaints:ComplaintReadResult|{code:'SOURCE_INCOMPLETE';message:string}){
 return [...new Set([...orders.map(row=>row.id),...support.invoices.flatMap(row=>row.order_id?[row.order_id]:[]),...support.prepayments.map(row=>row.order_id),
  ...(complaints.code==='OK'?complaintAttention(complaints.complaints,auth.areas??[]).flatMap(row=>row.orderId?[row.orderId]:[]):[]),
  ...(support.invoiceMailSource.code==='OK'?support.invoiceMailSource.data.groups.flatMap(row=>row.orderId?[row.orderId]:[]):[])])];
}
export async function collectTodaySources(auth: AuthorizationSnapshot,readComplaints:()=>Promise<ComplaintReadResult>,readQuoteFollowups:()=>Promise<{code:'OK';tasks:TodayQuoteFollowup[]}|{code:string;message:string}>,readNow=new Date(),operationalSource?:ReturnType<typeof getOperationalOrders>) {
  const diagnosticStarted=Date.now();
  const calendar=readTodayCalendar(readNow),today=calendar.today;
  const access=todaySourceAccess(authorizationReadContext(auth));
  const {orders:ordersAllowed,messages:graphAllowed}=access;
  const quotesRead=(async()=>{
  const quoteList=graphAllowed?await withPageReadPhase('today.quotes',()=>listOpenQuotesAction({purpose:'today'}).catch(()=>({code:'SOURCE_INCOMPLETE' as const}))):{code:'OK' as const,quotes:[]};
  const rows=quoteList.code==='OK'?await Promise.all(quoteList.quotes.map(async quote=>{
    try{
      const card=await withPageReadPhase('today.quote_card',()=>readQuoteAction({quoteId:quote.quoteId,purpose:'operations'}));
      if(card.code==='OK'&&card.quote.version===quote.version&&card.quote.lifecycle){
        const row:TodayQuoteActionRow={quoteId:quote.quoteId,version:quote.version,read:card.nextActionRule,
          facts:v45QuoteFacts(card.quote,new Date(calendar.readStartedAt)),validUntil:card.quote.validUntil,followupAt:card.quote.lifecycle.followupAt};
        return row;
      }
    }catch(error){console.error('[TODAY_SOURCE_FAILED]',{quelle:'quote-card',name:error instanceof Error?error.name:'UnknownError'});return {quoteId:quote.quoteId,read:null};}
    return {quoteId:quote.quoteId,read:null};
  })):[];
  return {quoteList,quoteReads:rows};
  })();
  const tasksRead=graphAllowed?withPageReadPhase('today.tasks',()=>getIntakeTaskAction({calendar:true}).catch(()=>({code:'SOURCE_INCOMPLETE' as const,rows:[],missingTaskIds:[]}))):null;
  const [orderSource, graph, support, complaints,quoteFollowups,companyLetter] = await Promise.all([
    withPageReadPhase('today.orders',()=>ordersAllowed ? (operationalSource??getOperationalOrders(auth,{purpose:'today'})).then(data=>({code:'OK' as const,data})).catch(error=>{console.error('[TODAY_SOURCE_FAILED]',{quelle:'orders',name:error instanceof Error?error.name:'UnknownError'});return {code:'SOURCE_INCOMPLETE' as const};}) : Promise.resolve({code:'OK' as const,data:[]})),
    withPageReadPhase('today.graph',()=>graphAllowed ? getIntakeMessagesAction('offen').catch(()=>({code:'SOURCE_INCOMPLETE' as const,message:PAGE_READ_COPY.sourceIncomplete})) : Promise.resolve({ code: "FORBIDDEN" as const, message: "" })),
    withPageReadPhase('today.support',()=>readTodaySupport(auth,today,access)),
    withPageReadPhase('today.complaints',()=>access.complaints?readComplaints().catch(error=>{console.error('[TODAY_SOURCE_FAILED]',{quelle:'complaints',name:error instanceof Error?error.name:'UnknownError'});return {code:'SOURCE_INCOMPLETE' as const,message:'TODAY_COMPLAINT_SOURCE'};}):Promise.resolve({code:'OK' as const,complaints:[]})),
    withPageReadPhase('today.followups',()=>graphAllowed?readQuoteFollowups().catch(error=>{console.error('[TODAY_SOURCE_FAILED]',{quelle:'quote-followups',name:error instanceof Error?error.name:'UnknownError'});return {code:'SOURCE_INCOMPLETE' as const,message:'TODAY_QUOTE_FOLLOWUP_SOURCE'};}):Promise.resolve({code:'OK' as const,tasks:[]})),
    withPageReadPhase('today.company',()=>access.company?readPageReadSettingsAction({includeCompanyName:true}):Promise.resolve({code:'FORBIDDEN' as const})),
  ]);

  const orders=orderSource.code==='OK'?orderSource.data:[];
  const responsibilityIds=todayResponsibilityIds(auth,orders,support,complaints);
  const responsibilityRead=withPageReadPhase('today.responsibility',()=>readTodayResponsibilities(auth,responsibilityIds));
  logPageReadPhase('today.initial',diagnosticStarted,{rows:orders.length});
  // One existing App composition owns the narrow bulk U2 projection and
  // its canonical rights/source ports, without complete cards or actor menus.
  const batch=ordersAllowed?await withPageReadPhase('today.batch',()=>getTodayOrderReadAction({orderIds:orders.map(order=>order.id)})):null;
  let versions:Array<{id:string;version:number}>|null=[];
  if(orders.length){
    try{
      versions=await withPageReadPhase('today.versions',()=>withPrivilegedTenantTransaction(auth,tx=>tx.execute<{id:string;version:number}>(sql`SELECT id,version FROM public.orders WHERE tenant_id=${auth.tenantId} AND id=ANY(ARRAY[${sql.join(orders.map(row=>sql`${row.id}`),sql`, `)}]::text[])`)));
    }catch{versions=null;}
  }
  const {quoteList,quoteReads}=await quotesRead;
  const taskRead=await tasksRead;
  const responsibilitySource=await responsibilityRead;
  return {calendar,access,orderSource,graph,support,complaints,quoteFollowups,companyLetter,batch,versions,quoteList,quoteReads,taskRead,responsibilitySource};
}

type CollectedTodaySources=Awaited<ReturnType<typeof collectTodaySources>>;
/** Composition consumes facts, not the live Action's transport metadata. */
export type TodayDashboardSources=Omit<CollectedTodaySources,'companyLetter'|'quoteList'|'graph'>&{
 modelStaleOrderIds?:readonly string[];
 graph:Awaited<ReturnType<import('@/modules/eingang/public').IntakeMessagesPorts['list']>>|{code:'SOURCE_INCOMPLETE';message:string};
 companyLetter:{code:'OK';companyName?:string}|{code:'FORBIDDEN'|'SOURCE_INCOMPLETE'};
 quoteList:{code:'OK';quotes:readonly {quoteId:string;version:number}[]}|Exclude<CollectedTodaySources['quoteList'],{code:'OK'}>;
};
/** One synchronous composition for the live and later qualified model sources. */
export function composeTodayDashboard(auth:AuthorizationSnapshot,sources:TodayDashboardSources,calendar=sources.calendar):TodayDashboard {
  const {access,orderSource,graph,support,complaints,quoteFollowups,companyLetter,batch,versions,quoteList,quoteReads,taskRead}=sources;
  // The existing visible-item pruning is local to this composition. Captured
  // source facts remain intact for retries and equality comparisons.
  const responsibilitySource=sources.responsibilitySource.code==='OK'
    ?{...sources.responsibilitySource,data:Object.assign(new Map(sources.responsibilitySource.data),{unavailableOrderIds:[...sources.responsibilitySource.data.unavailableOrderIds]})}
    :sources.responsibilitySource;
  const {orders:ordersAllowed,messages:graphAllowed,money:moneyAllowed}=access;
  const today=calendar.today;
  const orders=orderSource.code==='OK'?orderSource.data:[];
  const sourceNotices:TodayItem[]=[];
  const retainOrderSourceNotice=(order:{id:string;version:number;orderNumber:string})=>{if(!sourceNotices.some(item=>item.key==='source-order:'+order.id)){
   const stale=sources.modelStaleOrderIds?.includes(order.id)===true;
   sourceNotices.push({key:'source-order:'+order.id,field:'action',kind:'order',orderId:order.id,orderVersion:order.version,title:stale?TODAY_MODEL_COPY.cardRefreshing:PAGE_READ_COPY.orderIncomplete(order.orderNumber),meta:'',urgency:'warning',primaryActionLabel:stale?TODAY_MODEL_COPY.reload:SITUATION_COPY.quote.openOrder});
  }};
  const cardSources=new Map(batch?.code==='OK'?batch.data.rows.map(row=>[row.orderId,row.result]):[]);
  const orderActionReads=orders.map(order=>{
   const source=cardSources.get(order.id);
   if(source?.code!=='OK'||source.data.card.version!==order.version){
    retainOrderSourceNotice(order);
    return {orderId:order.id,version:order.version,read:null};
   }
   const {card,handoverConsequences:shipping,pickupAppointment:appointment}=source.data;
   const unresolved=card.items.filter(item=>item.surfaceAssignmentRequired);
   if(unresolved.length){
    sourceNotices.push({key:'source-order:'+order.id,field:'action',kind:'order',orderId:order.id,orderVersion:order.version,
     title:SURFACE_ASSIGNMENT_COPY.title([...new Set(unresolved.map(item=>item.surfaceAssignmentRequired!))].join(', '),order.orderNumber),
     meta:'',urgency:'warning',primaryActionLabel:SURFACE_ASSIGNMENT_COPY.open,
     surfaceAssignments:unresolved.map(item=>{const key=suggestOrderPositionSurface(item.surfaceAssignmentRequired!);return {itemId:item.id,rawValue:item.surfaceAssignmentRequired!,proposals:key?[{key,label:SURFACE_ASSIGNMENT_COPY.proposal(orderPositionSurfaceLabel(key))}]:[]};})});
   }
   if(shipping?.code==='SOURCE_INCOMPLETE')sourceNotices.push({key:'source-shipping:'+order.id,field:'action',kind:'order',orderId:order.id,orderVersion:order.version,title:shipping.orderId===order.id&&shipping.orderVersion===order.version&&shipping.message?shipping.message:SHIPPING_FEE_COPY.proposalMissing(order.orderNumber,false,'quelle'),meta:'',urgency:'warning',primaryActionLabel:SITUATION_COPY.quote.openOrder});
   if(hasAuthorizationArea(auth,'preise')&&card.operationalFacts?.pricesMissing===null)sourceNotices.push({key:'source-quote:'+order.id,field:'action',kind:'order',orderId:order.id,orderVersion:order.version,title:SHIPPING_FEE_COPY.orderQuoteMissing(order.orderNumber),meta:'',urgency:'warning',primaryActionLabel:SITUATION_COPY.quote.openOrder});
   const row:TodayOrderScheduleRow={orderId:order.id,version:order.version,read:source.data.nextActionRule};
   if(card.station==='fertig'&&card.handoverMode==='pickup'){
    row.pickupSchedule={code:'SOURCE_INCOMPLETE'};
    if(appointment?.code==='OK'&&card.freeze){
     if(appointment.appointment===null)row.pickupSchedule={code:'OK',date:null,eventId:null,freezeId:card.freeze.freezeId};
     else if(appointment.appointment.orderId===card.id&&appointment.appointment.freezeId===card.freeze.freezeId)row.pickupSchedule={code:'OK',date:appointment.appointment.date,eventId:appointment.appointment.eventId,freezeId:card.freeze.freezeId};
    }
   }
   return row;
  });
  // The existing late read is captured before pure composition. Unknown
  // versions still invalidate only their own clickable order actions.
  for(const row of orderActionReads)if(versions===null||!versions.some(current=>current.id===row.orderId&&current.version===row.version))row.read=null;
  // A late version-read failure must not silently remove known orders.
  for(const order of orders)if(orderActionReads.some(row=>row.orderId===order.id&&row.read===null))retainOrderSourceNotice(order);
  const orderActions={code:orderSource.code==='OK'&&orderActionReads.every(row=>row.read!==null)?'OK' as const:'SOURCE_INCOMPLETE' as const,
    rows:orderActionReads.flatMap(row=>row.read?[{...row,read:row.read}]:[]),
    missingOrderIds:orderActionReads.filter(row=>row.read===null).map(row=>row.orderId)};

  const orderSchedule=projectOrderSchedule(orderActions,calendar);
  // The canonical list and operational U2 card are the only quote sources.
  // Raw financial list objects never escape this server composition.
  const quoteActions={code:quoteList.code==='OK'&&quoteReads.every(row=>row.read!==null)?'OK' as const:'SOURCE_INCOMPLETE' as const,
    rows:quoteReads.flatMap(row=>row.read?[row as TodayQuoteActionRow]:[]),missingQuoteIds:quoteReads.filter(row=>row.read===null).map(row=>row.quoteId)};

  const taskKnown=taskRead?.code==='OK';
  const taskSchedule=projectIntakeTaskSchedule(taskRead&&'rows'in taskRead?taskRead:{code:'SOURCE_INCOMPLETE',rows:[],missingTaskIds:[]},calendar);

  const messageActionRows:Array<{messageId:string;version:number;read:U2Read}>=[],missingMessageIds:string[]=[];
  if(graph.code==='OK')for(const message of graph.messages){
    if(['erledigt','info'].includes(message.usage)||message.discardReason!==null)continue;
    const read=message.nextActionRule;
    if(message.usage!=='offen'||!read||read.code!=='OK'||read.source.kind!=='intake'||read.source.id!==message.id||read.source.version!==message.version||read.nutzung!==message.usage||read.zuordnung!==message.assignment){missingMessageIds.push(message.id);continue;}
    messageActionRows.push({messageId:message.id,version:message.version,read});
  }
  const messageActions={code:graph.code==='OK'&&missingMessageIds.length===0?'OK' as const:'SOURCE_INCOMPLETE' as const,rows:messageActionRows,missingMessageIds};

  const allowed = allowedTodayFields(auth);
  const suggestedLayout = defaultTodayLayout(auth.role, allowed);
  const storedLayout = parseTodayLayout(support.preferences[0]?.layout);
  const layout = storedLayout ? filterTodayLayout(storedLayout, allowed) : suggestedLayout;
  const selected = layout.map((item) => item.field).filter((field): field is TodayVisibleField => field !== "action");
  const selectedSet = new Set(selected);
  const reminders = new Map(support.reminders.map((row) => [row.item_key, new Date(row.reminder_until).toISOString()]));
  const items: TodayItem[] = [];
  const assignments = new Map(support.assignments.map((row) => [row.order_id, row]));
  const add = (item: TodayItem) => items.push({ ...item, field: item.field === "action" || selectedSet.has(item.field as TodayVisibleField) ? item.field : "action", snoozedUntil: reminders.get(item.key) });
  for(const notice of sourceNotices)add(notice);
  const followupsKnown=quoteFollowups.code==='OK'&&'tasks'in quoteFollowups;
  // V45 hides ordinary quote concerns without money access. The explicit S05
  // followup-mail permission still exposes its real due quote through mails.
  const followupQuoteIds=new Set(followupsKnown?quoteFollowups.tasks.map(row=>row.quoteId):[]);
  const quoteScheduleRows=moneyAllowed?quoteActions.rows:quoteActions.rows.filter(row=>followupQuoteIds.has(row.quoteId));
  const quoteScheduleMissing=moneyAllowed?quoteActions.missingQuoteIds:[...followupQuoteIds].filter(id=>!quoteScheduleRows.some(row=>row.quoteId===id));
  const quoteSchedule=projectQuoteSchedule({code:moneyAllowed?quoteActions.code:followupsKnown&&quoteScheduleMissing.length===0?'OK':'SOURCE_INCOMPLETE',rows:quoteScheduleRows,missingQuoteIds:quoteScheduleMissing},calendar);

  const complaintsKnown=complaints.code==='OK';
  const complaintCases=complaints.code==='OK'?complaintAttention(complaints.complaints,auth.areas??[]):[];
  if(followupsKnown)for(const task of quoteFollowups.tasks)add({key:'task:'+task.id,field:'action',kind:'task',title:task.title,meta:'KV '+task.quoteNumber+' · '+task.customerName,urgency:'warning',dueDate:task.dueDate,target:{screen:'kv',arg:task.quoteId},primaryActionLabel:'Öffnen'});
  for(const attention of complaintCases)add({key:attention.key,field:'action',kind:'complaint',title:attention.title,meta:attention.meta,urgency:attention.urgency,orderId:attention.orderId,target:attention.target,primaryActionLabel:attention.actionLabel as TodayItem['primaryActionLabel']});

  for (const order of orders) {
    const guidance = deriveOrderGuidance(order, today);
    if (!guidance) continue;
    const caseTitle = guidance.caseId === "finished_waiting" ? "Fertig und wartet auf Warenausgang" : guidance.caseId === "due" ? "Liefertermin braucht Handlung" : guidance.caseId === "tight" ? "Zeitplan ist knapp" : guidance.caseId === "problem" ? "Gemeldetes Auftragsrisiko" : "Heute fertig zur Übergabe";
    const reason = guidance.reason === "due_today" ? `heute fällig · Station ${order.station}` : guidance.reason === "overdue" ? `überfällig · Station ${order.station}` : guidance.reason === "finished_overdue" ? `Liefertermin überschritten · fertig zur Übergabe` : guidance.reason === "tight_schedule" ? `${order.dueLabel} ${order.dueValue} · noch nicht begonnen` : guidance.reason === "reported_risk" ? `Risiko ${order.risk} · Station ${order.station}` : `${order.dueLabel} ${order.dueValue} · fertig`;
    const assignment = assignments.get(order.id);
    add({ key: `order:${order.id}:${guidance.caseId}:${guidance.reason}`, field: guidance.field, kind: "order", title: `${order.orderNumber} · ${caseTitle}`, meta: `${order.customerName ?? "Kunde"} · ${reason}`, urgency: order.risk === "red" || order.risk === "blocked" ? "conflict" : "warning", orderId: order.id, orderVersion: order.version, dueDate: order.dueDate, assignedToName: assignment?.assigned_to_name, assignmentVersion: assignment?.current_order_version, primaryActionLabel: guidance.primaryActionLabel });
  }

  const assignmentMessages=graph.code==='OK'?graph.messages.filter(row=>row.channel==='mail'&&row.direction==='rein'&&row.usage==='offen'&&row.assignment==='offen'):null;
  // Legacy mail opener consumes only a real provider ID; native IDs stay in U3 sources.
  if(assignmentMessages)for(const mail of assignmentMessages.filter(row=>row.graphMessageId).slice(0,5))add({key:`mail:${mail.id}`,field:'assign',kind:'mail',title:mail.subject||'Mail ohne Betreff',meta:`${mail.senderName} · ${new Intl.DateTimeFormat('de-DE',{dateStyle:'short',timeStyle:'short',timeZone:'Europe/Berlin'}).format(new Date(mail.at))}`,urgency:'decision',graphMessageId:mail.graphMessageId!});

  if(support.invoiceMailSource.code==='OK')for(const original of support.invoiceMailSource.data.groups){
   add({key:'invoice-mail:'+original.id,field:'action',kind:'invoice',invoiceId:original.id,...(original.orderId?{orderId:original.orderId}:{}),title:original.number,meta:original.customerName,urgency:'warning',primaryActionLabel:V45_TEXT.out$action$unsent({invoice:original.number,name:original.customerName}),invoiceMail:{customerId:original.customerId,documentId:original.id,expectedInvoiceIds:original.ids,number:original.number,count:original.count,customerName:original.customerName,...(companyLetter.code==='OK'&&companyLetter.companyName?{companyName:companyLetter.companyName}:{}),singleInvoice:true}});
  }

  const invoiceMoney=projectTodayInvoiceMoney(support.invoiceSource,calendar);
  const overdueInvoices=support.invoices.filter(invoice=>isOverdueInvoiceForToday(invoice,today)===true);
  for (const invoice of overdueInvoices.slice(0,20)) {
    const dueDate = dateOnly(invoice.due_date!);
    add({ key: `invoice:${invoice.id}`, field: "money", kind: "invoice", title: `${invoice.invoice_number} · ${invoice.customer_name}`, meta: `${euro(invoice.open_amount_cents)} · fällig ${dueDate}`, urgency: "conflict", invoiceId: invoice.id, ...(invoice.order_id ? {orderId: invoice.order_id} : {}), dueDate, primaryActionLabel: "Erinnern" });
  }

  const eligiblePrepayments=support.prepayments.filter(prepayment=>classifyMoneyForToday({customerCountry:prepayment.customer_country,dueDate:prepayment.due_date?dateOnly(prepayment.due_date):null,goodsOutRecorded:Number(prepayment.goods_out_event_count)>0,paymentMode:'vorkasse',paymentStatus:prepayment.payment_status,station:prepayment.station},today)==='open_prepayment');
  for (const prepayment of eligiblePrepayments.slice(0,20)) {
    const dueDate = prepayment.due_date ? dateOnly(prepayment.due_date) : null;
    const amount = prepayment.open_amount_cents === null ? "Betrag nach Rechnung" : euro(prepayment.open_amount_cents);
    add({ key: `prepayment:${prepayment.order_id}`, field: "money", kind: "order", title: `${prepayment.order_number} · Vorkasse offen`, meta: `${prepayment.customer_name} · ${amount} · Versand gesperrt`, urgency: "warning", orderId: prepayment.order_id, invoiceId: prepayment.invoice_id ?? undefined, dueDate: dueDate ?? undefined, primaryActionLabel: "Zahlung bestätigen" });
  }

  const collectionNotices = support.collections.slice(0,20).map((collection) => {
    const customerName = collection.customer_name.trim();
    const orderCount = toPositiveInteger(collection.order_count);
    if (!collection.id || !customerName || orderCount === null) throw new Error("TODAY_COLLECTION_ROW_INVALID");
    return {
      id: collection.id,
      customerName,
      month: formatCollectionMonth(collection.monat),
      orderCount,
    };
  });

  const surfaces = new Map<string, typeof orders>();
  for (const order of orders) {
    if (!isBundleStationForToday(order.station)) continue;
    const surface = order.surfaceRequested?.trim();
    if (!surface) continue;
    const group = surfaces.get(surface) ?? [];
    group.push(order);
    surfaces.set(surface, group);
  }
  const bundle = [...surfaces.entries()].filter(([, group]) => group.length >= 2).sort((a, b) => b[1].length - a[1].length)[0];
  if (STAGE2_TODAY_FEATURES.has("bundle") && bundle) add({ key: `bundle:${bundle[0]}`, field: "bundle", kind: "bundle", title: `${bundle[1].length} Aufträge bündeln`, meta: bundle[0], urgency: "decision", bundleSurface: bundle[0], primaryActionLabel: "Bündel öffnen" });

  const ownTaskKeys=new Set(followupsKnown?quoteFollowups.tasks.filter(task=>task.isMine===true).map(task=>'task:'+task.id):[]);
  if(responsibilitySource.code==='OK'){
    const itemIds=new Set(items.flatMap(item=>item.orderId?[item.orderId]:[]));
    for(const id of responsibilitySource.data.keys())if(!itemIds.has(id))responsibilitySource.data.delete(id);
    responsibilitySource.data.unavailableOrderIds=responsibilitySource.data.unavailableOrderIds.filter(id=>itemIds.has(id));
  }
  const mine=(item:TodayItem)=>ownTaskKeys.has(item.key)||item.kind!=='complaint'&&!!item.orderId&&responsibilitySource.code==='OK'&&responsibilitySource.data.get(item.orderId)===auth.userId;
  const sortedItems=sortTodayByResponsibility(items,mine);
  const challenges=projectTodayChallenges(orderActions.rows,overdueInvoices.map(row=>({id:row.id,orderId:row.order_id,number:row.invoice_number,dueDate:dateOnly(row.due_date!),amountCents:row.open_amount_cents,amount:Number.isSafeInteger(Number(row.open_amount_cents))&&Number(row.open_amount_cents)>0?euro(row.open_amount_cents):null})),today,moneyAllowed?quoteActions.rows:[]);
  const challengeMissing=[...challenges.missing,...(graphAllowed&&moneyAllowed&&quoteActions.code!=='OK'?['CHALLENGE_QUOTE_SOURCE']:[]),...(orderActions.code!=='OK'?['CHALLENGE_ORDER_SOURCE']:[]),...(support.invoiceSource.code!=='OK'?['CHALLENGE_INVOICE_SOURCE']:[]),...(!complaintsKnown||complaintCases.length?['CHALLENGE_COMPLAINT_SOURCE']:[]),...(graphAllowed&&(graph.code!=='OK'||graph.messages.some(row=>row.usage==='offen'&&(row.sendState==='unklar'||row.sendState==='fehler'||row.openConcerns.some(kind=>['kv_annahme','kv_ablehnung','reklamation'].includes(kind)))))?['CHALLENGE_CONCERN_SOURCE']:[])];

  // PL16:17: bind the existing most urgent case to its very same U2 command.
  // Missing specialist bindings remain gaps; no substitute sender/command.
  let hauptaktion:U2Read['hauptaktion']=null;
  let hauptaktionsQuelle:{key:string;id:string;version:number}|null=null;
  const mainMissing:string[]=[];
  const needsAction=(read:U2Read)=>read.farbe==='ral'||read.farbe==='warn';
  const challengeFocus=challenges.groups[0];
  if(challengeFocus){
    const source=challengeFocus.quoteId?quoteActions.rows.find(row=>row.quoteId===challengeFocus.quoteId):orderActions.rows.find(row=>row.orderId===challengeFocus.orderId);
    if(challengeFocus.action&&source?.read.hauptaktion&&needsAction(source.read)){
      hauptaktion=source.read.hauptaktion;
      hauptaktionsQuelle={key:challengeFocus.key,id:'quoteId'in source?source.quoteId:source.orderId,version:source.version};
    }else if(!source||needsAction(source.read))mainMissing.push('TODAY_MAIN_U2:'+challengeFocus.key);
  }else{
    // Bundle is a later-stage feature, not a new S05 main action.
    let selected:{key:string;id:string;version:number;read:U2Read}|undefined;
    for(const focus of sortedItems.filter(item=>item.kind!=='bundle')){
      if(focus.target?.screen==='kv'){
        const source=quoteActions.rows.find(row=>row.quoteId===focus.target!.arg);
        if(source)selected={key:focus.key,id:source.quoteId,version:source.version,read:source.read};
      }else if(focus.kind==='mail'&&graph.code==='OK'){
        const originals=graph.messages.filter(row=>row.graphMessageId===focus.graphMessageId);
        const source=originals.length===1?messageActions.rows.find(row=>row.messageId===originals[0].id):undefined;
        if(source)selected={key:focus.key,id:source.messageId,version:source.version,read:source.read};
      }else if(focus.orderId){
        const source=orderActions.rows.find(row=>row.orderId===focus.orderId);
        if(source)selected={key:focus.key,id:source.orderId,version:source.version,read:source.read};
      }
      if(!selected)mainMissing.push('TODAY_MAIN_SOURCE:'+focus.key);
      if(selected&&needsAction(selected.read))break;
      selected=undefined;
    }
    if(!selected){
      // Normal production and active quotes remain daily work before becoming
      // late. Dates/facts and commands are already qualified above, not reread.
      const dates=new Map(orderSchedule.sources.map(row=>[row.id,row.dueDate]));
      const candidates:Array<{key:string;id:string;version:number;read:U2Read;date:string|null;number:string}>=[];
      for(const row of orderActions.rows){
        if(!needsAction(row.read))continue;
        const location=row.read.erstblick.find(field=>field.key==='auftrag.lage')?.werte;
        if(!['angenommen','wareneingang','galvanik'].includes(String(location?.station)))continue;
        candidates.push({key:'order:'+row.orderId,id:row.orderId,version:row.version,read:row.read,date:dates.get(row.orderId)??null,number:typeof location?.nummer==='string'?location.nummer:row.orderId});
      }
      for(const schedule of quoteSchedule.sources){
        if(schedule.state!=='active')continue;
        const row=quoteActions.rows.find(value=>value.quoteId===schedule.id&&value.version===schedule.version);
        if(!row){mainMissing.push('TODAY_MAIN_QUOTE_SOURCE:'+schedule.id);continue;}
        if(!needsAction(row.read))continue;
        const number=row.read.erstblick.find(field=>field.key==='kv.lage')?.werte.nummer;
        candidates.push({key:'quote:'+row.quoteId,id:row.quoteId,version:row.version,read:row.read,date:schedule.dueDate,number:typeof number==='string'?number:row.quoteId});
      }
      for(const row of messageActions.rows){
        if(!needsAction(row.read))continue;
        const original=graph.code==='OK'?graph.messages.find(value=>value.id===row.messageId&&value.version===row.version):undefined;
        if(!original){mainMissing.push('TODAY_MAIN_MESSAGE_SOURCE:'+row.messageId);continue;}
        if(original.fallbackPriority?.code==='OK'&&original.fallbackPriority.rank===8)continue;
        candidates.push({key:'message:'+row.messageId,id:row.messageId,version:row.version,read:row.read,date:null,number:row.messageId});
      }
      selected=candidates.sort((a,b)=>(a.date??'9999').localeCompare(b.date??'9999')||a.number.localeCompare(b.number))[0];
    }
    if(selected){
      hauptaktion=selected.read.hauptaktion;
      if(hauptaktion)hauptaktionsQuelle={key:selected.key,id:selected.id,version:selected.version};
      if(!hauptaktion&&selected.read.datenluecken.length)mainMissing.push('TODAY_MAIN_U2:'+selected.key);
    }
  }

  if(graphAllowed)for(const task of taskSchedule.rows)if(task.state==='active')mainMissing.push('TODAY_TASK_MAIN_BINDING:'+task.id);


  return {
    hauptaktion,hauptaktionsQuelle,
    calendar,
    ...(graphAllowed?{quoteActions,quoteSchedule,taskSchedule,messageActions}:{}),
    items:sortedItems,
    challenges:{code:challengeMissing.length?'SOURCE_INCOMPLETE':'OK',groups:challenges.groups,missing:challengeMissing},
    ...(ordersAllowed?{orderActions,orderSchedule}:{}),
    ...(moneyAllowed?{invoiceMoney}:{}),
    ...(moneyAllowed?{moneySources:{invoices:countTodaySource(support.invoiceSource),prepayments:countTodaySource(support.prepaymentSource),collections:countTodaySource(support.collectionSource)}}:{}),
    ...(moneyAllowed?{moneyMetric:invoiceMoney.code==='OK'?{code:'OK' as const,count:overdueInvoices.length,sources:overdueInvoices.map(row=>({id:row.id,version:row.payment_version}))}:{code:'SOURCE_INCOMPLETE' as const}}:{}),
    ...(graphAllowed?{assignmentMetric:assignmentMessages?{code:'OK' as const,count:assignmentMessages.length,sources:assignmentMessages.map(row=>({id:row.id,version:row.version}))}:{code:'SOURCE_INCOMPLETE' as const}}:{}),
    datenluecken:[...support.supportMissing,...mainMissing,...challengeMissing,...(graphAllowed&&messageActions.code!=='OK'?['MESSAGE_ACTION_SOURCE']:[]),...(graphAllowed&&!taskKnown?['INTAKE_TASK_SOURCE']:[]),...(graphAllowed&&quoteSchedule.code==='SOURCE_INCOMPLETE'?quoteSchedule.missing:[]),...(graphAllowed&&quoteActions.code!=='OK'?['QUOTE_ACTION_SOURCE']:[]),...(moneyAllowed&&invoiceMoney.code==='SOURCE_INCOMPLETE'?invoiceMoney.missing:[]),...(ordersAllowed&&orderSchedule.code==='SOURCE_INCOMPLETE'?orderSchedule.missing:[]),...(ordersAllowed&&orderSource.code!=='OK'?['ORDER_SOURCE']:[]),...(ordersAllowed&&orderActions.code!=='OK'?['ORDER_ACTION_SOURCE']:[]),...(moneyAllowed&&support.prepaymentSource.code!=='OK'?['PREPAYMENT_SOURCE']:[]),...(moneyAllowed&&support.collectionSource.code!=='OK'?['COLLECTION_SOURCE']:[]),...(moneyAllowed&&support.invoiceSource.code!=='OK'?['INVOICE_SOURCE']:[]),...(graphAllowed&&graph.code!=='OK'?['MESSAGE_SOURCE']:[]),...(!complaintsKnown?['COMPLAINT_SOURCE']:[]),...(!followupsKnown?['QUOTE_FOLLOWUP_SOURCE']:[]),...(support.assignmentSourceIncomplete||responsibilitySource.code!=='OK'||responsibilitySource.data.unavailableOrderIds.length?['ORDER_ASSIGNMENT_SOURCE']:[])],
    ...(support.collectionSource.code==='OK'?{collectionNotices}:{}),
    visibleFields: selected,
    layout,
    defaultLayout: suggestedLayout,
    allowedFields: DEFAULT_FIELDS.filter((field) => allowed.has(field)),
    delegationTargets: support.delegationTargets.map((target) => ({ userId: target.id, displayName: target.full_name })),
    outlookMessage: !graphAllowed || graph.code === "OK" ? null : graph.message,
  };
}

export async function readTodayDashboard(auth: AuthorizationSnapshot,readComplaints:()=>Promise<ComplaintReadResult>,readQuoteFollowups:()=>Promise<{code:'OK';tasks:TodayQuoteFollowup[]}|{code:string;message:string}>,readNow=new Date(),operationalSource?:ReturnType<typeof getOperationalOrders>): Promise<TodayDashboard> {
  const diagnosticStarted=Date.now();
  const sources=await collectTodaySources(auth,readComplaints,readQuoteFollowups,readNow,operationalSource);
  const dashboard=composeTodayDashboard(auth,sources,sources.calendar);
  const {access,orderSource,graph,support,complaints,quoteFollowups,companyLetter,batch,quoteList,taskRead}=sources;
  const {orders:ordersAllowed,messages:graphAllowed,money:moneyAllowed}=access;
  const orders=orderSource.code==='OK'?orderSource.data:[];
  const calendar=sources.calendar,today=calendar.today;
  logPageReadPhase('today.model',diagnosticStarted,{rows:dashboard.items.length,actions:dashboard.orderActions?.rows.length??0,missing:dashboard.orderActions?.missingOrderIds.length??0});
  await observeTodayModelShadow(auth,today,{
   orders:ordersAllowed&&orderSource.code==='OK'?orders.length:null,
   orderCards:ordersAllowed&&batch?.code==='OK'?batch.data.rows.filter(row=>row.result.code==='OK').length:null,
   messages:graphAllowed&&graph.code==='OK'?graph.messages.length:null,
   invoices:moneyAllowed&&support.invoiceSource.code==='OK'?support.invoiceSource.data.length:null,
   prepayments:moneyAllowed&&support.prepaymentSource.code==='OK'?support.prepaymentSource.data.length:null,
   collections:moneyAllowed&&support.collectionSource.code==='OK'?support.collectionSource.data.length:null,
   invoiceMailGroups:access.invoiceMail&&support.invoiceMailSource.code==='OK'?support.invoiceMailSource.data.groups.length:null,
   complaints:access.complaints&&complaints.code==='OK'?complaints.complaints.length:null,
   quoteFollowups:graphAllowed&&quoteFollowups.code==='OK'&&'tasks'in quoteFollowups?quoteFollowups.tasks.length:null,
   quotes:graphAllowed&&quoteList.code==='OK'?quoteList.quotes.length:null,
   tasks:graphAllowed&&taskRead&&'rows'in taskRead&&taskRead.code==='OK'?taskRead.rows.length:null,
   company:access.company&&companyLetter.code==='OK'&&'companyName'in companyLetter?1:null,
  });
  return dashboard;
}

export async function saveTodayPreferences(auth: AuthorizationSnapshot, value: unknown) {
  const normalized = parseTodayLayout(value);
  const allowed = allowedTodayFields(auth);
  if (!normalized || normalized.some((item) => !allowed.has(item.field))) return { code: "VALIDATION_ERROR" as const, message: "Feldanordnung ist ungültig oder nicht erlaubt." };
  const visible = normalized.map((item) => item.field).filter((field): field is TodayVisibleField => field !== "action");
  await withPrivilegedTenantTransaction(auth, async (tx) => {
    await tx.execute(sql`
      INSERT INTO private.today_preferences (tenant_id, actor_id, visible_fields, layout)
      VALUES (
        ${auth.tenantId},
        ${auth.userId}::uuid,
        ARRAY(SELECT jsonb_array_elements_text(${JSON.stringify(visible)}::jsonb)),
        ${JSON.stringify(normalized)}::jsonb
      )
      ON CONFLICT (tenant_id, actor_id) DO UPDATE SET visible_fields=EXCLUDED.visible_fields, layout=EXCLUDED.layout, updated_at=statement_timestamp()
    `);
    await tx.execute(sql`
      INSERT INTO public.ui_events (tenant_id, event_type, payload)
      VALUES (
        ${auth.tenantId},
        'today_preferences_saved',
        jsonb_build_object('actorId', ${auth.userId}::text)
      )
    `);
  });
  return { code: "OK" as const };
}

export async function saveTodayReminder(auth: AuthorizationSnapshot, input: { itemKey: string; mode: TodayReminderMode; dueDate?: string }) {
  if (!input.itemKey || input.itemKey.length > 300 || !["afternoon", "tomorrow", "after_due"].includes(input.mode)) return { code: "VALIDATION_ERROR" as const, message: "Erinnerung ist ungültig." };
  const decision = deriveTodayReminder(input.mode, input.dueDate, new Date());
  if (!decision) return { code: "VALIDATION_ERROR" as const, message: "Diese Erinnerung ist für den aktuellen Termin nicht möglich." };
  await withPrivilegedTenantTransaction(auth, async (tx) => {
    await tx.execute(sql`
      INSERT INTO private.today_reminders (tenant_id, actor_id, item_key, reminder_until, reminder_mode)
      VALUES (${auth.tenantId}, ${auth.userId}::uuid, ${input.itemKey}, ${decision.until.toISOString()}::timestamptz, ${input.mode})
      ON CONFLICT (tenant_id, actor_id, item_key) DO UPDATE SET reminder_until=EXCLUDED.reminder_until, reminder_mode=EXCLUDED.reminder_mode, updated_at=statement_timestamp()
    `);
    await tx.execute(sql`
      INSERT INTO public.ui_events (tenant_id, event_type, payload)
      VALUES (
        ${auth.tenantId},
        'today_reminder_saved',
        jsonb_build_object('actorId', ${auth.userId}::text, 'itemKey', ${input.itemKey}::text, 'mode', ${input.mode}::text)
      )
    `);
  });
  return { code: "OK" as const, message: decision.message, data: { reminderUntil: decision.until.toISOString() } };
}

// Qualified model collection shares this one live/compose source contract.
export type TodayModelSourceRow={
 kind:string;sourceId:string;status:string;listed:boolean;sourceVersion:number|null;
 currentVersion:number|null;current:boolean;fresh:boolean;payload:unknown;errorCode:string|null;
 builtAt:string|null;needsRebuild:boolean;
};
/** The caller owns the one settings/model/actor transaction. Stale payloads
 * never cross this SQL boundary, even if a caller later mishandles freshness.
 * Original field facts and actor masks are composed by their existing readers. */
export async function readTodayModelInTransaction(tx:PrivilegedTenantTransaction,context:{tenantId:string},today:string){
 return withPageReadPhase('today.model.read',async()=>{
  const current=sql`source.source_seq=source.built_seq
   AND source.built_tenant_seq=tenant.tenant_seq AND source.built_day=${today}::date
   AND source.projector_version=${TODAY_PROJECTOR_VERSION}
   AND (source.kind<>'order' OR source.listed AND orders.version=source.source_version)`;
  const rows=await tx.execute<TodayModelSourceRow>(sql`SELECT source.kind,source.source_id AS "sourceId",source.status,source.listed,
   source.source_version AS "sourceVersion",orders.version AS "currentVersion",${current} AS current,(${current} AND source.status='OK') AS fresh,
   CASE WHEN ${current} AND source.status IN ('OK','SOURCE_INCOMPLETE') THEN source.payload ELSE NULL END AS payload,source.error_code AS "errorCode",source.built_at::text AS "builtAt",
   source.built_tenant_seq<>tenant.tenant_seq OR source.built_day IS DISTINCT FROM ${today}::date
    OR source.projector_version<>${TODAY_PROJECTOR_VERSION} AS "needsRebuild"
   FROM private.today_tenant_v1 tenant JOIN private.today_source_v1 source ON source.tenant_id=tenant.tenant_id
   LEFT JOIN public.orders orders ON source.kind='order' AND orders.tenant_id=source.tenant_id AND orders.id=source.source_id
   WHERE tenant.tenant_id=${context.tenantId} AND (source.source_id='*' OR source.kind='order' AND source.listed)
   ORDER BY source.kind,source.source_id`);
  if(!rows.some(row=>row.builtAt!==null))return {code:'EMPTY' as const,rows:[] as TodayModelSourceRow[],needsRebuild:true};
  return {code:'OK' as const,rows:[...rows],needsRebuild:rows.some(row=>row.needsRebuild)||TODAY_MODEL_LIST_KINDS.some(kind=>!rows.some(row=>row.kind===kind&&row.sourceId==='*'))};
 },result=>({rows:result.rows.length,fresh:result.rows.filter(row=>row.fresh===true).length,stale:result.rows.filter(row=>row.fresh!==true).length}));
}

export type TodayModelReadPorts={
 readSettings:(tx:PrivilegedTenantTransaction,auth:AuthorizationSnapshot)=>Promise<{today:TodayReadSettings;page:PageReadSettings|null}>;
 messages:(auth:AuthorizationSnapshot,value:unknown)=>TodayDashboardSources['graph'];
 tasks:(auth:AuthorizationSnapshot,value:unknown)=>NonNullable<TodayDashboardSources['taskRead']>;
 complaints:(auth:AuthorizationSnapshot,value:unknown)=>TodayDashboardSources['complaints'];
 followups:(auth:AuthorizationSnapshot,value:unknown)=>TodayDashboardSources['quoteFollowups'];
 quotes:(auth:AuthorizationSnapshot,value:unknown,readAt:Date)=>Pick<TodayDashboardSources,'quoteList'|'quoteReads'>;
};
export const modelRecord=(value:unknown):Record<string,unknown>|null=>value!==null&&typeof value==='object'&&!Array.isArray(value)?value as Record<string,unknown>:null;

/** One transaction owns settings, qualified model rows and the same live actor
 * kernels. Module masks are bound by the App, never by a second domain reader. */
export async function readTodaySourcesFromModel(auth:AuthorizationSnapshot,ports:TodayModelReadPorts,readAt=new Date()){
 const calendar=readTodayCalendar(readAt),access=todaySourceAccess(authorizationReadContext(auth));
 return withPrivilegedTenantTransaction(auth,async tx=>{
  const settings=await ports.readSettings(tx,auth);
  if(settings.page!==null)configurePageReadBudget(settings.page.queryTimeoutMs);
  if(settings.today.todayReadSource==='live')return {code:'LIVE' as const,settings};
  const model=await withTenantSavepoint(tx,nested=>readTodayModelInTransaction(nested,auth,calendar.today));
  if(model.code==='EMPTY')return {code:'EMPTY' as const,settings};
  const value=(kind:string)=>{const row=model.rows.find(source=>source.kind===kind&&source.sourceId==='*');return row?.current===true?row.payload:null;};
  const project=<T>(kind:string,unknown:T,work:(payload:unknown)=>T):T=>{
   const payload=value(kind);if(payload===null)return unknown;
   try{return work(payload);}catch{console.error('[TODAY_MODEL_SOURCE_INVALID]',{kind,code:'SOURCE_INCOMPLETE'});return unknown;}
  };
  const storedOrders=value('orders');
  const operationalSource:TodayDashboardSources['orderSource']=Array.isArray(storedOrders)&&storedOrders.every(row=>modelRecord(row)&&typeof row.id==='string'&&Number.isSafeInteger(row.version))?{code:'OK',data:storedOrders as Extract<TodayDashboardSources['orderSource'],{code:'OK'}>['data']}:{code:'SOURCE_INCOMPLETE'};
  const orderSource:TodayDashboardSources['orderSource']=access.orders?operationalSource:{code:'OK',data:[]};
  const orders=orderSource.code==='OK'?orderSource.data:[];
  const unknownGraph:TodayDashboardSources['graph']={code:'SOURCE_INCOMPLETE',message:PAGE_READ_COPY.sourceIncomplete};
  const graph=access.messages?project<TodayDashboardSources['graph']>('messages',unknownGraph,payload=>ports.messages(auth,payload)):{code:'FORBIDDEN' as const,message:''};
  const unknownMoney=unknownTodayMoneySupport();
  const money=maskTodayMoneySupport(auth,project<Parameters<typeof maskTodayMoneySupport>[1]>('money',unknownMoney,payload=>{
   const row=modelRecord(payload);if(!row||!Array.isArray(row.supportMissing)||!Array.isArray(row.invoices)||!Array.isArray(row.prepayments)||!Array.isArray(row.collections)
    ||!modelRecord(row.invoiceSource)||!modelRecord(row.prepaymentSource)||!modelRecord(row.collectionSource)||!modelRecord(row.invoiceMailSource))throw Error('TODAY_MODEL_MONEY_INVALID');
   return row as unknown as Parameters<typeof maskTodayMoneySupport>[1];
  }));
  const unknownComplaints:TodayDashboardSources['complaints']={code:'SOURCE_INCOMPLETE',message:'TODAY_COMPLAINT_SOURCE'};
  const complaints=access.complaints?project<TodayDashboardSources['complaints']>('complaints',unknownComplaints,payload=>ports.complaints(auth,payload)):{code:'OK' as const,complaints:[]};
  const unknownFollowups:TodayDashboardSources['quoteFollowups']={code:'SOURCE_INCOMPLETE',message:'TODAY_QUOTE_FOLLOWUP_SOURCE'};
  const quoteFollowups=access.messages?project<TodayDashboardSources['quoteFollowups']>('quote_followups',unknownFollowups,payload=>ports.followups(auth,payload)):{code:'OK' as const,tasks:[]};
  const unknownTasks:NonNullable<TodayDashboardSources['taskRead']>={code:'SOURCE_INCOMPLETE',rows:[],missingTaskIds:[]};
  const taskRead=access.messages?project<NonNullable<TodayDashboardSources['taskRead']>>('tasks',unknownTasks,payload=>ports.tasks(auth,payload)):null;
  const unknownQuotes:Pick<TodayDashboardSources,'quoteList'|'quoteReads'>={quoteList:{code:'SOURCE_INCOMPLETE'},quoteReads:[]};
  const {quoteList,quoteReads}=access.messages?project('quotes',unknownQuotes,payload=>ports.quotes(auth,payload,readAt)):{quoteList:{code:'OK' as const,quotes:[]},quoteReads:[]};
  const company=modelRecord(value('company')),companyData=modelRecord(company?.company);
  const companyLetter:TodayDashboardSources['companyLetter']=!access.company?{code:'FORBIDDEN'}
   :company?.code==='OK'&&typeof companyData?.companyName==='string'?{code:'OK',companyName:companyData.companyName}
   :company?.code==='VALIDATION_ERROR'?{code:'OK'}:{code:'SOURCE_INCOMPLETE'};
  const rawRows:Parameters<typeof projectTodayOrderSources>[1]=orders.map(order=>{
   const row=model.rows.find(source=>source.kind==='order'&&source.sourceId===order.id),payload=modelRecord(row?.payload),result=modelRecord(payload?.result),data=modelRecord(result?.data),card=modelRecord(data?.card);
   if(row?.fresh===true&&result?.code==='OK'&&card?.id===order.id&&card?.version===order.version&&Array.isArray(data?.records)&&Array.isArray(card?.items))return {orderId:order.id,result:result as unknown as Extract<Parameters<typeof projectTodayOrderSources>[1][number]['result'],{code:'OK'}>};
   return {orderId:order.id,result:{code:'UNAVAILABLE',message:PAGE_READ_COPY.sourceIncomplete}};
  });
  const batch:TodayDashboardSources['batch']=access.orders?{code:'OK',data:{rows:projectTodayOrderSources(auth,rawRows)}}:null;
  const [person,delegation,responsibilitySource]=await Promise.all([
   readTodayPersonalSupportInTransaction(tx,auth),readTodayDelegationSupportInTransaction(tx,auth,access),
   readTodayResponsibilitiesInTransaction(tx,auth,todayResponsibilityIds(auth,orders,money,complaints)),
  ]);
  const support={...money,...person,...delegation,supportMissing:[...money.supportMissing,...person.supportMissing,...delegation.supportMissing]};
  const versions=model.rows.flatMap(row=>row.kind==='order'&&row.currentVersion!==null?[{id:row.sourceId,version:row.currentVersion}]:[]);
  const modelStaleOrderIds=orders.flatMap(order=>{const row=model.rows.find(source=>source.kind==='order'&&source.sourceId===order.id);return !row||row.fresh!==true&&row.status!=='SOURCE_INCOMPLETE'?[order.id]:[];});
  const sources:TodayDashboardSources={calendar,access,orderSource,graph,support,complaints,quoteFollowups,companyLetter,batch,versions,quoteList,quoteReads,taskRead,responsibilitySource,modelStaleOrderIds};
  const relevant=(kind:string)=>kind==='order'?access.orders:kind==='orders'?hasAnyAuthorizationArea(auth):kind==='money'?access.money||access.invoiceMail:kind==='company'?access.company:kind==='complaints'?access.complaints:access.messages;
  return {code:'OK' as const,sources,operationalSource,settings,needsRebuild:model.needsRebuild,
   pending:model.needsRebuild||model.rows.some(row=>relevant(row.kind)&&row.status!=='SOURCE_INCOMPLETE'&&row.fresh!==true),
   incomplete:model.rows.some(row=>relevant(row.kind)&&row.status==='SOURCE_INCOMPLETE')};
 });
}
