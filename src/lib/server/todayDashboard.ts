import {listOpenQuotesAction,readQuoteAction} from '@/app/actions/quotes.actions';
import {v45QuoteFacts} from '@/lib/server/v45QuoteRead';
import type {U2Read} from '@/lib/domain/u2ReadContract';
import "server-only";
import {readOrderResponsibilityForToday} from "@/lib/server/orderTaskAssignmentRead";

import { sql } from "drizzle-orm";
import { hasAuthorizationArea, type AuthorizationSnapshot } from "@/lib/server/authorization";
import { getOperationalOrders } from "@/lib/server/operationalOrders";
import {getLiveOrderCardAction} from '@/app/actions/orders.actions';
import {getIntakeTaskAction,getIntakeMessagesAction} from "@/app/actions/eingang.actions";
import { withTenantSavepoint, type PrivilegedTenantTransaction, withPrivilegedTenantTransaction } from "@/lib/server/privilegedDb";
import {complaintAttention,type ComplaintReadResult} from '@/modules/complaints/public';
import { projectIntakeTaskSchedule,projectQuoteSchedule,projectTodayInvoiceMoney,type TodayOrderScheduleRow,projectOrderSchedule,readTodayCalendar,projectTodayChallenges,sortTodayByResponsibility,classifyMoneyForToday, defaultTodayLayout, deriveOrderGuidance, deriveTodayReminder, filterTodayLayout, isBundleStationForToday, parseTodayLayout, type TodayLayoutField, type TodayLayoutItem, type TodayOrderGuidance, type TodayReminderMode } from "@/lib/server/todayDashboardPolicy";

export type TodayField = "action" | "today" | "assign" | "money" | "bundle";
export type TodayVisibleField = Exclude<TodayField, "action">;
export type { TodayLayoutItem } from "@/lib/server/todayDashboardPolicy";
export type TodayItem = {
  key: string;
  field: TodayField;
  kind: "order" | "mail" | "invoice" | "bundle" | "complaint" | "task";
  title: string;
  meta: string;
  urgency: "conflict" | "decision" | "warning";
  orderId?: string;
  orderVersion?: number;
  invoiceId?: string;
  graphMessageId?: string;
  target?:{screen:'reklamation'|'mail'|'aufgabe'|'kv';arg:string};
  bundleSurface?: string;
  dueDate?: string;
  snoozedUntil?: string;
  assignedToName?: string;
  assignmentVersion?: number;
  primaryActionLabel?: TodayOrderGuidance["primaryActionLabel"] | "Erinnern" | "Zahlung bestätigen" | "Bündel öffnen" | "Ergebnis festlegen" | "Gutschrift erteilen" | "Kunde informieren" | "Öffnen" | "Kunde erinnern";
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
type InvoiceRow = { payment_version:number;id: string; invoice_number: string; order_id: string; customer_name: string; customer_country: string | null; due_date: Date | string | null; open_amount_cents: number | string; payment_mode: string; payment_status: string; station: string };
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
  if (hasAuthorizationArea(auth, "geld")) allowed.add("money");
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
  try{return {code:'OK',data:await withTenantSavepoint(tx,read)};}
  catch{return {code:'SOURCE_INCOMPLETE'};}
}

