import type {U2Read,U2Action} from '@/lib/domain/u2ReadContract';
import type { AppRole } from "@/lib/auth/authorizationContract";

const TERMINAL_ORDER_STATES = new Set(["abgeholt", "versendet", "raus", "storniert", "cancelled", "canceled", "completed", "done", "erledigt"]);

export type TodayLayoutField = "action" | "today" | "assign" | "money" | "bundle";
export type TodayLayoutColumn = "left" | "right";
export type TodayLayoutItem = { field: TodayLayoutField; column: TodayLayoutColumn; order: number };
export type TodayReminderMode = "afternoon" | "tomorrow" | "after_due";
export type TodayReminderDecision = { until: Date; message: string };

const TODAY_LAYOUT_FIELDS = new Set<TodayLayoutField>(["action", "today", "assign", "money", "bundle"]);
const TODAY_LAYOUT_COLUMNS = new Set<TodayLayoutColumn>(["left", "right"]);
const BERLIN_TIME_ZONE = "Europe/Berlin";
const DATE_KEY = /^(\d{4})-(\d{2})-(\d{2})$/;

type CalendarDay = { year: number; month: number; day: number };
type BerlinClock = CalendarDay & { hour: number; minute: number };

function berlinClock(value: Date): BerlinClock {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: BERLIN_TIME_ZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).formatToParts(value);
  const part = (type: "year" | "month" | "day" | "hour" | "minute") => Number(parts.find((entry) => entry.type === type)?.value);
  return { year: part("year"), month: part("month"), day: part("day"), hour: part("hour"), minute: part("minute") };
}

function dateKey(day: CalendarDay): string {
  return `${day.year.toString().padStart(4, "0")}-${day.month.toString().padStart(2, "0")}-${day.day.toString().padStart(2, "0")}`;
}

function parseDateKey(value: string | undefined): CalendarDay | null {
  const match = value?.match(DATE_KEY);
  if (!match) return null;
  const day = { year: Number(match[1]), month: Number(match[2]), day: Number(match[3]) };
  const check = new Date(Date.UTC(day.year, day.month - 1, day.day));
  return check.getUTCFullYear() === day.year && check.getUTCMonth() === day.month - 1 && check.getUTCDate() === day.day ? day : null;
}

function addCalendarDays(day: CalendarDay, amount: number): CalendarDay {
  const value = new Date(Date.UTC(day.year, day.month - 1, day.day + amount));
  return { year: value.getUTCFullYear(), month: value.getUTCMonth() + 1, day: value.getUTCDate() };
}

/** S05: one server read clock, with seven calendar days in Europe/Berlin. */
export function readTodayCalendar(now=new Date()){
 const day=berlinClock(now);
 return {readStartedAt:now.toISOString(),today:dateKey(day),throughDate:dateKey(addCalendarDays(day,7))};
}

function nextWorkday(day: CalendarDay): CalendarDay {
  let candidate = addCalendarDays(day, 1);
  while ([0, 6].includes(new Date(Date.UTC(candidate.year, candidate.month - 1, candidate.day)).getUTCDay())) candidate = addCalendarDays(candidate, 1);
  return candidate;
}

function berlinDate(day: CalendarDay, hour: number): Date {
  const desired = Date.UTC(day.year, day.month - 1, day.day, hour);
  let instant = new Date(desired);
  for (let attempt = 0; attempt < 3; attempt += 1) {
    const actual = berlinClock(instant);
    const actualAsUtc = Date.UTC(actual.year, actual.month - 1, actual.day, actual.hour, actual.minute);
    instant = new Date(instant.getTime() + desired - actualAsUtc);
  }
  return instant;
}

function shortWeekday(value: Date): string {
  return new Intl.DateTimeFormat("de-DE", { timeZone: BERLIN_TIME_ZONE, weekday: "short" }).format(value).replace(".", "");
}

