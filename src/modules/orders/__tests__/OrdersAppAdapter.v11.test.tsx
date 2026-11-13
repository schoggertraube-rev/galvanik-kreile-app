import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { OrdersAppAdapter } from "@/app/orders/OrdersAppAdapter";

const ports = vi.hoisted(() => ({
  getOrdersDb: vi.fn(),
  openOrder: vi.fn(),
  openCustomer:vi.fn(),
  create: vi.fn(),
  offline24h:false,
  offlineScope:null as string|null,
  readDevice:vi.fn(),
  retainDevice:vi.fn(),
}));

vi.mock("@/app/actions/orders.actions", () => ({ getOrdersDb: ports.getOrdersDb }));
vi.mock("@/components/layout/GlobalCreateFlow", () => ({ requestGlobalCreate: ports.create }));
vi.mock("@/lib/auth/PermissionsContext", () => ({
  usePermissions: () => ({ loading: false, hasPermission: () => true,offline24h:ports.offline24h,offlineScope:ports.offlineScope }),
}));
vi.mock('@/lib/offline/devicePortRead',()=>({captureDeviceReadFence:vi.fn().mockResolvedValue(null),readDevicePortResponse:ports.readDevice,retainDevicePortResponse:ports.retainDevice}));
vi.mock("@/lib/overlayStore", () => ({
  useOverlayStore: (selector: (state: { openOrder: typeof ports.openOrder;openCustomer:typeof ports.openCustomer }) => unknown) => selector({ openOrder: ports.openOrder,openCustomer:ports.openCustomer }),
}));

const order = {
  id: "order-1",
  version: 1,
  orderNumber: "A-2026-0001",
  customerId: "customer-1",
  customerName: "Sabrina Schmidt",
  title: "Sabrina Schmidt · stosstange",
  task: null,
  itemDescription: "stosstange",
  surfaceRequested: "chrom",
  station: "angenommen",
  status: "angenommen",
  statusText: "Angenommen",
  risk: "red",
  currentStationId: "angenommen",
  parts: [],
  intakeDate: "2026-10-20",
  dueDate: "2026-10-27",
  dueLabel: "Termin",
  dueValue: "27.10.2026",
  createdAt: "2026-10-20T08:00:00.000Z",
};

beforeEach(() => {
  vi.clearAllMocks();
  window.sessionStorage.clear();
  ports.getOrdersDb.mockResolvedValue({ ok: true, data: [order] });
  ports.offline24h=false;ports.offlineScope=null;
  ports.readDevice.mockResolvedValue({code:'EMPTY'});ports.retainDevice.mockResolvedValue({code:'STORED'});
});

afterEach(()=>{cleanup();vi.restoreAllMocks();});

