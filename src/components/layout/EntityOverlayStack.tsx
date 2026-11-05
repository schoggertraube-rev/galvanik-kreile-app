"use client";
import {createPortal} from "react-dom";
import {useOverlayStore} from "@/lib/overlayStore";
import {OrderCardAppAdapter} from "@/app/orders/OrderCardAppAdapter";
import {CustomerCardAppAdapter} from "@/app/customers/CustomerCardAppAdapter";
import {KrApp,useKrGeraet} from "@/ui/kr";

export function EntityOverlayStack(){
 const device=useKrGeraet();
 const stack=useOverlayStore(state=>state.stack);
 const pop=useOverlayStore(state=>state.pop);
 const openOrder=useOverlayStore(state=>state.openOrder);
 const openCustomer=useOverlayStore(state=>state.openCustomer);
 const top=stack.at(-1);
 if(!top||(top.type!=="order"&&top.type!=="customer")||typeof document==="undefined")return null;
 const card=top.type==="order"?<OrderCardAppAdapter key={top.id} orderId={top.id} onOpenCustomer={openCustomer} onClose={pop}/>:<CustomerCardAppAdapter key={top.id} customerId={top.id} takeover={top.prefill} onOpenOrder={openOrder} onClose={pop}/>;
 // One existing stack, mounted above the invoking dialog; its state stays underneath.
 return createPortal(<KrApp geraet={device} portal>{card}</KrApp>,document.body,`${top.type}:${top.id}:${stack.length}`);
}
