import { fireEvent,render,screen } from "@testing-library/react";
import { describe,expect,it,vi } from "vitest";
const ports=vi.hoisted(()=>({read:vi.fn(),open:vi.fn()}));
vi.mock("@/app/actions/customers.actions",()=>({getCustomersDb:ports.read}));
vi.mock("@/lib/overlayStore",()=>({useOverlayStore:(selector:(s:{openCustomer:typeof ports.open})=>unknown)=>selector({openCustomer:ports.open})}));
import CustomersPage from "../page";
describe("Customers V2 real states",()=>{
 it("trennt Denial, Fehler und echten Leerstand",async()=>{ports.read.mockResolvedValueOnce({ok:false,error:"UNAUTHORIZED",message:"x"});const first=render(<CustomersPage/>);expect(await screen.findByRole("alert")).toHaveTextContent("nicht freigegeben");first.unmount();ports.read.mockResolvedValueOnce({ok:true,data:[]});render(<CustomersPage/>);expect(await screen.findByText("Noch keine Kunden vorhanden.")).toBeVisible()});
 it("filtert reale Kunden und öffnet dieselbe Kundenkarte",async()=>{ports.read.mockResolvedValue({ok:true,data:[{id:"c1",customerNumber:"K-10",name:"Kreile GmbH",type:"business",city:"Musterstadt"}]});render(<CustomersPage/>);const button=await screen.findByRole("button",{name:/Kreile GmbH/});fireEvent.click(button);expect(ports.open).toHaveBeenCalledWith("c1");fireEvent.change(screen.getByRole("textbox"),{target:{value:"unbekannt"}});expect(screen.getByText("Keine Kunden passen zu diesem Filter.")).toBeVisible()});
});
