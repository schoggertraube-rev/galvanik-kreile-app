"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { getCustomerSummaryAction, updateCustomerCommercialAction } from "@/app/actions/customers.actions";
import { CustomerCardView, type CustomerCardModel, type CustomerCardState, type UpdateCustomerCommercialInput } from "@/modules/customers/public";
import { useOverlayStore } from "@/lib/overlayStore";
import { requestGlobalCreate } from "@/components/layout/GlobalCreateFlow";
import { DomainAttachmentPanel } from "@/components/attachments/DomainAttachmentPanel";

type CustomerSummaryData = Extract<Awaited<ReturnType<typeof getCustomerSummaryAction>>, { code: "OK" }>["data"];
function toCard(c: CustomerSummaryData): CustomerCardModel {
  return {
    id:c.id, customerNumber:c.customerNumber, name:c.name, companyName:c.companyName, type:c.type,
    contactPerson:c.contactPerson, email:c.email, phone:c.phone, address:c.street ?? c.address,
    zipCode:c.zipCode, city:c.city, country:c.country, paymentPreference:c.paymentPreference, vatId:c.vatId,
    classification:c.classification, notes:c.internalNotes, tags:c.tags, createdAt:c.createdAt,
    updatedAt:c.updatedAt, orderCount:c.orderCount, wareImHausCount:c.wareImHausCount, orders:c.orders,
  };
}

export function CustomerCardAppAdapter({customerId,onOpenOrder,onClose,fallbackHref}:{customerId:string;onOpenOrder?:(id:string)=>void;onClose?:()=>void;fallbackHref?:"/customers"}) {
  const router=useRouter(); const storeOrder=useOverlayStore(s=>s.openOrder); const storeClose=useOverlayStore(s=>s.pop);
  const[state,setState]=useState<CustomerCardState>({kind:"loading"});
  const load = useCallback(async () => {
    const result=await getCustomerSummaryAction({customerId});
    if(result.code!=="OK") { const kind=result.code==="FORBIDDEN"||result.code==="UNAUTHENTICATED"?"denied":result.code==="NOT_FOUND"?"not-found":result.code==="VALIDATION_ERROR"?"conflict":"error"; setState({kind,message:result.message}); return; }
    setState({kind:"data",card:toCard(result.data)});
  },[customerId]);
  useEffect(()=>{let active=true; const timer=window.setTimeout(()=>void load().catch(()=>{if(active)setState({kind:"error",message:"Kundenkarte konnte nicht sicher geladen werden."})}),0); return()=>{active=false;window.clearTimeout(timer)}},[load]);
  const save = async (input: UpdateCustomerCommercialInput) => {
    const result = await updateCustomerCommercialAction(input);
    if (result.code !== "OK") return { ok:false as const, message:result.message };
    setState({kind:"data",card:toCard(result.customer)}); return {ok:true as const};
  };
  const close=onClose??(fallbackHref?()=>router.replace(fallbackHref):storeClose);
  return <CustomerCardView state={state} onOpenOrder={onOpenOrder??storeOrder} onClose={close} onSaveCommercial={save} onNewOrder={() => { close(); requestGlobalCreate("DIRECT_INTAKE"); }} documentsPanel={state.kind === "data" ? <DomainAttachmentPanel targetType="CUSTOMER" targetId={state.card.id} /> : null}/>;
}
