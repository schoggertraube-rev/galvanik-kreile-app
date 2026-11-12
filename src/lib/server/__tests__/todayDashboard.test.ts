import type {U2Read} from '@/lib/domain/u2ReadContract';
import {projectIntakeTaskSchedule,projectQuoteSchedule,projectTodayInvoiceMoney,projectOrderSchedule,readTodayCalendar,projectTodayChallenges} from '../todayDashboardPolicy';
import {sortTodayByResponsibility} from '../todayDashboardPolicy';
import { describe, expect, it } from "vitest";
import { classifyMoneyForToday, classifyOrderForToday, defaultTodayLayout, deriveOrderGuidance, deriveTodayReminder, filterTodayLayout, isBundleStationForToday, parseTodayLayout } from "@/lib/server/todayDashboardPolicy";

const TODAY = "2026-10-28";

function order(overrides: Partial<Parameters<typeof classifyOrderForToday>[0]> = {}) {
  return {
    dueDate: `${TODAY}T00:00:00.000Z`,
    risk: "green",
    station: "fertig",
    status: "fertig",
    ...overrides,
  };
}

describe("classifyOrderForToday", () => {
  it("shows only a finished order due today in Heute fällig", () => {
    expect(classifyOrderForToday(order(), TODAY)).toBe("today");
    expect(classifyOrderForToday(order({ station: "galvanik", status: "galvanik" }), TODAY)).toBe("action");
  });

  it("moves overdue and risky orders to Handlungsbedarf", () => {
    expect(classifyOrderForToday(order({ dueDate: "2026-10-27T00:00:00.000Z" }), TODAY)).toBe("action");
    expect(classifyOrderForToday(order({ risk: "blocked" }), TODAY)).toBe("action");
  });

  it("gives each current action case a reason and one concrete primary action", () => {
    expect(deriveOrderGuidance(order({ station: "galvanik", status: "galvanik" }), TODAY)).toMatchObject({ reason: "due_today", primaryActionLabel: "Fertig melden" });
    expect(deriveOrderGuidance(order({ dueDate: "2026-10-27T00:00:00.000Z" }), TODAY)).toMatchObject({ reason: "finished_overdue", primaryActionLabel: "Ware raus" });
    expect(deriveOrderGuidance(order({ dueDate: "2026-10-30T00:00:00.000Z", station: "wareneingang", status: "angenommen", risk: "yellow" }), TODAY)).toMatchObject({ reason: "tight_schedule", primaryActionLabel: "Kunde vorwarnen" });
    expect(deriveOrderGuidance(order({ dueDate: "2026-10-30T00:00:00.000Z", station: "galvanik", status: "galvanik", risk: "blocked" }), TODAY)).toMatchObject({ reason: "reported_risk", primaryActionLabel: "Auftrag öffnen · Risiko gemeldet" });
  });

  it("excludes collected, shipped, completed, and future healthy orders", () => {
    for (const terminal of ["abgeholt", "versendet", "raus", "completed", "erledigt"]) {
      expect(classifyOrderForToday(order({ station: terminal, status: terminal }), TODAY)).toBeNull();
    }
    expect(classifyOrderForToday(order({ dueDate: "2026-10-29T00:00:00.000Z" }), TODAY)).toBeNull();
  });
});

describe("classifyMoneyForToday", () => {
  const invoice = { customerCountry: "Deutschland", dueDate: "2026-10-27", goodsOutRecorded: false, paymentMode: "rechnung", paymentStatus: "offen", station: "fertig" };

  it("shows only overdue open invoices", () => {
    expect(classifyMoneyForToday(invoice, TODAY)).toBe("overdue_invoice");
    expect(classifyMoneyForToday({ ...invoice, dueDate: TODAY }, TODAY)).toBeNull();
    expect(classifyMoneyForToday({ ...invoice, dueDate: "2026-10-29" }, TODAY)).toBeNull();
    expect(classifyMoneyForToday({ ...invoice, paymentStatus: "bezahlt" }, TODAY)).toBeNull();
  });

  it("shows open prepayment only for finished domestic orders before goods out", () => {
    expect(classifyMoneyForToday({ ...invoice, dueDate: null, paymentMode: "vorkasse", paymentStatus: null }, TODAY)).toBe("open_prepayment");
    expect(classifyMoneyForToday({ ...invoice, paymentMode: "vorkasse", paymentStatus: "bezahlt" }, TODAY)).toBeNull();
    expect(classifyMoneyForToday({ ...invoice, paymentMode: "vorkasse", station: "galvanik" }, TODAY)).toBeNull();
    expect(classifyMoneyForToday({ ...invoice, paymentMode: "vorkasse", customerCountry: "AT" }, TODAY)).toBeNull();
    expect(classifyMoneyForToday({ ...invoice, paymentMode: "vorkasse", goodsOutRecorded: true }, TODAY)).toBeNull();
  });
});

