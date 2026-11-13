"use client";
import {retainDevicePortResponse} from '@/lib/offline/devicePortRead';
import {useCallback,useEffect,useState} from "react";
import {useRouter} from "next/navigation";
import {
  getCustomerSummaryAction,
  readCustomerAddressAction,
  revokeCustomerAgreementAction,
  saveCustomerAgreementAction,
  updateCustomerAction,
} from "@/app/actions/customers.actions";
import {CustomerCardView,type CustomerCardModel,type CustomerCardState,type UpdateCustomerInput} from "@/modules/customers/public";
import {useOverlayStore} from "@/lib/overlayStore";
import {usePermissions} from "@/lib/auth/PermissionsContext";
import {requestGlobalCreate} from "@/components/layout/GlobalCreateFlow";
import {DomainAttachmentPanel} from "@/components/attachments/DomainAttachmentPanel";
import {CommunicationPanel} from "@/components/communication/CommunicationPanel";
import {ComplaintPanel} from '@/modules/customers/public';
import {getComplaints} from '@/app/actions/complaints.actions';

type Summary=Extract<Awaited<ReturnType<typeof getCustomerSummaryAction>>,{code:"OK"}>["data"];
function toCard(c:Summary):CustomerCardModel {
  return {...c,type:c.customerType,contactPerson:c.contactPerson,address:c.street,notes:c.notes};
}
export function CustomerCardAppAdapter({customerId,takeover,onOpenOrder,onClose,fallbackHref}:{customerId:string;takeover?:unknown;onOpenOrder?:(id:string)=>void;onClose?:()=>void;fallbackHref?:"/customers"}) {
  const router=useRouter();
  const storeOrder=useOverlayStore(state=>state.openOrder);
  const storeClose=useOverlayStore(state=>state.pop);
  const {hasArea,offlineScope,offline24h}=usePermissions();
  const [resolvedId,mode]=customerId.split("#");
  const [state,setState]=useState<CustomerCardState>({kind:"loading"});
  const load=useCallback(async():Promise<boolean>=>{
    const result=await getCustomerSummaryAction({customerId:resolvedId});
    if(result.code!=="OK"){
      const kind=result.code==="FORBIDDEN"||result.code==="UNAUTHENTICATED"?"denied":result.code==="NOT_FOUND"?"not-found":result.code==="VALIDATION_ERROR"?"conflict":"error";
      setState({kind,message:result.message});return false;
    }
    if(offline24h&&offlineScope){if(result.data.nextActionRule)await retainDevicePortResponse(offlineScope,true,{port:'customer.u2',portVersion:1,objectId:resolvedId,serverReadAt:result.serverReadAt,response:result.data.nextActionRule});else console.error('[OFFLINE_CUSTOMER_U2_SOURCE_INCOMPLETE]');}
    setState({kind:"data",card:toCard(result.data)});
    return true;
  },[resolvedId,offlineScope,offline24h]);
  useEffect(()=>{
    let active=true;
    const timer=window.setTimeout(()=>void load().catch(error=>{
      console.error("[CUSTOMER_CARD_REQUEST_FAILED]",{errorName:error instanceof Error?error.name:"UnknownError"});
      if(active)setState({kind:"error",message:"Kundenkarte konnte nicht sicher geladen werden. Code: CUSTOMER_CARD_REQUEST_FAILED."});
    }),0);
    return()=>{active=false;window.clearTimeout(timer)};
  },[load]);
  const save=async(input:UpdateCustomerInput)=>{
    const result=await updateCustomerAction(input);
    if(result.code!=="OK")return {ok:false as const,message:result.message};
    if(!await load())return {ok:false as const,message:"Die Änderung wurde geschrieben, die Ansicht konnte noch nicht sicher gelesen werden."};
    return {ok:true as const};
  };
  const reloadAgreement=useCallback(async()=>{
    if(!await load())throw new Error("CUSTOMER_AGREEMENT_SUMMARY_RELOAD_FAILED");
  },[load]);
  const close=onClose??(fallbackHref?()=>router.replace(fallbackHref):storeClose);
  return <CustomerCardView key={customerId} state={state} onOpenOrder={onOpenOrder??storeOrder} onClose={close}
    complaintsPanel={state.kind==='data'?<ComplaintPanel filter={{customerId:resolvedId}} read={getComplaints} mayRecord={hasArea('auftraege')}/>:null}
    onSaveCustomer={hasArea("kunden")?save:undefined} canManageMoney={hasArea("geld")} canDecide={hasArea("entscheiden")}
    takeover={takeover} initialEdit={mode==="fehlend"||mode==="uebernahme"||mode==="bearbeiten"} missingFirst={mode==="fehlend"} checkAddress={readCustomerAddressAction}
    onSaveAgreement={hasArea("geld")?saveCustomerAgreementAction:undefined}
    onRevokeAgreement={hasArea("geld")?revokeCustomerAgreementAction:undefined}
    onReload={hasArea("geld")?reloadAgreement:undefined}
    onNewOrder={hasArea("eingang")?()=>{close();requestGlobalCreate({intent:"DIRECT_INTAKE",prefill:{customerId:resolvedId}})}:undefined}
    documentsPanel={state.kind==="data"?<><DomainAttachmentPanel targetType="CUSTOMER" targetId={state.card.id}/><CommunicationPanel targetType="CUSTOMER" targetId={state.card.id}/></>:null}/>;
}