export function deriveTodayReminder(mode: TodayReminderMode, dueDate: string | undefined, now = new Date()): TodayReminderDecision | null {
  const clock = berlinClock(now);
  const today = { year: clock.year, month: clock.month, day: clock.day };
  const todayKey = dateKey(today);
  const due = parseDateKey(dueDate);
  const dueKey = due ? dateKey(due) : null;
  const deadlineReached = dueKey !== null && dueKey <= todayKey;

  if (mode === "afternoon") {
    if (clock.hour >= 14) return null;
    const until = berlinDate(today, 14);
    return until > now ? { until, message: "Aufgeschoben bis heute 14:00 · zählt weiter mit" } : null;
  }
  if (deadlineReached) return null;
  if (mode === "tomorrow") {
    const until = berlinDate(nextWorkday(today), 7);
    return { until, message: `Aufgeschoben bis ${shortWeekday(until)} 07:00 · zählt weiter mit` };
  }
  if (!due || dueKey === null || dueKey <= todayKey) return null;
  const until = berlinDate(nextWorkday(due), 7);
  const label = new Intl.DateTimeFormat("de-DE", { timeZone: BERLIN_TIME_ZONE, day: "2-digit", month: "2-digit", year: "numeric" }).format(until);
  return { until, message: `Aufgeschoben bis ${label} 07:00 · zählt weiter mit` };
}

const TEMPLATE_LAYOUTS: Record<"meister" | "werkstatt" | "developer" | "leer", Array<Omit<TodayLayoutItem, "order">>> = {
  meister: [
    { field: "action", column: "left" },
    { field: "assign", column: "left" },
    { field: "today", column: "right" },
    { field: "money", column: "right" },
  ],
  werkstatt: [
    { field: "action", column: "left" },
    { field: "bundle", column: "left" },
    { field: "today", column: "right" },
  ],
  developer: [{ field: "action", column: "left" }],
  leer: [{ field: "action", column: "left" }],
};

const TEMPLATE_KEY_BY_ROLE: Record<AppRole, keyof typeof TEMPLATE_LAYOUTS> = {
  developer: "developer",
  admin: "meister",
  meister: "meister",
  buero: "meister",
  werkstatt: "werkstatt",
  readonly: "leer",
};

export function parseTodayLayout(value: unknown): TodayLayoutItem[] | null {
  if (!Array.isArray(value) || value.length < 1 || value.length > TODAY_LAYOUT_FIELDS.size) return null;
  const parsed: TodayLayoutItem[] = [];
  for (const item of value) {
    if (!item || typeof item !== "object" || Array.isArray(item) || Object.keys(item).length !== 3) return null;
    const { field, column, order } = item as Record<string, unknown>;
    if (typeof field !== "string" || !TODAY_LAYOUT_FIELDS.has(field as TodayLayoutField)
      || typeof column !== "string" || !TODAY_LAYOUT_COLUMNS.has(column as TodayLayoutColumn)
      || typeof order !== "number" || !Number.isSafeInteger(order) || order < 0 || order >= value.length) return null;
    parsed.push({ field: field as TodayLayoutField, column: column as TodayLayoutColumn, order });
  }
  parsed.sort((a, b) => a.order - b.order);
  if (new Set(parsed.map((item) => item.field)).size !== parsed.length
    || new Set(parsed.map((item) => item.order)).size !== parsed.length
    || parsed.some((item, index) => item.order !== index)
    || parsed[0]?.field !== "action") return null;
  return parsed;
}

export function filterTodayLayout(layout: TodayLayoutItem[], allowed: ReadonlySet<TodayLayoutField>): TodayLayoutItem[] {
  return layout.filter((item) => item.field === "action" || allowed.has(item.field)).map((item, order) => ({ ...item, order }));
}

export function defaultTodayLayout(role: AppRole, allowed: ReadonlySet<TodayLayoutField>): TodayLayoutItem[] {
  const template = TEMPLATE_LAYOUTS[TEMPLATE_KEY_BY_ROLE[role]];
  return filterTodayLayout(template.map((item, order) => ({ ...item, order })), allowed);
}

type TodayOrder = {
  dueDate: string;
  risk: string;
  station: string;
  status: string;
};

