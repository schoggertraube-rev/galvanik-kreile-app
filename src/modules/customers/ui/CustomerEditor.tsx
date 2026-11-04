"use client";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Button, Dialog, Hinweis } from "@/ui/kr";
import { KundeFormular } from "./KundeFormular";
import { CUSTOMER_FIELD_LABELS, EMPTY_CUSTOMER_FORM, kundeValidierung, projectCustomerTransfer, type CustomerFormValue } from "../customerFormContract";
import { kundeVollstaendigkeit } from "../orderReadiness";
import type { CustomerCardModel, UpdateCustomerInput } from "../server/types";
import type { CustomerAddressInput, CustomerAddressResult } from "../customerAddress";

function initialForm(card: CustomerCardModel): CustomerFormValue {
  return {...EMPTY_CUSTOMER_FORM,customerType:card.type==="business"||card.type==="privat"||card.type==="lieferant"?card.type:"",
    companyName:card.companyName??"",salutation:card.salutation??"",firstName:card.firstName??"",lastName:card.lastName??"",contactRole:card.contactRole??"",
    phone:card.phone??"",email:card.email??"",billingEmail:card.billingEmail??"",website:card.website??"",street:card.address??"",houseNumber:card.houseNumber??"",
    zipCode:card.zipCode??"",city:card.city??"",country:card.country??"",paymentPreference:card.paymentPreference??"",vatId:card.vatId??"",notes:card.notes??"",
    handoverPreference:card.handoverPreference??"",iban:card.iban??"",paymentTermDays:card.paymentTermDays==null?"":String(card.paymentTermDays),autoInfo:card.autoInfo??true,vorrang:card.vorrang??false};
}
const fieldIds:Partial<Record<keyof CustomerFormValue,string>>={customerType:"kundentyp",companyName:"name",firstName:"vorname",lastName:"nachname",contactRole:"funktion",phone:"telefon",street:"strasse",houseNumber:"hausnummer",zipCode:"plz",city:"ort",country:"land",paymentPreference:"zahlungsbedingung"};
function transferState(card:CustomerCardModel,input:unknown) {
  const baseline=initialForm(card),value={...baseline},proposals:Partial<CustomerFormValue>={},origins:Partial<Record<keyof CustomerFormValue,string>>={};
  for(const [key,next] of Object.entries(projectCustomerTransfer(input)) as Array<[keyof CustomerFormValue,CustomerFormValue[keyof CustomerFormValue]]>) {
    if(next===""||next===baseline[key])continue;
    if(baseline[key]===""){Object.assign(value,{[key]:next});origins[key]="aus deiner Eingabe";}
    else Object.assign(proposals,{[key]:next});
  }
  return {baseline,value,proposals,origins};
}

