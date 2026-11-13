import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { Customer } from "@/lib/types/customer";
import { CustomersAppAdapter } from "@/app/customers/CustomersAppAdapter";

const ports = vi.hoisted(() => ({
  getCustomersDb: vi.fn(),
  openCustomer: vi.fn(),
  requestGlobalCreate: vi.fn(),
  canAction: vi.fn(),offline24h:false,offlineScope:null as string|null,readDevice:vi.fn(),retainDevice:vi.fn(),
}));

vi.mock("@/app/actions/customers.actions", () => ({ getCustomersDb: ports.getCustomersDb }));
vi.mock("@/components/layout/GlobalCreateFlow", () => ({ requestGlobalCreate: ports.requestGlobalCreate }));
vi.mock("@/lib/auth/PermissionsContext", () => ({
  usePermissions: () => ({ canAction: ports.canAction, loading: false,offline24h:ports.offline24h,offlineScope:ports.offlineScope }),
}));
vi.mock('@/lib/offline/devicePortRead',()=>({captureDeviceReadFence:vi.fn().mockResolvedValue(null),readDevicePortResponse:ports.readDevice,retainDevicePortResponse:ports.retainDevice}));
vi.mock("@/lib/overlayStore", () => ({
  useOverlayStore: (selector: (state: { openCustomer: typeof ports.openCustomer }) => unknown) =>
    selector({ openCustomer: ports.openCustomer }),
}));

const customer = (overrides: Partial<Customer> = {}): Customer => ({
  id: "2c3f0d18-7903-4b27-8175-348f7e91b7cb",
  customerNumber: "K-2026-0018",
  name: "Kreile Fahrzeugtechnik",
  type: "business",
  city: "Esslingen",
  ...overrides,
});

beforeEach(() => {
  vi.clearAllMocks();
  ports.canAction.mockReturnValue(false);ports.offline24h=false;ports.offlineScope=null;ports.readDevice.mockResolvedValue({code:'EMPTY'});
});

afterEach(() => {cleanup();vi.restoreAllMocks();});

describe("CustomersAppAdapter", () => {
  // Explicit synthetic component boundaries; native Auth/DB/IDB proof remains separate.
  it('reads the retained list offline and uses the canonical name alternative',async()=>{
    ports.offline24h=true;ports.offlineScope='a'.repeat(64);vi.spyOn(navigator,'onLine','get').mockReturnValue(false);
    ports.readDevice.mockResolvedValue({code:'OK',value:{port:'customers.list',response:{result:{ok:true,data:[{...customer({name:'TEST Müller'}),activeOrderCount:1}]},datenluecken:[]}}});
    render(<CustomersAppAdapter/>);await screen.findByText('TEST Müller');
    fireEvent.change(screen.getByPlaceholderText('Name, Ort, Auftrag oder Stichwort'),{target:{value:'Müler'}});
    expect(screen.getByText('TEST Müller')).toBeInTheDocument();expect(screen.getByText(/Klingt gleich/)).toBeInTheDocument();expect(ports.getCustomersDb).not.toHaveBeenCalled();
  });
  it('keeps a retained canonical denial distinct from an empty or old list',async()=>{
    ports.offline24h=true;ports.offlineScope='a'.repeat(64);vi.spyOn(navigator,'onLine','get').mockReturnValue(false);
    ports.readDevice.mockResolvedValue({code:'OK',value:{port:'customers.list',response:{result:{ok:false,error:'FORBIDDEN',message:'TEST canonical denial'},datenluecken:[]}}});
    render(<CustomersAppAdapter/>);expect(await screen.findByText('Kundenstamm ist für diese Sitzung nicht freigegeben.')).toBeInTheDocument();expect(screen.queryByText('Noch keine Kunden.')).not.toBeInTheDocument();expect(ports.getCustomersDb).not.toHaveBeenCalled();
  });
  it('does not turn a missing device source into a successful empty list',async()=>{
    ports.offline24h=true;ports.offlineScope='a'.repeat(64);vi.spyOn(navigator,'onLine','get').mockReturnValue(false);
    render(<CustomersAppAdapter/>);expect(await screen.findByRole('alert')).toHaveTextContent('Kundenstamm konnte nicht sicher geladen werden.');expect(screen.queryByText('Noch keine Kunden.')).not.toBeInTheDocument();
  });
  it("shows loading until the customer read has settled", () => {
    ports.getCustomersDb.mockReturnValue(new Promise(() => undefined));
    render(<CustomersAppAdapter />);

    expect(screen.getByRole("status")).toHaveTextContent("Kunden werden geladen.");
    expect(screen.queryByText("Keine Kunden.")).not.toBeInTheDocument();
  });

  it("shows an empty list only after a successful empty read", async () => {
    ports.getCustomersDb.mockResolvedValue({ ok: true, data: [] });
    render(<CustomersAppAdapter />);

    expect(await screen.findByText("Noch keine Kunden.")).toBeInTheDocument();
    expect(screen.getAllByRole("heading", { level: 1 })).toHaveLength(1);
  });

  it("keeps a failed read distinct from an empty list", async () => {
    ports.getCustomersDb.mockResolvedValue({ ok: false, error: "DB_ERROR", message: "neutral" });
    render(<CustomersAppAdapter />);

    expect(await screen.findByRole("alert")).toHaveTextContent("Kundenstamm konnte nicht sicher geladen werden.");
    expect(screen.queryByText("Noch keine Kunden.")).not.toBeInTheDocument();
  });

  it("renders the real customer label without internal identifiers or raw types", async () => {
    ports.getCustomersDb.mockResolvedValue({
      ok: true,
      data: [{ ...customer(), activeOrderCount: 2 }, { ...customer({ id: "a1b2c3d4-5678-4abc-9def-0123456789ab", customerNumber: "a1b2c3d4", name: "Privatkundenwerkstatt", type: "private" }), activeOrderCount: 0 }],
    });
    render(<CustomersAppAdapter />);

    const row = (await screen.findByText("Kreile Fahrzeugtechnik")).closest(".kr-zeile");
    if (!(row instanceof HTMLElement)) throw new Error("Kundenzeile fehlt");
    expect(row).toHaveTextContent("Esslingen · 2 aktive Aufträge");
    expect(screen.queryByText("business")).not.toBeInTheDocument();
    expect(screen.queryByText("a1b2c3d4")).not.toBeInTheDocument();
  });

  it("opens the selected customer card with its real ID", async () => {
    const selected = customer();
    ports.getCustomersDb.mockResolvedValue({ ok: true, data: [{ ...selected, activeOrderCount: 1 }] });
    render(<CustomersAppAdapter />);

    fireEvent.click(await screen.findByRole("button", { name: /Kreile Fahrzeugtechnik/ }));

    expect(ports.openCustomer).toHaveBeenCalledWith(selected.id);
  });

  it("keeps customer creation available with existing customers and after filtering", async () => {
    ports.canAction.mockReturnValue(true);
    ports.getCustomersDb.mockResolvedValue({ ok: true, data: [{ ...customer(), activeOrderCount: 1 }] });
    render(<CustomersAppAdapter />);

    await screen.findByText("Kreile Fahrzeugtechnik");
    fireEvent.click(screen.getByRole("button", { name: "Kunde anlegen" }));
    expect(ports.requestGlobalCreate).toHaveBeenCalledWith("CUSTOMER");

    fireEvent.change(screen.getByPlaceholderText("Name, Ort, Auftrag oder Stichwort"), { target: { value: "nicht vorhanden" } });
    expect(screen.getAllByRole("button", { name: "Kunde anlegen" })).toHaveLength(1);
  });
});