export type TodayQuoteFollowup={isMine?:boolean;id:string;title:string;dueDate:string;quoteId:string;quoteNumber:string;customerName:string};
export async function readTodayDashboard(auth: AuthorizationSnapshot,readComplaints:()=>Promise<ComplaintReadResult>,readQuoteFollowups:()=>Promise<{code:'OK';tasks:TodayQuoteFollowup[]}|{code:string;message:string}>): Promise<TodayDashboard> {
  const calendar=readTodayCalendar(),today=calendar.today;
  const ordersAllowed = hasAuthorizationArea(auth, "auftraege");
  const graphAllowed = hasAuthorizationArea(auth, "mails");
  const moneyAllowed = hasAuthorizationArea(auth, "geld");
  const [orderSource, graph, support, complaints,quoteFollowups] = await Promise.all([
    ordersAllowed ? getOperationalOrders(auth).then(data=>({code:'OK' as const,data})).catch(()=>({code:'SOURCE_INCOMPLETE' as const})) : Promise.resolve({code:'OK' as const,data:[]}),
    graphAllowed ? getIntakeMessagesAction('offen') : Promise.resolve({ code: "FORBIDDEN" as const, message: "" }),
    withPrivilegedTenantTransaction(auth, async (tx) => {
      const invoiceSource=moneyAllowed ? await readTodaySource(tx,nested=>nested.execute<InvoiceRow>(sql`
          SELECT invoice.id, invoice.payment_version, invoice.invoice_number, invoice.order_id, customer.name AS customer_name,
                 customer.country AS customer_country, invoice.due_date,
                 invoice.payment_open_amount_cents AS open_amount_cents,
                 orders.payment_mode, invoice.payment_status, orders.station
          FROM public.invoices invoice
          JOIN public.orders orders ON orders.tenant_id=invoice.tenant_id AND orders.id=invoice.order_id
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
      const [preferences, reminders, delegationTargets, assignments] = await Promise.all([
        tx.execute<PreferenceRow>(sql`SELECT preference.visible_fields, to_jsonb(preference)->'layout' AS layout FROM private.today_preferences preference WHERE preference.tenant_id=${auth.tenantId} AND preference.actor_id=${auth.userId}::uuid LIMIT 1`),
        tx.execute<ReminderRow>(sql`SELECT item_key, reminder_until FROM private.today_reminders WHERE tenant_id=${auth.tenantId} AND actor_id=${auth.userId}::uuid`),
        ordersAllowed ? tx.execute<UserRow>(sql`
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
        `) : Promise.resolve([]),
        ordersAllowed ? tx.execute<AssignmentRow>(sql`
          SELECT order_id, assigned_to_name, current_order_version, integrity_ok
          FROM private.v_order_task_assignment_v1
          WHERE tenant_id=${auth.tenantId}
            AND assigned_by=${auth.userId}::uuid
            AND active=true
        `) : Promise.resolve([]),
      ]);
      return { preferences, reminders, invoiceSource,invoices:invoiceSource.code==='OK'?invoiceSource.data:[], prepaymentSource,prepayments:prepaymentSource.code==='OK'?prepaymentSource.data:[],collectionSource,collections:collectionSource.code==='OK'?collectionSource.data:[], delegationTargets, assignmentSourceIncomplete:assignments.some(row=>!row.integrity_ok),assignments:assignments.filter(row=>row.integrity_ok) };
    }),
    ['auftraege','entscheiden','geld','kunden'].some(area=>hasAuthorizationArea(auth,area as 'auftraege'|'entscheiden'|'geld'|'kunden'))?readComplaints().catch(()=>({code:'SOURCE_INCOMPLETE' as const,message:'TODAY_COMPLAINT_SOURCE'})):Promise.resolve({code:'OK' as const,complaints:[]}),
    graphAllowed?readQuoteFollowups().catch(()=>({code:'SOURCE_INCOMPLETE' as const,message:'TODAY_QUOTE_FOLLOWUP_SOURCE'})):Promise.resolve({code:'OK' as const,tasks:[]}),
  ]);

  const orders=orderSource.code==='OK'?orderSource.data:[];
  // U3 reuses the complete U2 response, qualified by the same order version.
  // A changed/unreadable card cannot silently supply a command for an older row.
  const orderActionReads=ordersAllowed?await Promise.all(orders.map(async order=>{
    try{
      const card=await getLiveOrderCardAction({orderId:order.id});
      if(card.code==='OK'&&card.data.card.version===order.version&&card.data.nextActionRule){
        const row:TodayOrderScheduleRow={orderId:order.id,version:order.version,read:card.data.nextActionRule};
        if(card.data.card.station==='fertig'&&card.data.card.handoverMode==='pickup'){
          row.pickupSchedule={code:'SOURCE_INCOMPLETE'};
          const appointment=card.data.pickupAppointment,freeze=card.data.card.freeze;
          if(appointment?.code==='OK'&&freeze){
            if(appointment.appointment===null)row.pickupSchedule={code:'OK',date:null,eventId:null,freezeId:freeze.freezeId};
            else if(appointment.appointment.orderId===order.id&&appointment.appointment.freezeId===freeze.freezeId)
              row.pickupSchedule={code:'OK',date:appointment.appointment.date,eventId:appointment.appointment.eventId,freezeId:freeze.freezeId};
          }
        }
        return row;
      }
    }catch{return {orderId:order.id,version:order.version,read:null};}
    return {orderId:order.id,version:order.version,read:null};
  })):[];
  const orderActions={code:orderSource.code==='OK'&&orderActionReads.every(row=>row.read!==null)?'OK' as const:'SOURCE_INCOMPLETE' as const,
    rows:orderActionReads.flatMap(row=>row.read?[{...row,read:row.read}]:[]),
    missingOrderIds:orderActionReads.filter(row=>row.read===null).map(row=>row.orderId)};

  const orderSchedule=projectOrderSchedule(orderActions,calendar);
  // The canonical list and operational U2 card are the only quote sources.
  // Raw financial list objects never escape this server composition.
  const quoteList=graphAllowed?await listOpenQuotesAction({purpose:'today'}):{code:'OK' as const,quotes:[]};
  const quoteReads=quoteList.code==='OK'?await Promise.all(quoteList.quotes.map(async quote=>{
    try{
      const card=await readQuoteAction({quoteId:quote.quoteId,purpose:'operations'});
      if(card.code==='OK'&&card.quote.version===quote.version&&card.quote.lifecycle){
        const row:TodayQuoteActionRow={quoteId:quote.quoteId,version:quote.version,read:card.nextActionRule,
          facts:v45QuoteFacts(card.quote,new Date(calendar.readStartedAt)),validUntil:card.quote.validUntil,followupAt:card.quote.lifecycle.followupAt};
        return row;
      }
    }catch{return {quoteId:quote.quoteId,read:null};}
    return {quoteId:quote.quoteId,read:null};
  })):[];
  const quoteActions={code:quoteList.code==='OK'&&quoteReads.every(row=>row.read!==null)?'OK' as const:'SOURCE_INCOMPLETE' as const,
    rows:quoteReads.flatMap(row=>row.read?[row as TodayQuoteActionRow]:[]),missingQuoteIds:quoteReads.filter(row=>row.read===null).map(row=>row.quoteId)};

  const taskRead=graphAllowed?await getIntakeTaskAction({calendar:true}):null;
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

  const invoiceMoney=projectTodayInvoiceMoney(support.invoiceSource,calendar);
  const overdueInvoiceRows=support.invoices.filter(invoice=>invoice.due_date!==null&&dateOnly(invoice.due_date)<today);
  const overdueInvoices=overdueInvoiceRows.filter(invoice=>classifyMoneyForToday({customerCountry:invoice.customer_country,dueDate:invoice.due_date===null?null:dateOnly(invoice.due_date),goodsOutRecorded:false,paymentMode:invoice.payment_mode,paymentStatus:invoice.payment_status,station:invoice.station},today)==='overdue_invoice');
  for (const invoice of overdueInvoices.slice(0,20)) {
    const dueDate = dateOnly(invoice.due_date!);
    add({ key: `invoice:${invoice.id}`, field: "money", kind: "invoice", title: `${invoice.invoice_number} · ${invoice.customer_name}`, meta: `${euro(invoice.open_amount_cents)} · fällig ${dueDate}`, urgency: "conflict", invoiceId: invoice.id, orderId: invoice.order_id, dueDate, primaryActionLabel: "Erinnern" });
  }

  for (const prepayment of support.prepayments.slice(0,20)) {
    const dueDate = prepayment.due_date ? dateOnly(prepayment.due_date) : null;
    if (classifyMoneyForToday({ customerCountry: prepayment.customer_country, dueDate, goodsOutRecorded: Number(prepayment.goods_out_event_count) > 0, paymentMode: "vorkasse", paymentStatus: prepayment.payment_status, station: prepayment.station }, today) !== "open_prepayment") continue;
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
  const responsible=await withPrivilegedTenantTransaction(auth,tx=>readOrderResponsibilityForToday(tx,auth,items.flatMap(item=>item.orderId?[item.orderId]:[])));
  const mine=(item:TodayItem)=>ownTaskKeys.has(item.key)||item.kind!=='complaint'&&!!item.orderId&&responsible.get(item.orderId)===auth.userId;
  const sortedItems=sortTodayByResponsibility(items,mine);
  const challenges=projectTodayChallenges(orderActions.rows,overdueInvoiceRows.map(row=>({id:row.id,orderId:row.order_id,number:row.invoice_number,dueDate:dateOnly(row.due_date!),amountCents:row.open_amount_cents,amount:Number.isSafeInteger(Number(row.open_amount_cents))&&Number(row.open_amount_cents)>0?euro(row.open_amount_cents):null})),today,moneyAllowed?quoteActions.rows:[]);
  const challengeMissing=[...challenges.missing,...(graphAllowed&&moneyAllowed&&quoteActions.code!=='OK'?['CHALLENGE_QUOTE_SOURCE']:[]),...(orderActions.code!=='OK'?['CHALLENGE_ORDER_SOURCE']:[]),...(support.invoiceSource.code!=='OK'?['CHALLENGE_INVOICE_SOURCE']:[]),...(!complaintsKnown||complaintCases.length?['CHALLENGE_COMPLAINT_SOURCE']:[]),...(graphAllowed&&(graph.code!=='OK'||graph.messages.some(row=>row.usage==='offen'&&(row.sendState==='unklar'||row.sendState==='fehler'||row.openConcerns.some(kind=>['kv_annahme','kv_ablehnung','reklamation'].includes(kind)))))?['CHALLENGE_CONCERN_SOURCE']:[])];

  // PL16:17: bind the existing most urgent case to its very same U2 command.
  // Missing specialist bindings remain gaps; no substitute sender/command.
  let hauptaktion:U2Read['hauptaktion']=null;
  let hauptaktionsQuelle:{key:string;id:string;version:number}|null=null;
  const mainMissing:string[]=[];
  const challengeFocus=challenges.groups[0];
  if(challengeFocus){
    const source=challengeFocus.quoteId?quoteActions.rows.find(row=>row.quoteId===challengeFocus.quoteId):orderActions.rows.find(row=>row.orderId===challengeFocus.orderId);
    if(challengeFocus.action&&source?.read.hauptaktion){
      hauptaktion=source.read.hauptaktion;
      hauptaktionsQuelle={key:challengeFocus.key,id:'quoteId'in source?source.quoteId:source.orderId,version:source.version};
    }else mainMissing.push('TODAY_MAIN_U2:'+challengeFocus.key);
  }else{
    // Bundle is a later-stage feature, not a new S05 main action.
    const focus=sortedItems.find(item=>item.kind!=='bundle');
    let selected:{key:string;id:string;version:number;read:U2Read}|undefined;
    if(focus){
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
    }else{
      // Normal production and active quotes remain daily work before becoming
      // late. Dates/facts and commands are already qualified above, not reread.
      const dates=new Map(orderSchedule.sources.map(row=>[row.id,row.dueDate]));
      const candidates:Array<{key:string;id:string;version:number;read:U2Read;date:string|null;number:string}>=[];
      for(const row of orderActions.rows){
        const location=row.read.erstblick.find(field=>field.key==='auftrag.lage')?.werte;
        if(!['angenommen','wareneingang','galvanik'].includes(String(location?.station)))continue;
        candidates.push({key:'order:'+row.orderId,id:row.orderId,version:row.version,read:row.read,date:dates.get(row.orderId)??null,number:typeof location?.nummer==='string'?location.nummer:row.orderId});
      }
      for(const schedule of quoteSchedule.sources){
        if(schedule.state!=='active')continue;
        const row=quoteActions.rows.find(value=>value.quoteId===schedule.id&&value.version===schedule.version);
        if(!row){mainMissing.push('TODAY_MAIN_QUOTE_SOURCE:'+schedule.id);continue;}
        const number=row.read.erstblick.find(field=>field.key==='kv.lage')?.werte.nummer;
        candidates.push({key:'quote:'+row.quoteId,id:row.quoteId,version:row.version,read:row.read,date:schedule.dueDate,number:typeof number==='string'?number:row.quoteId});
      }
      for(const row of messageActions.rows){
        const original=graph.code==='OK'?graph.messages.find(value=>value.id===row.messageId&&value.version===row.version):undefined;
        if(!original){mainMissing.push('TODAY_MAIN_MESSAGE_SOURCE:'+row.messageId);continue;}
        if(original.fallbackPriority?.code==='OK'&&original.fallbackPriority.rank===8)continue;
        candidates.push({key:'message:'+row.messageId,id:row.messageId,version:row.version,read:row.read,date:null,number:row.messageId});
      }
      selected=candidates.sort((a,b)=>(a.date??'9999').localeCompare(b.date??'9999')||a.number.localeCompare(b.number))[0];
    }
    if(selected){
      hauptaktion=selected.read.hauptaktion;
      hauptaktionsQuelle={key:selected.key,id:selected.id,version:selected.version};
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
    ...(moneyAllowed?{moneyMetric:invoiceMoney.code==='OK'?{code:'OK' as const,count:overdueInvoiceRows.length,sources:overdueInvoiceRows.map(row=>({id:row.id,version:row.payment_version}))}:{code:'SOURCE_INCOMPLETE' as const}}:{}),
    ...(graphAllowed?{assignmentMetric:assignmentMessages?{code:'OK' as const,count:assignmentMessages.length,sources:assignmentMessages.map(row=>({id:row.id,version:row.version}))}:{code:'SOURCE_INCOMPLETE' as const}}:{}),
    datenluecken:[...mainMissing,...challengeMissing,...(graphAllowed&&messageActions.code!=='OK'?['MESSAGE_ACTION_SOURCE']:[]),...(graphAllowed&&!taskKnown?['INTAKE_TASK_SOURCE']:[]),...(graphAllowed&&quoteSchedule.code==='SOURCE_INCOMPLETE'?quoteSchedule.missing:[]),...(graphAllowed&&quoteActions.code!=='OK'?['QUOTE_ACTION_SOURCE']:[]),...(moneyAllowed&&invoiceMoney.code==='SOURCE_INCOMPLETE'?invoiceMoney.missing:[]),...(ordersAllowed&&orderSchedule.code==='SOURCE_INCOMPLETE'?orderSchedule.missing:[]),...(ordersAllowed&&orderSource.code!=='OK'?['ORDER_SOURCE']:[]),...(ordersAllowed&&orderActions.code!=='OK'?['ORDER_ACTION_SOURCE']:[]),...(moneyAllowed&&support.prepaymentSource.code!=='OK'?['PREPAYMENT_SOURCE']:[]),...(moneyAllowed&&support.collectionSource.code!=='OK'?['COLLECTION_SOURCE']:[]),...(moneyAllowed&&support.invoiceSource.code!=='OK'?['INVOICE_SOURCE']:[]),...(graphAllowed&&graph.code!=='OK'?['MESSAGE_SOURCE']:[]),...(!complaintsKnown?['COMPLAINT_SOURCE']:[]),...(!followupsKnown?['QUOTE_FOLLOWUP_SOURCE']:[]),...(support.assignmentSourceIncomplete||responsible.unavailableOrderIds.length?['ORDER_ASSIGNMENT_SOURCE']:[])],
    ...(support.collectionSource.code==='OK'?{collectionNotices}:{}),
    visibleFields: selected,
    layout,
    defaultLayout: suggestedLayout,
    allowedFields: DEFAULT_FIELDS.filter((field) => allowed.has(field)),
    delegationTargets: support.delegationTargets.map((target) => ({ userId: target.id, displayName: target.full_name })),
    outlookMessage: !graphAllowed || graph.code === "OK" ? null : graph.message,
  };
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