type TodayMoneyCandidate = {
  customerCountry: string | null;
  dueDate: string | null;
  goodsOutRecorded: boolean;
  paymentMode: string;
  paymentStatus: string | null;
  station: string;
};

export type TodayMoneyCase = "overdue_invoice" | "open_prepayment";

export type TodayOrderGuidance = {
  field: "action" | "today";
  caseId: "due" | "finished_waiting" | "tight" | "problem" | "ready_today";
  primaryActionLabel: "Fertig melden" | "Ware raus" | "Kunde vorwarnen" | "Auftrag öffnen · Risiko gemeldet";
  reason: "due_today" | "overdue" | "finished_overdue" | "tight_schedule" | "reported_risk" | "ready_today";
};

const NOT_STARTED_STATIONS = new Set(["angenommen", "wareneingang", "eingang", "neu"]);
const BUNDLE_STATIONS = new Set(["angenommen", "wareneingang", "eingang", "galvanik"]);

export function isBundleStationForToday(station: string): boolean {
  return BUNDLE_STATIONS.has(station.trim().toLowerCase());
}

export function deriveOrderGuidance(order: TodayOrder, today: string): TodayOrderGuidance | null {
  const station = order.station.trim().toLowerCase();
  const status = order.status.trim().toLowerCase();
  if (TERMINAL_ORDER_STATES.has(station) || TERMINAL_ORDER_STATES.has(status)) return null;

  const dueDate = order.dueDate.slice(0, 10);
  const dueToday = dueDate === today;
  const overdue = Boolean(dueDate) && dueDate < today;
  const finished = station === "fertig" || status === "fertig";
  const risky = ["red", "blocked", "orange", "yellow"].includes(order.risk.trim().toLowerCase());

  if (overdue && finished) {
    return { field: "action", caseId: "finished_waiting", primaryActionLabel: "Ware raus", reason: "finished_overdue" };
  }
  if (overdue || (dueToday && !finished)) {
    return { field: "action", caseId: "due", primaryActionLabel: "Fertig melden", reason: overdue ? "overdue" : "due_today" };
  }
  if (risky && NOT_STARTED_STATIONS.has(station)) {
    return { field: "action", caseId: "tight", primaryActionLabel: "Kunde vorwarnen", reason: "tight_schedule" };
  }
  if (risky) {
    return { field: "action", caseId: "problem", primaryActionLabel: "Auftrag öffnen · Risiko gemeldet", reason: "reported_risk" };
  }
  if (dueToday && finished) {
    return { field: "today", caseId: "ready_today", primaryActionLabel: "Ware raus", reason: "ready_today" };
  }
  return null;
}

export function classifyOrderForToday(order: TodayOrder, today: string): "action" | "today" | null {
  return deriveOrderGuidance(order, today)?.field ?? null;
}

export function classifyMoneyForToday(candidate: TodayMoneyCandidate, today: string): TodayMoneyCase | null {
  const country = candidate.customerCountry?.trim().toLowerCase() ?? "";
  const foreignCustomer = country !== "" && country !== "de" && country !== "deutschland";
  if (candidate.goodsOutRecorded) return null;

  const paymentMode = candidate.paymentMode.trim().toLowerCase();
  const paymentStatus = candidate.paymentStatus?.trim().toLowerCase() ?? null;
  const station = candidate.station.trim().toLowerCase();
  if (paymentMode === "vorkasse") {
    return !foreignCustomer && station === "fertig" && paymentStatus !== "bezahlt" ? "open_prepayment" : null;
  }

  const dueDate = candidate.dueDate?.slice(0, 10) ?? "";
  return dueDate !== "" && dueDate < today && (paymentStatus === "offen" || paymentStatus === "teilbezahlt")
    ? "overdue_invoice"
    : null;
}

/** Personal ownership is only a tie breaker after actual urgency and deadline. */
export function sortTodayByResponsibility<T extends {urgency:'conflict'|'decision'|'warning';dueDate?:string}>(items:readonly T[],isMine:(item:T)=>boolean):T[]{
 const rank={conflict:0,decision:1,warning:2};return [...items].sort((a,b)=>rank[a.urgency]-rank[b.urgency]||(a.dueDate??'9999').localeCompare(b.dueDate??'9999')||Number(isMine(b))-Number(isMine(a)));
}

