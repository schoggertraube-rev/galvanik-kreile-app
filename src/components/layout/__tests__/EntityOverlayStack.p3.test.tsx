import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/app/orders/OrderCardAppAdapter", () => ({
  OrderCardAppAdapter: ({ orderId, onOpenCustomer, onClose }: { orderId: string; onOpenCustomer: (id: string) => void; onClose: () => void }) => (
    <div data-testid="mock-order-card"><span>{orderId}</span><button onClick={() => onOpenCustomer("customer-1")}>Kunde öffnen</button><button onClick={onClose}>Zurück</button></div>
  ),
}));
vi.mock("@/app/customers/CustomerCardAppAdapter", () => ({
  CustomerCardAppAdapter: ({ customerId, onOpenOrder, onClose }: { customerId: string; onOpenOrder: (id: string) => void; onClose: () => void }) => (
    <div data-testid="mock-customer-card"><span>{customerId}</span><button onClick={() => onOpenOrder("order-2")}>Auftrag öffnen</button><button onClick={onClose}>Zurück</button></div>
  ),
}));

vi.mock("@/app/quotes/QuoteCardAppAdapter", () => ({
  QuoteCardAppAdapter: ({ quoteId, onOpenCustomer, onClose }: { quoteId: string; onOpenCustomer: (id: string) => void; onClose: () => void }) => (
    <div data-testid="mock-quote-card"><span>{quoteId}</span><button onClick={() => onOpenCustomer("customer-1")}>Kunde öffnen</button><button onClick={onClose}>Zurück</button></div>
  ),
}));

import { EntityOverlayStack } from "../EntityOverlayStack";
import { useOverlayStore } from "@/lib/overlayStore";

beforeEach(() => useOverlayStore.setState({ stack: [], orderStack: [] }));

describe("P3 shared entity overlay/backstack", () => {
  it("keeps quote -> customer and back on the same stack", async () => {
    render(<EntityOverlayStack />);
    act(() => useOverlayStore.getState().openQuote("quote-1"));
    expect(await screen.findByTestId("mock-quote-card")).toHaveTextContent("quote-1");
    fireEvent.click(screen.getByRole("button", { name: "Kunde öffnen" }));
    expect(await screen.findByTestId("mock-customer-card")).toHaveTextContent("customer-1");
    fireEvent.click(screen.getByRole("button", { name: "Zurück" }));
    expect(await screen.findByTestId("mock-quote-card")).toHaveTextContent("quote-1");
  });
  it("keeps Home -> order -> customer -> order and every back step on one stack", async () => {
    render(<EntityOverlayStack />);
    act(() => useOverlayStore.getState().openOrder("order-1"));
    expect(await screen.findByTestId("mock-order-card")).toHaveTextContent("order-1");
    fireEvent.click(screen.getByRole("button", { name: "Kunde öffnen" }));
    expect(await screen.findByTestId("mock-customer-card")).toHaveTextContent("customer-1");
    fireEvent.click(screen.getByRole("button", { name: "Auftrag öffnen" }));
    expect(await screen.findByTestId("mock-order-card")).toHaveTextContent("order-2");
    fireEvent.click(screen.getByRole("button", { name: "Zurück" }));
    expect(await screen.findByTestId("mock-customer-card")).toHaveTextContent("customer-1");
    fireEvent.click(screen.getByRole("button", { name: "Zurück" }));
    expect(await screen.findByTestId("mock-order-card")).toHaveTextContent("order-1");
  });

  it("opens customer -> active order and closes to the originating customer", async () => {
    render(<EntityOverlayStack />);
    act(() => useOverlayStore.getState().openCustomer("customer-1"));
    fireEvent.click(screen.getByRole("button", { name: "Auftrag öffnen" }));
    expect(await screen.findByTestId("mock-order-card")).toHaveTextContent("order-2");
    fireEvent.click(screen.getByRole("button", { name: "Zurück" }));
    expect(await screen.findByTestId("mock-customer-card")).toHaveTextContent("customer-1");
  });
});