describe("isBundleStationForToday", () => {
  it("allows only Wareneingang and Galvanik stations", () => {
    for (const station of ["angenommen", "wareneingang", "eingang", "galvanik"]) expect(isBundleStationForToday(station)).toBe(true);
    for (const station of ["kv", "fertig", "abgeholt", "versendet"]) expect(isBundleStationForToday(station)).toBe(false);
  });
});

describe("Der-Tag layout policy", () => {
  const allowed = new Set(["action", "today", "assign", "money"] as const);

  it("uses the role template and removes fields without an access area", () => {
    expect(defaultTodayLayout("meister", allowed)).toEqual([
      { field: "action", column: "left", order: 0 },
      { field: "assign", column: "left", order: 1 },
      { field: "today", column: "right", order: 2 },
      { field: "money", column: "right", order: 3 },
    ]);
    expect(filterTodayLayout([...defaultTodayLayout("werkstatt", new Set(["action", "today", "bundle"])), { field: "money", column: "right", order: 3 }], allowed)).not.toContainEqual(expect.objectContaining({ field: "bundle" }));
  });

  it("accepts only a complete unique layout beginning with Handlungsbedarf", () => {
    const valid = [{ field: "action", column: "left", order: 0 }, { field: "today", column: "right", order: 1 }];
    expect(parseTodayLayout(valid)).toEqual(valid);
    expect(parseTodayLayout([{ field: "today", column: "right", order: 0 }])).toBeNull();
    expect(parseTodayLayout([...valid, { field: "today", column: "left", order: 2 }])).toBeNull();
    expect(parseTodayLayout([{ field: "action", column: "left", order: 1 }])).toBeNull();
  });
});

describe("Später in Europe/Berlin", () => {
  it("uses 14:00 Berlin in summer and hides the option after the deadline", () => {
    expect(deriveTodayReminder("afternoon", "2026-07-03", new Date("2026-07-01T08:00:00.000Z"))).toMatchObject({
      until: new Date("2026-07-01T12:00:00.000Z"),
      message: "Aufgeschoben bis heute 14:00 · zählt weiter mit",
    });
    expect(deriveTodayReminder("afternoon", "2026-07-03", new Date("2026-07-01T12:01:00.000Z"))).toBeNull();
  });

  it("uses the next workday at 07:00 across the daylight-saving boundary", () => {
    expect(deriveTodayReminder("tomorrow", "2026-04-03", new Date("2026-03-27T09:00:00.000Z"))).toMatchObject({
      until: new Date("2026-03-30T05:00:00.000Z"),
      message: "Aufgeschoben bis Mo 07:00 · zählt weiter mit",
    });
  });

  it("does not move an item beyond a reached due date", () => {
    const now = new Date("2026-10-28T08:00:00.000Z");
    expect(deriveTodayReminder("tomorrow", "2026-10-28", now)).toBeNull();
    expect(deriveTodayReminder("after_due", "2026-10-27", now)).toBeNull();
    expect(deriveTodayReminder("after_due", "2026-10-30", now)).toMatchObject({
      until: new Date("2026-11-02T06:00:00.000Z"),
      message: "Aufgeschoben bis 02.11.2026 07:00 · zählt weiter mit",
    });
  });
});

it('SA correction never puts personal ownership above actual urgency or an earlier deadline',()=>{
 const rows=[{id:'mine',urgency:'warning' as const,dueDate:'2026-11-10'},{id:'blocked',urgency:'conflict' as const,dueDate:'2026-11-10'},{id:'earlier',urgency:'warning' as const,dueDate:'2026-11-09'},{id:'other',urgency:'warning' as const,dueDate:'2026-11-10'}];expect(sortTodayByResponsibility(rows,row=>row.id==='mine').map(row=>row.id)).toEqual(['blocked','earlier','mine','other']);
});