export type TodayChallengeReason={textKey:'day.challenge_late'|'day.challenge_debt';werte:Readonly<Record<string,string|number>>;sourceId:string};
export type TodayChallenge={key:string;orderId:string|null;orderNumber:string|null;rank:number;dueDate:string;reasons:TodayChallengeReason[];action:U2Action|null};
/** S05: only evidenced lateness/debt here, never a guessed capacity conflict.
 * Inputs are the same qualified U2 cards and already rights-filtered invoices. */
export function projectTodayChallenges(orderRows:ReadonlyArray<{orderId:string;version:number;read:U2Read}>,invoices:ReadonlyArray<{id:string;orderId:string;number:string;dueDate:string;amountCents:number|string|null;amount:string|null}>,today:string){
 const groups=new Map<string,TodayChallenge>(),missing:string[]=[];
 const cards=new Map(orderRows.map(row=>[row.orderId,row]));
 const add=(input:{orderId:string|null;orderNumber:string|null;rank:number;dueDate:string;action:U2Action|null;reason:TodayChallengeReason})=>{
  const key=input.orderId?'order:'+input.orderId:'invoice:'+input.reason.sourceId;
  const old=groups.get(key);
  if(old){old.rank=Math.min(old.rank,input.rank);old.dueDate=old.dueDate<input.dueDate?old.dueDate:input.dueDate;old.reasons.push(input.reason);if(input.reason.textKey==='day.challenge_debt')old.action=null;}
  else groups.set(key,{key,orderId:input.orderId,orderNumber:input.orderNumber,rank:input.rank,dueDate:input.dueDate,reasons:[input.reason],action:input.action});
 };
 for(const row of orderRows){
  const field=(key:string)=>row.read.erstblick.find(value=>value.key===key)?.werte;
  const location=field('auftrag.lage'),station=location?.station,number=location?.nummer;
  if(typeof station!=='string'||typeof number!=='string'){missing.push('CHALLENGE_ORDER_IDENTITY:'+row.orderId);continue;}
  if(['complaint','work_update','term_update'].includes(row.read.zustand??''))missing.push('CHALLENGE_REASON_BINDING:'+row.orderId);
  if(!['angenommen','wareneingang','galvanik'].includes(station))continue;
  const rawDue=field('auftrag.termin')?.datum,parts=field('auftrag.teile')?.teile;
  if(typeof rawDue!=='string'||!parseDateKey(rawDue.slice(0,10))||!Array.isArray(parts)||!parts.length||parts.some(part=>!part||typeof part!=='object'||typeof (part as Record<string,unknown>).fertig!=='boolean')){missing.push('CHALLENGE_ORDER_FACTS:'+row.orderId);continue;}
  const dueDate=rawDue.slice(0,10),allDone=parts.every(part=>(part as Record<string,unknown>).fertig===true);
  if(!allDone)missing.push('CHALLENGE_PLANNING_SOURCE:'+row.orderId);
  if(dueDate>=today||allDone)continue;
  add({orderId:row.orderId,orderNumber:number,rank:15,dueDate,action:row.read.hauptaktion,reason:{textKey:'day.challenge_late',werte:{date:dueDate},sourceId:row.orderId}});
 }
 for(const invoice of invoices){
  if(!Number.isSafeInteger(Number(invoice.amountCents))||Number(invoice.amountCents)<=0||typeof invoice.amount!=='string'||!invoice.amount||!parseDateKey(invoice.dueDate)||invoice.dueDate>=today){missing.push('CHALLENGE_INVOICE_FACTS:'+invoice.id);continue;}
  const card=cards.get(invoice.orderId),number=card?.read.erstblick.find(value=>value.key==='auftrag.lage')?.werte.nummer;
  add({orderId:invoice.orderId||null,orderNumber:typeof number==='string'?number:null,rank:10,dueDate:invoice.dueDate,action:null,reason:{textKey:'day.challenge_debt',werte:{amount:invoice.amount,date:invoice.dueDate,number:invoice.number},sourceId:invoice.id}});
  // The financial U2 command/step is explicitly incomplete until S08b.
  missing.push('CHALLENGE_PAYMENT_ACTION:'+invoice.id);
 }
 return {groups:[...groups.values()].sort((a,b)=>a.rank-b.rank||a.dueDate.localeCompare(b.dueDate)||(a.orderNumber??a.key).localeCompare(b.orderNumber??b.key)),missing};
}

