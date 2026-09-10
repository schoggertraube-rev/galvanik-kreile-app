"use client";

import { useEffect, useState } from "react";
import { getLiveOrderCardAction } from "@/app/actions/orders.actions";
import { OrderCardView, type OrderCardState } from "@/modules/orders/public";
import { useOverlayStore } from "@/lib/overlayStore";

export function OrderCardAppAdapter({ orderId, onOpenCustomer, onClose }: { orderId:string; onOpenCustomer?:(customerId:string)=>void; onClose?:()=>void }) {
  const storeOpenCustomer = useOverlayStore((value) => value.openCustomer);
  const storeClose = useOverlayStore((value) => value.pop);
  const [state, setState] = useState<OrderCardState>({ kind:"loading" });
  useEffect(() => { let active=true; void getLiveOrderCardAction({orderId}).then((result) => {
    if(!active)return;
    if(result.code!=="OK") { const kind = result.code==="FORBIDDEN"||result.code==="UNAUTHENTICATED"?"denied":result.code==="NOT_FOUND"?"not-found":result.code==="VALIDATION_ERROR"?"conflict":"error"; setState({kind,message:result.message}); return; }
    const card=result.data.card;
    setState({kind:"data",card:{id:card.id,version:card.version,orderNumber:card.orderNumber,customerId:card.customerId,customerName:card.customerName,title:card.title,note:card.note,station:card.station,status:card.status,dueAt:card.dueAt,intakeAt:card.intakeAt,items:card.items.map(item=>({id:item.id,position:item.position,name:item.name,quantity:item.quantity,material:item.material,surface:item.surfaceRequested})),frozenAt:card.freeze?.frozenAt??null,totalAmountCents:card.freeze?.totalAmountCents??null}});
  }).catch(()=>{if(active)setState({kind:"error",message:"Auftragskarte konnte nicht sicher geladen werden."})}); return()=>{active=false}; },[orderId]);
  return <OrderCardView state={state} onOpenCustomer={onOpenCustomer ?? storeOpenCustomer} onClose={onClose ?? storeClose}/>;
}
