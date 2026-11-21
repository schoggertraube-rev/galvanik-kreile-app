// @vitest-environment node
// Explicit synthetic control-unit test; no real Auth/DB success is claimed here.
import {beforeEach,expect,it,vi} from 'vitest';
import type {AuthorizationSnapshot} from '@/lib/server/authorization';
import type {OperationalOrder} from '@/lib/types/operationalOrder';
const ports=vi.hoisted(()=>({orders:vi.fn(),batch:vi.fn(),messages:vi.fn(),execute:vi.fn()}));
vi.mock('@/lib/server/operationalOrders',()=>({getOperationalOrders:ports.orders}));
vi.mock('@/app/actions/orders.actions',()=>({getTodayOrderReadAction:ports.batch,readPageReadSettingsAction:vi.fn(async()=>({code:'FORBIDDEN'}))}));
vi.mock('@/app/actions/eingang.actions',()=>({getIntakeMessagesAction:ports.messages,getIntakeTaskAction:vi.fn(async()=>({code:'OK',rows:[],missingTaskIds:[]}))}));
vi.mock('@/app/actions/quotes.actions',()=>({listOpenQuotesAction:vi.fn(async()=>({code:'OK',quotes:[]})),readQuoteAction:vi.fn()}));
vi.mock('@/lib/server/v45QuoteRead',()=>({v45QuoteFacts:()=>({})}));
vi.mock('@/lib/server/authorization',()=>({canTransportInvoiceDocument:()=>false}));
vi.mock('@/lib/server/communicationDocumentPort',()=>({readUnsentInvoiceMailGroups:vi.fn(async()=>({groups:[],missing:[]}))}));
vi.mock('@/modules/complaints/public',()=>({complaintAttention:()=>[]}));
vi.mock('@/lib/server/orderTaskAssignmentRead',()=>({readOrderResponsibilityForToday:vi.fn(async()=>Object.assign(new Map(),{unavailableOrderIds:[]}))}));
vi.mock('@/lib/server/privilegedDb',()=>({withPrivilegedTenantTransaction:async(_auth:unknown,work:(tx:{execute:typeof ports.execute})=>unknown)=>work({execute:ports.execute}),withTenantSavepoint:async(tx:unknown,work:(tx:unknown)=>unknown)=>work(tx)}));
import {readTodayDashboard} from '../todayDashboard';

function deferred<T>(){let resolve!:(value:T)=>void;const promise=new Promise<T>(done=>{resolve=done;});return {promise,resolve};}
const auth={tenantId:'TEST-unit-C1',userId:'TEST-unit-actor',role:'meister',areas:['auftraege','mails'],permissions:[]} as unknown as AuthorizationSnapshot;
const order:OperationalOrder={id:'TEST-order',version:1,orderNumber:'TEST-A1',customerId:'TEST-customer',customerName:'TEST Firma',title:'TEST Ware',task:null,itemDescription:null,surfaceRequested:null,station:'galvanik',status:'galvanik',statusText:'In Arbeit',risk:'green',currentStationId:'galvanik',parts:[],intakeDate:'2026-11-20',dueDate:'2027-05-15',dueLabel:'Termin',dueValue:'15.05.',createdAt:'2026-11-20'};
const complaints=async()=>({code:'OK' as const,complaints:[]}),followups=async()=>({code:'OK' as const,tasks:[]});
beforeEach(()=>{vi.clearAllMocks();ports.execute.mockResolvedValue([]);ports.messages.mockResolvedValue({code:'OK',messages:[]});ports.batch.mockResolvedValue({code:'UNAVAILABLE'});});

it('starts the one original batch as soon as orders resolve while messages still wait',async()=>{
 const source=deferred<OperationalOrder[]>(),messages=deferred<{code:'OK';messages:[]}>();ports.messages.mockReturnValue(messages.promise);
 let completed=false;const result=readTodayDashboard(auth,complaints,followups,new Date('2026-11-21T12:00:00Z'),source.promise).then(value=>{completed=true;return value;});
 expect(ports.batch).not.toHaveBeenCalled();source.resolve([order]);
 await vi.waitFor(()=>expect(ports.batch).toHaveBeenCalledExactlyOnceWith({orderIds:[order.id]}));expect(completed).toBe(false);
 messages.resolve({code:'OK',messages:[]});const day=await result;
 expect(day.items.some(item=>item.key==='source-order:'+order.id)).toBe(true);expect(day.orderActions?.missingOrderIds).toEqual([order.id]);expect(ports.orders).not.toHaveBeenCalled();
});
it('retains a named source notice per real input order when the early batch rejects',async()=>{
 ports.batch.mockRejectedValue(Error('TEST synthetic batch failure'));
 const other={...order,id:'TEST-order-2',orderNumber:'TEST-A2'};
 const day=await readTodayDashboard(auth,complaints,followups,new Date('2026-11-21T12:00:00Z'),Promise.resolve([order,other]));
 expect(day.items.filter(item=>item.key.startsWith('source-order:')).map(item=>item.orderId).sort()).toEqual([order.id,other.id].sort());
 expect(day.orderActions?.code).toBe('SOURCE_INCOMPLETE');expect(day.orderActions?.missingOrderIds).toEqual([order.id,other.id]);
});
it('does not invent order IDs if the original order source rejects',async()=>{
 const day=await readTodayDashboard(auth,complaints,followups,new Date('2026-11-21T12:00:00Z'),Promise.reject(Error('TEST synthetic original order source failure')));
 expect(ports.batch).toHaveBeenCalledExactlyOnceWith({orderIds:[]});expect(ports.orders).not.toHaveBeenCalled();expect(day.datenluecken).toContain('ORDER_SOURCE');
});