export type TodayOrderScheduleRow={orderId:string;version:number;read:U2Read;pickupSchedule?:{code:'OK';date:string|null;eventId:string|null;freezeId:string}|{code:'SOURCE_INCOMPLETE'}};
/** Production-calendar slice of U3; finished/pickup dates are deliberately not
 * replaced by their former production date. Those need their own source. */
export function projectOrderSchedule(source:{code:'OK'|'SOURCE_INCOMPLETE';rows:ReadonlyArray<TodayOrderScheduleRow>;missingOrderIds:readonly string[]},calendar:ReturnType<typeof readTodayCalendar>){
 const missing=source.code==='OK'?[]:['ORDER_SCHEDULE_SOURCE',...source.missingOrderIds.map(id=>'ORDER_SCHEDULE_CARD:'+id)];
 const dates=new Map<string,{id:string;version:number;dueDate:string;appointmentEventId?:string;freezeId?:string}>(),conflicts=new Set<string>();
 for(const row of source.rows){
  if(conflicts.has(row.orderId))continue;
  const station=row.read.erstblick.find(field=>field.key==='auftrag.lage')?.werte.station;
  if(row.read.zustand==='closed')continue;
  let appointmentEventId:string|undefined,freezeId:string|undefined,raw:unknown;
  if(station==='fertig'&&row.pickupSchedule?.code==='OK'){
   if(row.pickupSchedule.date===null){
    if(row.read.zustand===null||['payment','debt'].includes(row.read.zustand))missing.push('ORDER_SCHEDULE_FINANCIAL_SOURCE:'+row.orderId);
    continue;
   }
   if(!row.pickupSchedule.eventId||!row.pickupSchedule.freezeId){missing.push('ORDER_SCHEDULE_PICKUP_EVIDENCE:'+row.orderId);continue;}
   raw=row.pickupSchedule.date;appointmentEventId=row.pickupSchedule.eventId;freezeId=row.pickupSchedule.freezeId;
  }else if(typeof station==='string'&&['angenommen','wareneingang','galvanik'].includes(station))raw=row.read.erstblick.find(field=>field.key==='auftrag.termin')?.werte.datum;
  else{missing.push('ORDER_SCHEDULE_NON_PRODUCTION:'+row.orderId);continue;}

  if(typeof raw!=='string'||!parseDateKey(raw.slice(0,10))){missing.push('ORDER_SCHEDULE_DATE:'+row.orderId);continue;}
  const dueDate=raw.slice(0,10),previous=dates.get(row.orderId);
  if(previous&&(previous.version!==row.version||previous.dueDate!==dueDate||previous.appointmentEventId!==appointmentEventId||previous.freezeId!==freezeId)){dates.delete(row.orderId);conflicts.add(row.orderId);missing.push('ORDER_SCHEDULE_VERSION:'+row.orderId);continue;}
  dates.set(row.orderId,{id:row.orderId,version:row.version,dueDate,...(appointmentEventId&&freezeId?{appointmentEventId,freezeId}:{})});
 }
 const sources=[...dates.values()],counts={today:sources.filter(row=>row.dueDate<=calendar.today).length,upcoming:sources.filter(row=>row.dueDate>calendar.today&&row.dueDate<=calendar.throughDate).length};
 return missing.length?{code:'SOURCE_INCOMPLETE' as const,knownCounts:counts,missing,sources}:{code:'OK' as const,...counts,sources};
}