const ports = vi.hoisted(() => ({
  openOrder: vi.fn(),
  openInvoice: vi.fn(),
  requestCreate: vi.fn(),
  listInbox: vi.fn(),
  confirmHandover:vi.fn(),
  push: vi.fn(),
  refresh: vi.fn(),
  permissions: { loading: false, canCreateOrder: true, canWorkOrders: true },
}));
vi.mock("@/components/layout/GlobalCreateFlow", () => ({ requestGlobalCreate: ports.requestCreate }));
vi.mock('@/components/communication/CommunicationPanel',()=>({CommunicationPanel:({targetId,invoiceOriginal}:{targetId:string;invoiceOriginal?:{documentId:string}})=><div data-testid="TEST-canonical-composer" data-customer={targetId} data-original={invoiceOriginal?.documentId}/> }));
vi.mock("@/app/actions/communications.actions", () => ({ listOutlookInboxAction: ports.listInbox,confirmInvoiceHandoverAction:ports.confirmHandover }));
vi.mock("@/app/actions/eingang.actions",()=>({getIntakeDraftsAction:vi.fn(async()=>({code:"OK",drafts:[]})),discardIntakeDraftAction:vi.fn(async()=>({code:"OK",drafts:[]}))}));
vi.mock("next/navigation", () => ({ useRouter: () => ({ push: ports.push, refresh: ports.refresh }) }));
vi.mock("@/lib/auth/PermissionsContext", () => ({
  usePermissions: () => ({
    loading: ports.permissions.loading,
    hasArea: (area: string) => (area === "eingang" && ports.permissions.canCreateOrder) || (area === "auftraege" && ports.permissions.canWorkOrders),
  }),
}));


import {OfficeHomeClient as RolfHomeClient} from '@/components/home/OfficeHomeClient';
import type {OfficeHomeModel} from '@/components/home/OfficeHomeClient';
import type {OrdersHomeProjection} from '@/modules/orders/public';
import {TODAY_MODEL_COPY} from '@/ui/situationCatalog';

