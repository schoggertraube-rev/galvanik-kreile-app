import { fireEvent,render,screen } from "@testing-library/react";
import { describe,expect,it,vi } from "vitest";
const ports=vi.hoisted(()=>({read:vi.fn(),openOrder:vi.fn(),pop:vi.fn()}));
vi.mock("next/navigation",()=>({useRouter:()=>({replace:vi.fn()})}));
vi.mock("@/app/actions/customers.actions",()=>({getCustomerSummaryAction:ports.read}));
vi.mock("@/lib/overlayStore",()=>({useOverlayStore:(selector:(s:{openOrder:typeof ports.openOrder;pop:typeof ports.pop})=>unknown)=>selector({openOrder:ports.openOrder,pop:ports.pop})}));
import CustomerDetailPage from "../page";
const customer={id:"customer-1",customerNumber:"K-10",name:"Kreile GmbH",companyName:"Kreile GmbH",type:"business",contactPerson:"Rolf",email:"buero@example.test",phone:"0123",street:"Werkstraße 1",address:null,zipCode:"12345",city:"Musterstadt",country:"DE",classification:null,internalNotes:"Nur belegte Notiz",tags:["Stammkunde"],createdAt:"2026-01-01T00:00:00.000Z",updatedAt:"2026-01-02T00:00:00.000Z",orderCount:1,wareImHausCount:1,wareImHaus:true,orders:[{id:"order-1",orderNumber:"A-100",title:"Welle",station:"fertig",status:"fertig",version:2,dueAt:null}]};
describe("Customers V2 deeplink privacy",()=>{
 it("liest tenantgebunden und öffnet den zugehörigen Auftrag im selben Stack",async()=>{ports.read.mockResolvedValue({code:"OK",data:customer});render(await CustomerDetailPage({params:Promise.resolve({id:"customer-1"})}));expect(await screen.findByText("Kreile GmbH")).toBeVisible();fireEvent.click(screen.getByRole("button",{name:/A-100/}));expect(ports.openOrder).toHaveBeenCalledWith("order-1");expect(ports.read).toHaveBeenCalledWith({customerId:"customer-1"})});
 it("trennt Denial vom leeren Zustand und zeigt keine internen Details",async()=>{ports.read.mockResolvedValue({code:"FORBIDDEN",message:"Kundenkarte ist nicht erlaubt."});render(await CustomerDetailPage({params:Promise.resolve({id:"foreign"})}));expect(await screen.findByRole("alert")).toHaveTextContent("nicht erlaubt");expect(screen.queryByText(/NOT_AVAILABLE|SQL|tenant/i)).not.toBeInTheDocument()});
});
