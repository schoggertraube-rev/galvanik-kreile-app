"use client";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Button, Checkbox, Dialog, Eingabe, Feld, FormRaster, Hinweis } from "@/ui/kr";
import { Rueckfrage } from "@/ui/kr/Dialog";
import { KundeFormular } from "./KundeFormular";
import { CUSTOMER_FIELD_LABELS, EMPTY_CUSTOMER_FORM, kundeValidierung, projectCustomerTransfer, type CustomerFormValue } from "../customerFormContract";
import { kundeVollstaendigkeit } from "../orderReadiness";
import type { CustomerCardModel, CustomerFreeTextAgreementInput, UpdateCustomerInput } from "../server/types";
import type { CustomerAddressInput, CustomerAddressResult } from "../customerAddress";

function initialForm(card: CustomerCardModel): CustomerFormValue {
  return {...EMPTY_CUSTOMER_FORM,customerType:card.type==="business"||card.type==="privat"||card.type==="lieferant"?card.type:"",
    companyName:card.companyName??"",salutation:card.salutation??"",firstName:card.firstName??"",lastName:card.lastName??"",contactRole:card.contactRole??"",
    phone:card.phone??"",email:card.email??"",billingEmail:card.billingEmail??"",website:card.website??"",street:card.address??"",houseNumber:card.houseNumber??"",
    zipCode:card.zipCode??"",city:card.city??"",country:card.country??"",paymentPreference:card.paymentPreference??"",vatId:card.vatId??"",notes:card.notes??"",
    handoverPreference:card.handoverPreference??"",iban:card.iban??"",paymentTermDays:card.paymentTermDays==null?"":String(card.paymentTermDays),autoInfo:card.autoInfo??true,vorrang:card.vorrang??false};
}

function initialAgreements(card: CustomerCardModel, canManageMoney: boolean): CustomerFreeTextAgreementInput[] {
  return (card.agreements ?? [])
    .filter((agreement) => agreement.orderId === null && agreement.type === null && agreement.revokedAt === null && (canManageMoney || !agreement.money))
    .sort((left, right) => left.position - right.position)
    .map((agreement) => ({
      id: agreement.id,
      bezeichnung: agreement.label,
      wert: agreement.value ?? "",
      geld: agreement.money,
      hinweis: agreement.notice,
      gueltigBis: agreement.validUntil,
    }));
}

function validDateOnly(value: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const date = new Date(`${value}T00:00:00.000Z`);
  return Number.isFinite(date.getTime()) && date.toISOString().slice(0, 10) === value;
}

function agreementFieldError(agreement: CustomerFreeTextAgreementInput, field: "bezeichnung" | "wert" | "gueltigBis") {
  if (field === "bezeichnung" && (agreement.bezeichnung.trim().length < 1 || agreement.bezeichnung.trim().length > 40)) return "Bezeichnung 1–40 Zeichen";
  if (field === "wert" && (agreement.wert.trim().length < 1 || agreement.wert.trim().length > 200)) return "Absprache 1–200 Zeichen";
  if (field === "gueltigBis" && agreement.gueltigBis && !validDateOnly(agreement.gueltigBis)) return "Datum prüfen";
  return null;
}