describe('E-C isolated client transport and streaming',()=>{
const actionPorts = {
  savePreferences: vi.fn().mockResolvedValue({ code: "OK" }),
  saveReminder: vi.fn().mockResolvedValue({ code: "OK" }),
  discardDraft: vi.fn().mockResolvedValue({ code: "OK" }),
  assignOrder: vi.fn().mockResolvedValue({ code: "OK", receipt: { aggregateVersion: 2 } }),
  handBackOrder: vi.fn().mockResolvedValue({ code: "OK", receipt: { aggregateVersion: 3 } }),
};

const projection: OrdersHomeProjection = {
  source: "Auftragsbestand",
  loadedAt: "2026-09-16T08:15:00.000Z",
  orders: [{ id: "order-1", orderNumber: "A-2026-0001", customerName: "Muster GmbH", title: "Auftrag", detail: "Bauteil", station: "galvanik", status: "angenommen", statusText: "In Arbeit", risk: "red", dueDate: "2026-09-18", dueLabel: "Fällig", dueValue: "18.09.2026", createdAt: "2026-09-16T07:00:00.000Z" }],
  priority: [{ id: "order-1", orderNumber: "A-2026-0001", customerName: "Muster GmbH", title: "Auftrag", detail: "Bauteil", station: "galvanik", status: "angenommen", statusText: "In Arbeit", risk: "red", dueDate: "2026-09-18", dueLabel: "Fällig", dueValue: "18.09.2026", createdAt: "2026-09-16T07:00:00.000Z" }],
  recent: [{ id: "order-1", orderNumber: "A-2026-0001", customerName: "Muster GmbH", title: "Auftrag", detail: "Bauteil", station: "galvanik", status: "angenommen", statusText: "In Arbeit", risk: "red", dueDate: "2026-09-18", dueLabel: "Fällig", dueValue: "18.09.2026", createdAt: "2026-09-16T07:00:00.000Z" }],
  recentSince: "2026-09-15T08:15:00.000Z",
  recentCoverage: "complete",
  dominant: { orderId: "order-1", reason: "Dieser Auftrag ist kritisch." },
};

const dashboard = {
  items: [{ key: "order:order-1", field: "today" as const, kind: "order" as const, title: "A-2026-0001 · Muster GmbH", meta: "Bauteil · heute", urgency: "conflict" as const, orderId: "order-1", orderVersion: 1, dueDate: "2026-09-18" }],
  visibleFields: ["today", "assign", "money", "bundle"] as const,
  layout: [
    { field: "action" as const, column: "left" as const, order: 0 },
    { field: "assign" as const, column: "left" as const, order: 1 },
    { field: "today" as const, column: "right" as const, order: 2 },
    { field: "money" as const, column: "right" as const, order: 3 },
  ],
  defaultLayout: [
    { field: "action" as const, column: "left" as const, order: 0 },
    { field: "assign" as const, column: "left" as const, order: 1 },
    { field: "today" as const, column: "right" as const, order: 2 },
    { field: "money" as const, column: "right" as const, order: 3 },
  ],
  allowedFields: ["today", "assign", "money", "bundle"] as const,
  delegationTargets: [
    { userId: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa", displayName: "Phillip" },
    { userId: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb", displayName: "Werkstatt Zwei" },
  ],
  outlookMessage: null,
};


beforeEach(()=>{vi.clearAllMocks();ports.permissions.loading=false;ports.permissions.canCreateOrder=true;ports.permissions.canWorkOrders=true;ports.listInbox.mockResolvedValue({code:'OK',data:[]});});
afterEach(()=>vi.unstubAllGlobals());
// Explicit isolated client transport fixtures. These verify React fences only;
// genuine GET/Auth/DB/model behavior is covered by the native acceptance cases.
const pollingModel=(title:string,pending=true):OfficeHomeModel=>({kind:'data',role:'meister',cacheLoginScope:'TEST-poll-scope',canCreateOrder:false,canWorkOrders:true,canDelegate:false,projection,
 modelRead:{source:'modell',pending,incomplete:false,pollMs:1,rebuild:false},dashboard:{...dashboard,visibleFields:[...dashboard.visibleFields],items:[{key:'source-order:TEST-poll',field:'action',kind:'order',orderId:'TEST-poll',orderVersion:1,title,meta:'',urgency:'warning',primaryActionLabel:TODAY_MODEL_COPY.reload}]}});

it('keeps the live tile arrangement while the stock reader is unbound',()=>{
 render(<RolfHomeClient model={pollingModel('TEST known primary',false)} ports={actionPorts}/>);
 expect(screen.getAllByText('TEST known primary')[0]).toBeVisible();
 expect(document.querySelector('[data-testid="today-supplements"]')).toBeNull();
 expect(document.querySelector('[data-today-region]')).toBeNull();
 expect(screen.queryByRole('button',{name:'Bereich neu laden'})).toBeNull();
});

it('controlled model transport never adopts a response for another login scope',async()=>{
 const next={...pollingModel('TEST foreign response',false),cacheLoginScope:'TEST-other-scope'};
 const fetch=vi.fn<typeof globalThis.fetch>(async()=>new Response(JSON.stringify({code:'OK',model:next}),{status:200}));vi.stubGlobal('fetch',fetch);
 render(<RolfHomeClient model={pollingModel('TEST existing model')} ports={actionPorts}/>);
 await waitFor(()=>expect(fetch).toHaveBeenCalledTimes(1));
 await act(async()=>{await Promise.resolve();});
 expect(screen.queryByText('TEST foreign response')).toBeNull();
 expect(screen.getAllByText('TEST existing model')[0]).toBeVisible();
 expect(fetch.mock.calls[0][0]).toBe('/api/heute/modell?nur=veraltet');
});

it('backs off unchanged pending model revisions instead of polling continuously',async()=>{
 vi.useFakeTimers();
 try{
  const fetch=vi.fn<typeof globalThis.fetch>(async()=>new Response(null,{status:304}));vi.stubGlobal('fetch',fetch);
  const model=pollingModel('TEST pending revision');
  if(!('modelRead'in model))throw Error('TEST_PENDING_MODEL_REQUIRED');
  model.modelRead={source:'modell',pending:true,incomplete:false,pollMs:10,maxPollMs:80,rebuild:false,revision:'a'.repeat(64)};
  render(<RolfHomeClient model={model} ports={actionPorts}/>);
  await act(async()=>{await vi.advanceTimersByTimeAsync(10);});expect(fetch).toHaveBeenCalledTimes(1);
  await act(async()=>{await vi.advanceTimersByTimeAsync(19);});expect(fetch).toHaveBeenCalledTimes(1);
  await act(async()=>{await vi.advanceTimersByTimeAsync(1);});expect(fetch).toHaveBeenCalledTimes(2);
  await act(async()=>{await vi.advanceTimersByTimeAsync(39);});expect(fetch).toHaveBeenCalledTimes(2);
  await act(async()=>{await vi.advanceTimersByTimeAsync(1);});expect(fetch).toHaveBeenCalledTimes(3);
 }finally{vi.useRealTimers();}
});

it('backs off repeated empty-model 200 responses until a new revision and then backs off 304 again',async()=>{
 vi.useFakeTimers();
 try{
  const empty=pollingModel('TEST empty model');
  if(!('modelRead'in empty))throw Error('TEST_EMPTY_MODEL_REQUIRED');
  empty.modelRead={source:'modell',pending:true,incomplete:false,pollMs:10,maxPollMs:80,rebuild:false};
  const revision='b'.repeat(64);
  let calls=0;
  const fetch=vi.fn<typeof globalThis.fetch>(async()=>++calls>=7
   ?new Response(null,{status:304})
   :new Response(JSON.stringify({code:'OK',model:{...empty,modelRead:{...empty.modelRead,...(calls===6?{revision}:{})}}}),{status:200}));
  vi.stubGlobal('fetch',fetch);
  render(<RolfHomeClient model={empty} ports={actionPorts}/>);
  const delays=[10,20,40,80,80,80,10,20];
  for(const [index,delay] of delays.entries()){
   await act(async()=>{await vi.advanceTimersByTimeAsync(delay-1);});expect(fetch).toHaveBeenCalledTimes(index);
   await act(async()=>{await vi.advanceTimersByTimeAsync(1);});expect(fetch).toHaveBeenCalledTimes(index+1);
  }
 }finally{vi.useRealTimers();}
});

it('controlled late model response cannot replace a newer RSC snapshot even in the same login scope',async()=>{
 let finish!:(value:Response)=>void;
 const fetch=vi.fn(()=>new Promise<Response>(resolve=>{finish=resolve;}));vi.stubGlobal('fetch',fetch);
 const view=render(<RolfHomeClient model={pollingModel('TEST first snapshot')} ports={actionPorts}/>);
 await waitFor(()=>expect(fetch).toHaveBeenCalledTimes(1));
 view.rerender(<RolfHomeClient model={pollingModel('TEST newer RSC',false)} ports={actionPorts}/>);
 await act(async()=>{finish(new Response(JSON.stringify({code:'OK',model:pollingModel('TEST stale delayed snapshot',false)}),{status:200}));await Promise.resolve();});
 expect(screen.getAllByText('TEST newer RSC')[0]).toBeVisible();
 expect(screen.queryByText('TEST stale delayed snapshot')).toBeNull();
});

it('controlled manual reload and automatic polling share one in-flight request and await its actual response',async()=>{
 let finish!:(value:Response)=>void;
 const fetch=vi.fn(()=>new Promise<Response>(resolve=>{finish=resolve;}));vi.stubGlobal('fetch',fetch);
 render(<RolfHomeClient model={pollingModel('TEST waiting model')} ports={actionPorts}/>);
 await waitFor(()=>expect(fetch).toHaveBeenCalledTimes(1));
 for(const button of screen.getAllByRole('button',{name:TODAY_MODEL_COPY.reload})){fireEvent.click(button);fireEvent.click(button);}
 expect(fetch).toHaveBeenCalledTimes(1);
 expect(screen.queryByText('TEST acknowledged model')).toBeNull();
 await act(async()=>{finish(new Response(JSON.stringify({code:'OK',model:pollingModel('TEST acknowledged model',false)}),{status:200}));await Promise.resolve();});
 await waitFor(()=>expect(screen.getAllByText('TEST acknowledged model')[0]).toBeVisible());
 expect(fetch).toHaveBeenCalledTimes(1);
});

it('controlled return to a fresh model checks its scoped revision and keeps unchanged visible content',async()=>{
 const current=pollingModel('TEST unchanged visible content',false);
 if(!('modelRead'in current)||!current.modelRead)throw Error('TEST_CONDITIONAL_MODEL_REQUIRED');
 current.modelRead={...current.modelRead,revision:'a'.repeat(64)};
 const fetch=vi.fn<typeof globalThis.fetch>(async()=>new Response(null,{status:304}));vi.stubGlobal('fetch',fetch);
 render(<RolfHomeClient model={current} ports={actionPorts}/>);
 expect(fetch).not.toHaveBeenCalled();
 fireEvent.focus(window);
 await waitFor(()=>expect(fetch).toHaveBeenCalledTimes(1));
 await act(async()=>{await Promise.resolve();});
 const headers=new Headers(fetch.mock.calls[0][1]?.headers);
 expect(headers.get('If-None-Match')).toBe('"'+'a'.repeat(64)+'"');expect(headers.get('X-Kreile-Login-Scope')).toBe('TEST-poll-scope');
 expect(screen.getAllByText('TEST unchanged visible content')[0]).toBeVisible();expect(ports.refresh).not.toHaveBeenCalled();
 fireEvent.focus(window);await waitFor(()=>expect(fetch).toHaveBeenCalledTimes(2));
});

it('keeps the existing Today list visible while the one model refresh is pending',async()=>{
 let resolve!:(value:Response)=>void;
 const fetch=vi.fn<typeof globalThis.fetch>(()=>new Promise<Response>(done=>{resolve=done;}));vi.stubGlobal('fetch',fetch);
 render(<RolfHomeClient model={pollingModel('TEST primary stays visible')} ports={actionPorts}/>);
 await waitFor(()=>expect(fetch).toHaveBeenCalledTimes(1));
 expect(screen.getAllByText('TEST primary stays visible')[0]).toBeVisible();
 expect(fetch.mock.calls[0][0]).toBe('/api/heute/modell?nur=veraltet');
 expect(document.querySelector('[data-today-region]')).toBeNull();
 await act(async()=>{resolve(new Response(JSON.stringify({code:'OK',model:pollingModel('TEST refreshed primary',false)}),{status:200}));await Promise.resolve();});
 await waitFor(()=>expect(screen.getAllByText('TEST refreshed primary')[0]).toBeVisible());
 expect(document.querySelector('[data-today-region]')).toBeNull();
});
it('keeps the known Today list when the complete model read fails',async()=>{
 const fetch=vi.fn<typeof globalThis.fetch>(async()=>new Response(null,{status:503}));vi.stubGlobal('fetch',fetch);
 render(<RolfHomeClient model={pollingModel('TEST known after error',false)} ports={actionPorts}/>);
 expect(screen.getAllByText('TEST known after error')[0]).toBeVisible();
 fireEvent.focus(window);
 await waitFor(()=>expect(fetch).toHaveBeenCalledTimes(1));
 expect(fetch.mock.calls[0][0]).toBe('/api/heute/modell?nur=veraltet');
 expect(screen.getAllByText('TEST known after error')[0]).toBeVisible();
 expect(document.querySelector('[data-today-region]')).toBeNull();
 expect(ports.refresh).not.toHaveBeenCalled();
});

});
