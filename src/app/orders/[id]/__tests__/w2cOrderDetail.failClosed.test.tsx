import { render,screen } from "@testing-library/react";
import { describe,expect,it,vi } from "vitest";
const ports=vi.hoisted(()=>({read:vi.fn(),openCustomer:vi.fn(),pop:vi.fn()}));
vi.mock("@/app/actions/orders.actions",()=>({getLiveOrderCardAction:ports.read}));
vi.mock("@/lib/overlayStore",()=>({useOverlayStore:(selector:(s:{openCustomer:typeof ports.openCustomer;pop:typeof ports.pop})=>unknown)=>selector({openCustomer:ports.openCustomer,pop:ports.pop})}));
import OrderDetailPage from "../page";
describe("Orders V8 deeplink",()=>{
 it("liest genau die angeforderte kanonische Karte",async()=>{ports.read.mockResolvedValue({code:"NOT_FOUND",message:"Auftrag nicht gefunden."});render(await OrderDetailPage({params:Promise.resolve({id:"order-7"})}));expect(await screen.findByRole("alert")).toHaveTextContent("Auftrag nicht gefunden");expect(ports.read).toHaveBeenCalledWith({orderId:"order-7"})});
 it("zeigt keine alte NOT_AVAILABLE-Hülle",async()=>{ports.read.mockResolvedValue({code:"FORBIDDEN",message:"Auftragskarte ist nicht erlaubt."});render(await OrderDetailPage({params:Promise.resolve({id:"foreign"})}));expect(await screen.findByRole("alert")).toHaveTextContent("nicht erlaubt");expect(screen.queryByText(/NOT_AVAILABLE/)).not.toBeInTheDocument()});
});