// Explicit synthetic U2 read boundaries for the pure, production-used projection.
describe('S05 evidenced challenges',()=>{
 const card=(id:string,number:string,due:string,finished=false):{orderId:string;version:number;read:U2Read}=>({orderId:id,version:1,read:{code:'OK',zustand:'work',farbe:'succ',erstblick:[{key:'auftrag.lage',werte:{station:'galvanik',nummer:number}},{key:'auftrag.termin',werte:{datum:due}},{key:'auftrag.teile',werte:{teile:[{fertig:finished}]}}],hauptaktion:null,weitere:null,gesperrt:[],datenluecken:[],quelle:{}} satisfies U2Read});
 it('keeps future ordinary work and missing prices out of challenges',()=>{
  const row=card('TEST-future','A-002','2026-11-17');row.read.datenluecken=['PRICES_SOURCE'];
  expect(projectTodayChallenges([row],[],'2026-11-12').groups).toEqual([]);
 });
 it('groups evidenced debt and lateness once per order without fabricating a payment command',()=>{
  const read=projectTodayChallenges([card('TEST-order','A-001','2026-11-11')],[{id:'TEST-invoice',orderId:'TEST-order',number:'TEST-R1',dueDate:'2026-11-10',amountCents:11900,amount:'119,00 EUR'}],'2026-11-12');
  expect(read.groups).toHaveLength(1);expect(read.groups[0]).toMatchObject({key:'order:TEST-order',rank:10,action:null});
  expect(read.groups[0].reasons.map(reason=>reason.textKey)).toEqual(['day.challenge_late','day.challenge_debt']);
  expect(read.missing).toContain('CHALLENGE_PAYMENT_ACTION:TEST-invoice');
 });
 it('sorts equal ranks by oldest due date and then order number',()=>{
  const read=projectTodayChallenges([card('TEST-b','A-002','2026-11-11'),card('TEST-a','A-001','2026-11-11'),card('TEST-old','A-003','2026-11-10')],[],'2026-11-12');
  expect(read.groups.map(row=>row.orderId)).toEqual(['TEST-old','TEST-a','TEST-b']);
 });
 it('never substitutes unfinished for unknown parts and never flags known completed production',()=>{
  const unknown=card('TEST-unknown','A-001','2026-11-10');unknown.read.erstblick=unknown.read.erstblick.filter(field=>field.key!=='auftrag.teile');
  const read=projectTodayChallenges([unknown,card('TEST-done','A-002','2026-11-10',true)],[],'2026-11-12');
  expect(read.groups).toEqual([]);expect(read.missing).toEqual(['CHALLENGE_ORDER_FACTS:TEST-unknown']);
 });
 it('keeps an unreadable financial amount unknown instead of inventing a zero debt',()=>{
  const read=projectTodayChallenges([],[{id:'TEST-bad',orderId:'TEST-order',number:'TEST-R',dueDate:'2026-11-10',amountCents:null,amount:null}],'2026-11-12');
  expect(read.groups).toEqual([]);expect(read.missing).toEqual(['CHALLENGE_INVOICE_FACTS:TEST-bad']);
 });
});

describe('S05 one Berlin read calendar',()=>{
 it.each([
  ['2026-11-12T22:30:00.000Z','2026-11-12','2026-11-19'],
  ['2026-11-12T23:30:00.000Z','2026-11-13','2026-11-20'],
  ['2026-03-28T23:30:00.000Z','2026-03-29','2026-04-05'],
  ['2026-10-24T22:30:00.000Z','2026-10-25','2026-11-01'],
 ])('uses calendar dates across midnight and daylight saving: %s',(instant,today,throughDate)=>{
  expect(readTodayCalendar(new Date(instant))).toEqual({readStartedAt:instant,today,throughDate});
 });
});