describe("OrdersAppAdapter V1.1", () => {
  // Explicit synthetic component states. Native Actions/Auth/DB/IDB proof is
  // offline_workshop_sync.browser.integration.test.ts, not this mocked boundary.
  it('renders the same retained list offline without a server request',async()=>{
    ports.offline24h=true;ports.offlineScope='a'.repeat(64);
    vi.spyOn(navigator,'onLine','get').mockReturnValue(false);
    ports.readDevice.mockResolvedValue({code:'OK',value:{port:'orders.list',serverReadAt:'2026-11-13T10:00:00.000Z',response:{result:{ok:true,data:[order]},datenluecken:[]}}});
    render(<OrdersAppAdapter/>);
    await screen.findByText(order.orderNumber);
    expect(ports.getOrdersDb).not.toHaveBeenCalled();
    expect(ports.readDevice).toHaveBeenCalledWith(ports.offlineScope,true,{port:'orders.list',objectId:'orders'});
  });
  it('uses the canonical name alternative for retained offline rows, with its existing match reason',async()=>{
    ports.offline24h=true;ports.offlineScope='a'.repeat(64);
    vi.spyOn(navigator,'onLine','get').mockReturnValue(false);
    ports.readDevice.mockResolvedValue({code:'OK',value:{port:'orders.list',serverReadAt:'2026-11-13T10:00:00.000Z',response:{result:{ok:true,data:[{...order,customerName:'TEST Müller'}]},datenluecken:[]}}});
    render(<OrdersAppAdapter/>);
    await screen.findByText(order.orderNumber);
    fireEvent.change(screen.getByRole('textbox'),{target:{value:'Müler'}});
    expect(screen.getByText(order.orderNumber)).toBeInTheDocument();
    expect(screen.getByText(/Klingt gleich/)).toBeInTheDocument();
    expect(ports.getOrdersDb).not.toHaveBeenCalled();
    fireEvent.change(screen.getByRole('textbox'),{target:{value:'Unverwandt'}});
    expect(screen.queryByText(order.orderNumber)).not.toBeInTheDocument();
  });
  it('retains canonical denial instead of displaying an old list or inventing an empty list',async()=>{
    ports.offline24h=true;ports.offlineScope='a'.repeat(64);
    vi.spyOn(navigator,'onLine','get').mockReturnValue(false);
    ports.readDevice.mockResolvedValue({code:'OK',value:{port:'orders.list',response:{result:{ok:false,error:'FORBIDDEN',message:'TEST canonical denial'},datenluecken:[]}}});
    render(<OrdersAppAdapter/>);
    await screen.findByText('TEST canonical denial');
    expect(screen.queryByText(order.orderNumber)).not.toBeInTheDocument();
    expect(screen.queryByText('Noch keine Aufträge.')).not.toBeInTheDocument();
    expect(ports.getOrdersDb).not.toHaveBeenCalled();
  });
  it('does not turn a missing device source into a successful empty list',async()=>{
    ports.offline24h=true;ports.offlineScope='a'.repeat(64);
    vi.spyOn(navigator,'onLine','get').mockReturnValue(false);
    render(<OrdersAppAdapter/>);
    await screen.findByText('Aufträge konnten nicht sicher geladen werden.');
    expect(screen.queryByText('Noch keine Aufträge.')).not.toBeInTheDocument();
    expect(ports.getOrdersDb).not.toHaveBeenCalled();
  });
  it('groups by stored customer ID and routes row actions to that exact order and customer',async()=>{
    ports.getOrdersDb.mockResolvedValue({ok:true,data:[order,{...order,id:'order-2',orderNumber:'A-2026-0002'},{...order,id:'order-3',orderNumber:'A-2026-0003',customerId:'customer-2',customerName:'Sabrina Schmidt'}]});
    render(<OrdersAppAdapter/>);
    await screen.findByText('A-2026-0002');
    expect(screen.getAllByRole('region',{name:/Aufträge ·/})).toHaveLength(2);
    const row=within(screen.getByRole('group',{name:'Auftrag A-2026-0002'}));
    fireEvent.click(row.getByRole('button',{name:'Kundenkarte'}));expect(ports.openCustomer).toHaveBeenCalledWith('customer-1');
    fireEvent.click(row.getByRole('button',{name:'Foto'}));expect(ports.openOrder).toHaveBeenCalledWith('order-2','photos');
    fireEvent.click(row.getByRole('button',{name:'Öffnen'}));expect(ports.openOrder).toHaveBeenCalledWith('order-2');
  });
  it("renders the real list through V1.1 controls and opens the existing order", async () => {
    render(<OrdersAppAdapter />);

    await waitFor(() => expect(screen.getByText("A-2026-0001")).toBeVisible());
    expect(screen.getByRole("heading", { level: 1, name: "Aufträge" })).toBeVisible();
    expect(screen.getByRole("group", { name: "Auftragsansicht" })).toBeVisible();
    expect(screen.getByRole("group", { name: "Aufträge filtern" })).toBeVisible();
    expect(screen.getByPlaceholderText("Auftrag, Kunde, Teil oder Oberfläche")).toBeVisible();
    expect(screen.queryByText("Sabrina Schmidt · Sabrina Schmidt")).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: /A-2026-0001/ }));
    expect(ports.openOrder).toHaveBeenCalledWith("order-1");
  });

  it("filters real rows and switches to the real week view", async () => {
    render(<OrdersAppAdapter />);
    await waitFor(() => expect(screen.getByText("A-2026-0001")).toBeVisible());

    fireEvent.change(screen.getByPlaceholderText("Auftrag, Kunde, Teil oder Oberfläche"), { target: { value: "nicht vorhanden" } });
    expect(screen.getByText("Kein Auftrag für „nicht vorhanden“." )).toBeVisible();

    const views = within(screen.getByRole("group", { name: "Auftragsansicht" }));
    fireEvent.click(views.getByRole("button", { name: "Woche" }));
    expect(screen.getByText(/^Mo\./)).toBeVisible();
  });
});