function agreementHasError(agreement: CustomerFreeTextAgreementInput) {
  return Boolean(agreementFieldError(agreement, "bezeichnung") || agreementFieldError(agreement, "wert") || agreementFieldError(agreement, "gueltigBis"));
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
  const [initial]=useState(()=>({...transferState(card,takeover),agreements:initialAgreements(card,canManageMoney)}));
  const baseline=initial.baseline;
  const baselineAgreements=initial.agreements;
  const [value,setValue]=useState(initial.value);
  const [agreements,setAgreements]=useState<CustomerFreeTextAgreementInput[]>(baselineAgreements);
  const [showAgreementErrors,setShowAgreementErrors]=useState(false);
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
  const agreementSlotsAvailable=Math.max(0,Math.min(20,card.agreementSlotsAvailable??20));
  const agreementLimitReached=agreements.length>=agreementSlotsAvailable;
  const agreementsChanged=JSON.stringify(agreements)!==JSON.stringify(baselineAgreements);
  const changed=JSON.stringify(value)!==JSON.stringify(baseline) || agreementsChanged;
  const readiness=kundeVollstaendigkeit({...value,invoiceTermsEnabled:card.invoiceTermsEnabled},{geld:canManageMoney});
  const changeValue=(next:CustomerFormValue)=>{
    if(missingFirst && next.customerType!==value.customerType)setPriorityFields(kundeVollstaendigkeit({...next,invoiceTermsEnabled:card.invoiceTermsEnabled},{geld:canManageMoney}).felder);
    setValue(next);
  };
  const changeAgreement=(index:number,patch:Partial<CustomerFreeTextAgreementInput>)=>{
    setAgreements(current=>current.map((agreement,entryIndex)=>entryIndex===index?{...agreement,...patch}:agreement));
  };
  const moveAgreement=(index:number,direction:-1|1)=>{
    const nextIndex=index+direction;
    if(nextIndex<0||nextIndex>=agreements.length)return;
    setAgreements(current=>{const next=[...current];const [entry]=next.splice(index,1);if(!entry)return current;next.splice(nextIndex,0,entry);return next;});
  };
  const removeAgreement=(index:number)=>setAgreements(current=>current.filter((_,entryIndex)=>entryIndex!==index));
  const addAgreement=()=>{
    if(agreementLimitReached)return;
    setAgreements(current=>[...current,{id:null,bezeichnung:"",wert:"",geld:false,hinweis:false,gueltigBis:null}]);
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
    const invalidAgreementIndex=agreements.findIndex(agreementHasError);
    if(invalidAgreementIndex>=0){
      setShowAgreementErrors(true);
      requestAnimationFrame(()=>document.querySelectorAll<HTMLElement>(`[data-spec-id="kundebearbeiten.absprache.bezeichnung"]`)[invalidAgreementIndex]?.focus());
      return;
    }
    if(address?.blocked){setFailure(address.message);return;}
    if(readiness.fehlt.length&&!forcePartial){setPartialPrompt(true);return;}
    saving.current=true;setBusy(true);setFailure("");setPartialPrompt(false);setClosePrompt(false);
    const {customerType,salutation,handoverPreference,paymentTermDays,...fields}=value;
    const input:UpdateCustomerInput={...fields,clientEventId,customerId:card.id,customerType:customerType as Exclude<CustomerFormValue["customerType"],"">,
      salutation:salutation||null,handoverPreference:handoverPreference||null,paymentTermDays:paymentTermDays?Number(paymentTermDays):null,
      agreements};
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
        <section className="kr-stapel" data-spec-id="kundebearbeiten.absprache" aria-label="Absprachen & Eigenheiten">
          <h3 className="ev-kf-unter">Absprachen & Eigenheiten</h3>
          {agreements.map((agreement,index)=><div key={agreement.id ?? `new-${index}`} className="kr-stapel" data-spec-id="kundebearbeiten.absprache">
            <strong>{index+1}. Absprache</strong>
            <FormRaster>
              <Feld label="Bezeichnung" fehler={showAgreementErrors?agreementFieldError(agreement,"bezeichnung") ?? undefined:undefined}>
                <Eingabe data-spec-id="kundebearbeiten.absprache.bezeichnung" maxLength={40} value={agreement.bezeichnung} onChange={event=>changeAgreement(index,{bezeichnung:event.target.value})}/>
              </Feld>
              <Feld label="Absprache" fehler={showAgreementErrors?agreementFieldError(agreement,"wert") ?? undefined:undefined}>
                <Eingabe data-spec-id="kundebearbeiten.absprache.wert" maxLength={200} value={agreement.wert} onChange={event=>changeAgreement(index,{wert:event.target.value})}/>
              </Feld>
              <Feld label="Gültig bis" fehler={showAgreementErrors?agreementFieldError(agreement,"gueltigBis") ?? undefined:undefined}>
                <Eingabe data-spec-id="kundebearbeiten.absprache.gueltig-bis" type="date" value={agreement.gueltigBis ?? ""} onChange={event=>changeAgreement(index,{gueltigBis:event.target.value||null})}/>
              </Feld>
              <Feld label="Anzeige">
                <div className="kr-stapel" style={{gap:8}}>
                  {canManageMoney?<div data-spec-id="kundebearbeiten.absprache.geld"><Checkbox checked={agreement.geld} onChange={geld=>changeAgreement(index,{geld})}>Geld (Preis, Zahlung)</Checkbox></div>:null}
                  <div data-spec-id="kundebearbeiten.absprache.hinweis"><Checkbox checked={agreement.hinweis} onChange={hinweis=>changeAgreement(index,{hinweis})}>Als Hinweis zeigen</Checkbox></div>
                </div>
              </Feld>
            </FormRaster>
            <div className="kr-schnellleiste">
              <Button data-spec-id="kundebearbeiten.absprache.hoch" text="Hoch" disabled={index===0} onClick={()=>moveAgreement(index,-1)}/>
              <Button data-spec-id="kundebearbeiten.absprache.runter" text="Runter" disabled={index===agreements.length-1} onClick={()=>moveAgreement(index,1)}/>
              <Button data-spec-id="kundebearbeiten.absprache.entfernen" art="leise" text="Entfernen" onClick={()=>removeAgreement(index)}/>
            </div>
          </div>)}
          {agreements.length===0?<Hinweis>Noch keine Absprachen hinterlegt.</Hinweis>:null}
          {agreementLimitReached?<Hinweis ton="warn">Höchstens 20 Absprachen möglich.</Hinweis>:null}
          <Button data-spec-id="kundebearbeiten.absprache-hinzufuegen" icon="plus" text="Absprache hinzufügen" disabled={agreementLimitReached} onClick={addAgreement}/>
        </section>
        {failure?<div data-spec-id="kundebearbeiten.zustand.fehler" role="alert"><Hinweis ton="warn">{failure}</Hinweis><Button data-spec-id="kundebearbeiten.erneut-speichern" text="Erneut speichern" onClick={()=>void save(true)}/></div>:null}</div>
      </form>
    </Dialog>
    {partialPrompt?<Dialog titel="Unvollständig für Auftrag" onSchliessen={()=>setPartialPrompt(false)}><div data-spec-id="kundebearbeiten.zustand.teilweise"><p>Für Auftrag fehlt noch: {readiness.fehlt.join(", ")}</p>
      <Button data-spec-id="kundebearbeiten.trotzdem-speichern" art="primaer" text="Trotzdem speichern" onClick={()=>void save(true)}/><Button data-spec-id="kundebearbeiten.weiter-ausfuellen" text="Weiter ausfüllen" onClick={()=>{setPartialPrompt(false);focus(readiness.felder[0])}}/></div></Dialog>:null}
    {closePrompt?<Rueckfrage felder={[...(Object.keys(value) as Array<keyof CustomerFormValue>).filter(key=>value[key]!==baseline[key]).map(key=>CUSTOMER_FIELD_LABELS[key]),...(agreementsChanged?["Absprachen & Eigenheiten"]:[])]}
      hauptaktion={{text:"Speichern",lauftext:"Wird gespeichert …",ausfuehren:()=>void save()}} beschaeftigt={busy}
      fehler={failure||Object.values(errors).filter(Boolean).join(" · ")||null} onVerwerfen={onClose} onWeiter={continueEditing}/>:null}
  </>;
}