describe('S05 qualified order calendar slice',()=>{
 const calendar=readTodayCalendar(new Date('2026-11-12T12:00:00.000Z'));
 const row=(id:string,due:string|null,station='galvanik')=>({orderId:id,version:1,read:{code:'OK',zustand:'work',farbe:'succ',erstblick:[{key:'auftrag.lage',werte:{station}},{key:'auftrag.termin',werte:{datum:due}}],hauptaktion:null,weitere:null,gesperrt:[],datenluecken:[],quelle:{}} satisfies U2Read});
 it('counts seven calendar days inclusively and collapses the same qualified object',()=>{
  const first=row('TEST-today','2026-11-12');
  expect(projectOrderSchedule({code:'OK',rows:[first,first,row('TEST-seven','2026-11-19'),row('TEST-eight','2026-11-20')],missingOrderIds:[]},calendar)).toMatchObject({code:'OK',today:1,upcoming:1});
 });
 it('never chooses one of two conflicting versions for the same object',()=>{
  const first=row('TEST-conflict','2026-11-12'),changed={...row('TEST-conflict','2026-11-13'),version:2};
  expect(projectOrderSchedule({code:'OK',rows:[first,changed,first],missingOrderIds:[]},calendar)).toMatchObject({code:'SOURCE_INCOMPLETE',knownCounts:{today:0,upcoming:0},missing:['ORDER_SCHEDULE_VERSION:TEST-conflict'],sources:[]});
 });
 it('keeps missing/pickup dates unknown and retains the qualified subtotal',()=>{
  const read=projectOrderSchedule({code:'OK',rows:[row('TEST-known','2026-11-12'),row('TEST-no-date',null),row('TEST-pickup','2026-11-10','fertig')],missingOrderIds:[]},calendar);
  expect(read).toMatchObject({code:'SOURCE_INCOMPLETE',knownCounts:{today:1,upcoming:0}});expect(read).not.toHaveProperty('today');
  if(read.code==='SOURCE_INCOMPLETE')expect(read.missing).toEqual(['ORDER_SCHEDULE_DATE:TEST-no-date','ORDER_SCHEDULE_NON_PRODUCTION:TEST-pickup']);
 });
 it('uses qualified pickup evidence and never the previous production date',()=>{
  const pending={...row('TEST-pickup','2026-11-10','fertig'),pickupSchedule:{code:'OK' as const,date:'2026-11-13',eventId:'TEST-appointment',freezeId:'TEST-freeze'}};
  expect(projectOrderSchedule({code:'OK',rows:[pending],missingOrderIds:[]},calendar)).toMatchObject({code:'OK',today:0,upcoming:1,sources:[{id:'TEST-pickup',dueDate:'2026-11-13',appointmentEventId:'TEST-appointment',freezeId:'TEST-freeze'}]});
  const corrupt={...pending,pickupSchedule:{...pending.pickupSchedule,eventId:null}};
  expect(projectOrderSchedule({code:'OK',rows:[corrupt],missingOrderIds:[]},calendar)).toMatchObject({code:'SOURCE_INCOMPLETE',knownCounts:{today:0,upcoming:0}});
 });
 it('proves an empty source as zero but never turns an unreadable source into zero',()=>{
  expect(projectOrderSchedule({code:'OK',rows:[],missingOrderIds:[]},calendar)).toMatchObject({code:'OK',today:0,upcoming:0});
  const unknown=projectOrderSchedule({code:'SOURCE_INCOMPLETE',rows:[],missingOrderIds:[]},calendar);expect(unknown.code).toBe('SOURCE_INCOMPLETE');expect(unknown).not.toHaveProperty('today');
 });
});

// Explicit synthetic projection boundaries; real read/auth is covered separately.
it('keeps all open invoice amounts and separates overdue/today/upcoming without a list limit',()=>{
 const calendar=readTodayCalendar(new Date('2026-11-12T12:00:00Z'));
 const rows=[{id:'late',payment_version:2,due_date:'2026-11-11',open_amount_cents:1250},{id:'today',payment_version:1,due_date:'2026-11-12',open_amount_cents:'2500'},
 {id:'next',payment_version:3,due_date:'2026-11-19',open_amount_cents:300},{id:'later',payment_version:4,due_date:'2026-11-20',open_amount_cents:400}];
 expect(projectTodayInvoiceMoney({code:'OK',data:rows},calendar)).toMatchObject({code:'OK',openCount:4,openCents:4450,overdueCount:1,overdueCents:1250,today:2,upcoming:1});
 expect(projectTodayInvoiceMoney({code:'OK',data:[]},calendar)).toMatchObject({code:'OK',openCount:0,openCents:0,today:0,upcoming:0});
 expect(projectTodayInvoiceMoney({code:'SOURCE_INCOMPLETE'},calendar)).toEqual({code:'SOURCE_INCOMPLETE',missing:['INVOICE_MONEY_SOURCE']});
 for(const invalid of [{...rows[0],open_amount_cents:null},{...rows[0],due_date:null},{...rows[0],open_amount_cents:'unreadable'}]){
  const partial=projectTodayInvoiceMoney({code:'OK',data:[rows[1],invalid]},calendar);
  expect(partial).toMatchObject({code:'SOURCE_INCOMPLETE',knownTotals:{openCount:1,openCents:2500}});expect(partial).not.toHaveProperty('openCents');
 }
});

