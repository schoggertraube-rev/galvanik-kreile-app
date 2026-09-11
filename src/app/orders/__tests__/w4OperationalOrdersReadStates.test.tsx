import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import OrdersPage from "../page";
import type { OperationalOrder } from "@/lib/types/operationalOrder";

const ports = vi.hoisted(() => ({ getOrdersDb: vi.fn(), openOrder: vi.fn() }));
vi.mock("@/app/actions/orders.actions", () => ({ getOrdersDb: ports.getOrdersDb }));
vi.mock("@/lib/overlayStore", () => ({ useOverlayStore: (selector: (state: { openOrder: typeof ports.openOrder }) => unknown) => selector({ openOrder: ports.openOrder }) }));

const order = (): OperationalOrder => ({ id:"order-1",version:1,orderNumber:"A-100",customerId:"customer-1",customerName:"Kreile GmbH",title:"Welle",task:"Welle verzinken",itemDescription:"Welle",surfaceRequested:"Zink",station:"wareneingang",status:"ready",statusText:"Im Plan",risk:"green",currentStationId:"wareneingang",parts:[],intakeDate:"2026-08-10T08:00:00.000Z",dueDate:"2030-08-10T08:00:00.000Z",dueLabel:"Fällig",dueValue:"später",createdAt:"2026-08-10T08:00:00.000Z" });
beforeEach(()=>{vi.clearAllMocks(); window.sessionStorage.clear();}); afterEach(()=>cleanup());

describe("Orders V8 real read states",()=>{
 it("trennt loading, Fehler und echten Leerstand",async()=>{
  ports.getOrdersDb.mockReturnValueOnce(new Promise(()=>undefined)); const first=render(<OrdersPage/>); expect(screen.getByRole("status")).toHaveTextContent("Aufträge werden geladen"); first.unmount();
  ports.getOrdersDb.mockResolvedValueOnce({ok:false,error:"DB_ERROR",message:"internal"}); render(<OrdersPage/>); expect(await screen.findByRole("alert")).toHaveTextContent("nicht sicher geladen"); cleanup();
  ports.getOrdersDb.mockResolvedValueOnce({ok:true,data:[]}); render(<OrdersPage/>); expect(await screen.findByText("Noch keine Aufträge vorhanden.")).toBeVisible();
 });
 it("öffnet dieselbe Karte und bewahrt ehrliche Filterwahrheit",async()=>{
  ports.getOrdersDb.mockResolvedValue({ok:true,data:[order()]}); render(<OrdersPage/>); fireEvent.click(await screen.findByRole("button",{name:/A-100/})); expect(ports.openOrder).toHaveBeenCalledWith("order-1");
  fireEvent.change(screen.getByRole("textbox"),{target:{value:"unbekannt"}}); expect(screen.getByText("Keine Aufträge passen zu diesem Filter.")).toBeVisible();
  cleanup(); render(<OrdersPage/>); expect(await screen.findByRole("textbox")).toHaveValue("unbekannt"); expect(screen.getByText("Keine Aufträge passen zu diesem Filter.")).toBeVisible();
 });
 it("verwirft sichtbare Altdaten bei einem fehlerhaften Reload",async()=>{
  let finish!: (value:{ok:false;error:"DB_ERROR";message:string})=>void; ports.getOrdersDb.mockResolvedValueOnce({ok:true,data:[order()]}).mockReturnValueOnce(new Promise(resolve=>{finish=resolve})); render(<OrdersPage/>); expect(await screen.findByText("A-100")).toBeVisible(); fireEvent(window,new Event("kreile-sync-orders")); await waitFor(()=>expect(screen.getByRole("status")).toBeVisible()); expect(screen.queryByText("A-100")).not.toBeInTheDocument(); finish({ok:false,error:"DB_ERROR",message:"internal"}); expect(await screen.findByRole("alert")).toBeVisible();
 });
});
