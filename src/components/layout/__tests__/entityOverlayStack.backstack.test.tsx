import { fireEvent,render,screen } from "@testing-library/react";
import { describe,expect,it,vi } from "vitest";
const state=vi.hoisted(()=>({stack:[{type:"order",id:"o1"}] as Array<{type:"order"|"customer";id:string}>,pop:vi.fn(),openOrder:vi.fn(),openCustomer:vi.fn()}));
vi.mock("@/lib/overlayStore",()=>({useOverlayStore:(selector:(value:typeof state)=>unknown)=>selector(state)}));
vi.mock("@/app/orders/OrderCardAppAdapter",()=>({OrderCardAppAdapter:({onOpenCustomer}:{onOpenCustomer:(id:string)=>void})=><button onClick={()=>onOpenCustomer("c1")}>Kunde öffnen</button>}));
vi.mock("@/app/customers/CustomerCardAppAdapter",()=>({CustomerCardAppAdapter:({onOpenOrder}:{onOpenOrder:(id:string)=>void})=><button onClick={()=>onOpenOrder("o2")}>Auftrag öffnen</button>}));
import { EntityOverlayStack } from "../EntityOverlayStack";
describe("eine Overlay-/Backstack-Wahrheit",()=>{
 it("führt Auftrag zu Kunde über denselben Store",()=>{render(<EntityOverlayStack/>);fireEvent.click(screen.getByRole("button",{name:"Kunde öffnen"}));expect(state.openCustomer).toHaveBeenCalledWith("c1")});
 it("führt Kunde zu Auftrag und schließt nur die oberste Ebene",()=>{state.stack=[{type:"customer",id:"c1"}];render(<EntityOverlayStack/>);fireEvent.click(screen.getByRole("button",{name:"Auftrag öffnen"}));expect(state.openOrder).toHaveBeenCalledWith("o2");fireEvent.mouseDown(screen.getByRole("dialog"));expect(state.pop).toHaveBeenCalled()});
});