// Synthetic quote-clock boundaries; persisted lifecycle proof is AK-02.
it('keeps quote active/waiting and dates on the same lifecycle, preserving accepted validity',()=>{
 const calendar=readTodayCalendar(new Date('2026-11-12T12:00:00Z'));
 const base={version:1,facts:{converted:false,rejected:false,conditional:false,expired:false,sent:true,accepted:false},validUntil:'2026-11-30',followupAt:null};
 const due={...base,quoteId:'TEST-due',followupAt:'2026-11-12'},future={...base,quoteId:'TEST-future',followupAt:'2026-11-19'};
 const accepted={...base,quoteId:'TEST-accepted',facts:{...base.facts,accepted:true},validUntil:'2026-10-01'};
 const first=projectQuoteSchedule({code:'OK',rows:[due,due,future,accepted],missingQuoteIds:[]},calendar);
 expect(first).toMatchObject({code:'OK',active:1,waiting:2,today:1,upcoming:1});expect(first.sources.find(row=>row.id==='TEST-accepted')?.dueDate).toBeNull();
 expect(projectQuoteSchedule({code:'OK',rows:[],missingQuoteIds:[]},calendar)).toMatchObject({code:'OK',active:0,waiting:0,today:0,upcoming:0});
 expect(projectQuoteSchedule({code:'SOURCE_INCOMPLETE',rows:[due],missingQuoteIds:['TEST-missing']},calendar)).toMatchObject({code:'SOURCE_INCOMPLETE',knownCounts:{active:1,today:1}});
 expect(projectQuoteSchedule({code:'OK',rows:[due,{...due,version:2},due],missingQuoteIds:[]},calendar)).toMatchObject({code:'SOURCE_INCOMPLETE',sources:[],knownCounts:{active:0}});
});


it('V45 intake-task dates include overdue and today, separate future waiting and retain known rows beside a source gap',()=>{
 const calendar=readTodayCalendar(new Date('2026-11-12T12:00:00Z'));
 const task=(id:string,dueDate:string)=>({id,itemId:'TEST-source-'+id,version:1,dueDate,canComplete:true,canOpenReference:true});
 const rows=[task('TEST-overdue','2026-11-11'),task('TEST-today','2026-11-12'),task('TEST-in7','2026-11-19'),task('TEST-in8','2026-11-20')];
 expect(projectIntakeTaskSchedule({code:'OK',rows:[...rows,rows[0]],missingTaskIds:[]},calendar)).toMatchObject({code:'OK',active:2,waiting:2,today:2,upcoming:1,rows:[{id:'TEST-overdue',state:'active'},{id:'TEST-today',state:'active'},{id:'TEST-in7',state:'waiting'},{id:'TEST-in8',state:'waiting'}]});
 expect(projectIntakeTaskSchedule({code:'OK',rows:[],missingTaskIds:[]},calendar)).toMatchObject({code:'OK',active:0,waiting:0,today:0,upcoming:0});
 expect(projectIntakeTaskSchedule({code:'SOURCE_INCOMPLETE',rows,missingTaskIds:['TEST-overdue']},calendar)).toMatchObject({code:'SOURCE_INCOMPLETE',knownCounts:{active:2,waiting:2,today:2,upcoming:1},rows,missingTaskIds:['TEST-overdue']});
 expect(projectIntakeTaskSchedule({code:'OK',rows:[rows[0],{...rows[0],version:2}],missingTaskIds:[]},calendar)).toMatchObject({code:'SOURCE_INCOMPLETE',knownCounts:{active:0,today:0},rows:[],missingTaskIds:['TEST-overdue']});
});