export function CustomerEditor({card,takeover,canManageMoney,canDecide=false,missingFirst=false,onClose,onSaved,onSave,checkAddress}: {
  card:CustomerCardModel;canManageMoney:boolean;canDecide?:boolean;missingFirst?:boolean;
  takeover?:unknown;
  onClose:()=>void;onSaved:(message:string)=>void;
  onSave:(input:UpdateCustomerInput)=>Promise<{ok:true}|{ok:false;message:string}>;
  checkAddress?:(input:CustomerAddressInput)=>Promise<{code:"OK";data:CustomerAddressResult}|{code:string;message:string}>;
}) {
  const [initial]=useState(()=>transferState(card,takeover));
  const baseline=initial.baseline;
  const [value,setValue]=useState(initial.value);
  const [priorityFields,setPriorityFields]=useState(()=>missingFirst ? kundeVollstaendigkeit({...initial.value,invoiceTermsEnabled:card.invoiceTermsEnabled},{geld:canManageMoney}).felder : []);
  const [proposals,setProposals]=useState(initial.proposals);
  const [clientEventId]=useState(()=>crypto.randomUUID());
  const [errors,setErrors]=useState<Partial<Record<keyof CustomerFormValue,string>>>({});
  const [busy,setBusy]=useState(false);
  const saving=useRef(false);
  const [failure,setFailure]=useState("");
  const [closePrompt,setClosePrompt]=useState(false);
  const [partialPrompt,setPartialPrompt]=useState(false);
  const [address,setAddress]=useState<CustomerAddressResult|null>(null);
  const focused=useRef<string|null>(null);
  const changed=JSON.stringify(value)!==JSON.stringify(baseline);
  const readiness=kundeVollstaendigkeit({...value,invoiceTermsEnabled:card.invoiceTermsEnabled},{geld:canManageMoney});
  const changeValue=(next:CustomerFormValue)=>{
    if(missingFirst && next.customerType!==value.customerType)setPriorityFields(kundeVollstaendigkeit({...next,invoiceTermsEnabled:card.invoiceTermsEnabled},{geld:canManageMoney}).felder);
    setValue(next);
  };
  const focus=useCallback((field:keyof CustomerFormValue|undefined)=>{
    if(!field)return;
    requestAnimationFrame(()=>document.querySelector<HTMLElement>(`[data-spec-id="kundebearbeiten.${fieldIds[field]??field}"]`)?.focus());
  },[]);
  useEffect(()=>{
    if(missingFirst)focus(kundeVollstaendigkeit({...baseline,invoiceTermsEnabled:card.invoiceTermsEnabled},{geld:canManageMoney}).felder[0]);
  },[baseline,canManageMoney,missingFirst,focus,card.invoiceTermsEnabled]);
  const addressInput=useMemo(()=>({country:value.country,zipCode:value.zipCode,city:value.city,street:value.street,houseNumber:value.houseNumber}),[value.country,value.zipCode,value.city,value.street,value.houseNumber]);
  useEffect(()=>{
    if(!checkAddress)return;
    const changedAddress=(["country","zipCode","city","street","houseNumber"] as const).some(key=>addressInput[key]!==baseline[key]);
    if(!changedAddress)return;
    let active=true;
    const timer=window.setTimeout(()=>{
      void checkAddress(addressInput).then(result=>{
        if(active&&result.code==="OK"&&"data" in result)setAddress(result.data);
      }).catch(error=>{
        console.error("[CUSTOMER_EDIT_ADDRESS_REQUEST_FAILED]",{errorName:error instanceof Error?error.name:"UnknownError"});
        if(active)setAddress({kind:"unavailable",message:"Prüfung gerade nicht möglich – wird beim Speichern geprüft",status:null,blocked:false,suggestions:[]});
      });
    },250);
    return()=>{active=false;window.clearTimeout(timer)};
  },[checkAddress,baseline,addressInput]);
  const continueEditing=()=>{
    setClosePrompt(false);
    requestAnimationFrame(()=>{if(focused.current)document.querySelector<HTMLElement>(`[data-spec-id="${focused.current}"]`)?.focus()});
  };
  const beforeClose=()=>{
    if(busy)return false;
    if(!changed)return true;
    const active=document.activeElement;if(active?.matches("input,textarea,select"))focused.current=active.getAttribute("data-spec-id");
    setClosePrompt(true);return false;
  };
  const save=async(forcePartial=false)=>{
    if(saving.current)return;
    const invalid=kundeValidierung(value,baseline,{invoiceTermsEnabled:card.invoiceTermsEnabled});
    setErrors(invalid);
    const first=Object.keys(invalid)[0] as keyof CustomerFormValue|undefined;
    if(first){focus(first);return;}
    if(address?.blocked){setFailure(address.message);return;}
    if(readiness.fehlt.length&&!forcePartial){setPartialPrompt(true);return;}
    saving.current=true;setBusy(true);setFailure("");setPartialPrompt(false);setClosePrompt(false);
    const {customerType,salutation,handoverPreference,paymentTermDays,...fields}=value;
    const input:UpdateCustomerInput={...fields,clientEventId,customerId:card.id,customerType:customerType as Exclude<CustomerFormValue["customerType"],"">,
      salutation:salutation||null,handoverPreference:handoverPreference||null,paymentTermDays:paymentTermDays?Number(paymentTermDays):null};
    if(!canManageMoney){delete input.paymentPreference;delete input.iban;delete input.paymentTermDays;}
    try {
      const result=await onSave(input);
      if(!result.ok){setFailure(`Nicht gespeichert · Eingaben sind noch da · ${result.message}`);return;}
      onSaved(readiness.fehlt.length?"Kunde gespeichert · unvollständig":"Kunde gespeichert");
    } catch(error) {
      console.error("[CUSTOMER_UPDATE_REQUEST_FAILED]",{errorName:error instanceof Error?error.name:"UnknownError"});
      setFailure("Nicht gespeichert · Eingaben sind noch da. Code: CUSTOMER_UPDATE_REQUEST_FAILED.");
    } finally {saving.current=false;setBusy(false);}
  };
  return <>
    <Dialog titel="Kunde bearbeiten" icon="edit" onSchliessen={onClose} vorSchliessen={beforeClose} schliessenSpecId="kundebearbeiten.schliessen"
      fuss={<><Button data-spec-id="kundebearbeiten.abbrechen" text="Abbrechen" onClick={()=>{if(beforeClose())onClose()}}/><Button data-spec-id="kundebearbeiten.speichern" art="erledigen" icon="check" text={busy?"Wird gespeichert …":"Speichern"} onClick={()=>void save()}/></>}>
      <form onFocusCapture={event=>{if(event.target instanceof HTMLElement&&event.target.matches("input,textarea,select"))focused.current=event.target.getAttribute("data-spec-id")}} onSubmit={event=>{event.preventDefault();void save()}} noValidate>
        <div className="kr-stapel"><div className="ev-kf-diff"><strong>{card.customerNumber ?? "Kundennummer fehlt"}</strong> · {card.companyName || card.name}</div>
        <p className="ev-kf-adrz">Kundennummer <strong>{card.customerNumber ?? "fehlt"} · fest</strong></p>
        {missingFirst && readiness.fehlt.length?<div data-spec-id="kundebearbeiten.hinweis"><Hinweis ton="warn">Für Aufträge fehlt: {readiness.fehlt.join(", ")}</Hinweis></div>:null}
        <KundeFormular prefix="kundebearbeiten" mode="edit" value={value} previous={baseline} priorityFields={priorityFields} errors={errors} onChange={changeValue} canManageMoney={canManageMoney} canDecide={canDecide}
          origins={initial.origins} proposals={proposals} onAcceptProposal={(field,next)=>{setValue(current=>({...current,[field]:next}));setProposals(current=>{const nextProposals={...current};delete nextProposals[field];return nextProposals})}}
          invoiceTermsEnabled={card.invoiceTermsEnabled} invoiceTermDays={card.invoiceTermDays} addressSuggestions={address?.suggestions} addressMessage={address?{tone:address.kind==="found"?"ok":address.kind==="not-checked"?"neutral":"warn",text:address.message}:null}/>
        {failure?<div data-spec-id="kundebearbeiten.zustand.fehler" role="alert"><Hinweis ton="warn">{failure}</Hinweis><Button data-spec-id="kundebearbeiten.erneut-speichern" text="Erneut speichern" onClick={()=>void save(true)}/></div>:null}</div>
      </form>
    </Dialog>
    {partialPrompt?<Dialog titel="Unvollständig für Auftrag" onSchliessen={()=>setPartialPrompt(false)}><div data-spec-id="kundebearbeiten.zustand.teilweise"><p>Für Auftrag fehlt noch: {readiness.fehlt.join(", ")}</p>
      <Button data-spec-id="kundebearbeiten.trotzdem-speichern" art="primaer" text="Trotzdem speichern" onClick={()=>void save(true)}/><Button data-spec-id="kundebearbeiten.weiter-ausfuellen" text="Weiter ausfüllen" onClick={()=>{setPartialPrompt(false);focus(readiness.felder[0])}}/></div></Dialog>:null}
    {closePrompt?<Dialog titel="Änderungen noch nicht gespeichert" onSchliessen={continueEditing}><div data-spec-id="entwurf"><p>Geändert: {(Object.keys(value) as Array<keyof CustomerFormValue>).filter(key=>value[key]!==baseline[key]).map(key=>CUSTOMER_FIELD_LABELS[key]).join(", ")}</p><Button data-spec-id="entwurf.verwerfen" text="Verwerfen" onClick={onClose}/><Button data-spec-id="entwurf.weiter-bearbeiten" text="Weiter bearbeiten" onClick={continueEditing}/><Button data-spec-id="entwurf.speichern" art="primaer" text="Speichern" onClick={()=>void save()}/></div></Dialog>:null}
  </>;
}
