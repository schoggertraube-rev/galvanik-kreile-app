"use client";
import {useCallback,useEffect,useState} from 'react';
import {Button,Dialog,Fakten,Hinweis} from '@/ui/kr';
import {INTAKE_MAIL_ADOPT_EVENT,type IntakeMailSelectionResult,type IntakeMailSummary} from '../mailSelectionContract';
import type {IntakeCaptureResult,IntakeCapture} from '../captureContract';

export type MailSelectionPorts={list:()=>Promise<IntakeMailSelectionResult>;read:(id:string)=>Promise<IntakeCaptureResult>};
export function MailSelectionDialog({ports,target,onClose}:{ports:MailSelectionPorts;target:'eingang'|'kundeneu';onClose:()=>void}){
 const [mails,setMails]=useState<IntakeMailSummary[]>([]),[selected,setSelected]=useState<{row:IntakeMailSummary;capture:IntakeCapture}|null>(null),[loading,setLoading]=useState(false),[failure,setFailure]=useState<string|null>(null);
 const load=useCallback(async()=>{
  setLoading(true);setFailure(null);
  try{const result=await ports.list();if(result.code!=='OK'){setFailure(result.message);return;}setMails(result.mails);}
  catch(error){console.error('[MAIL_SELECTION_DIALOG_READ_FAILED]',error);setFailure('Offene Mails nicht verfügbar · Fehlercode: MAIL_SELECTION_DIALOG_READ_FAILED.');}
  finally{setLoading(false);}
 },[ports]);
 useEffect(()=>{const timer=setTimeout(()=>void load(),0);return()=>clearTimeout(timer);},[load]);
 const choose=async(row:IntakeMailSummary)=>{
  if(loading)return;setLoading(true);setFailure(null);
  try{const result=await ports.read(row.id);if(result.code!=='OK'){setFailure(result.message);return;}setSelected({row,capture:result.capture});}
  catch(error){console.error('[MAIL_SELECTION_DIALOG_ITEM_FAILED]',error);setFailure('Mail nicht ladbar · Fehlercode: MAIL_SELECTION_DIALOG_ITEM_FAILED.');}
  finally{setLoading(false);}
 };
 const adopt=()=>{
  if(!selected||loading)return;
  const event=new CustomEvent(INTAKE_MAIL_ADOPT_EVENT,{detail:{target,capture:selected.capture},cancelable:true});
  if(window.dispatchEvent(event)){setFailure('Erfassung nicht mehr geöffnet · Mail bleibt unverändert. Code: INTAKE_MAIL_TARGET_MISSING.');return;}
  onClose();
 };
 return <Dialog titel="Wem gehört das?" icon="mail" groesse="breit" schliessenSpecId="mailein.schliessen" onSchliessen={onClose} fuss={selected?<><Button data-spec-id="mailein.andere-mail" text="Andere Mail" disabled={loading} onClick={()=>{setSelected(null);void load();}}/><Button data-spec-id="mailein.uebernehmen" art="primaer" icon="check" text="Übernehmen" disabled={loading} onClick={adopt}/></>:<Button text="Schließen" onClick={onClose}/>}>
  <div data-spec-id="mailein" className="kr-stapel">
   {loading?<p role="status">Wird geladen …</p>:null}
   {failure?<div role="alert" data-spec-id="mailein.zustand.fehler"><Hinweis ton="warn">{failure}</Hinweis><Button data-spec-id="mailein.erneut" text="Erneut" disabled={loading} onClick={()=>void (selected?choose(selected.row):load())}/></div>:null}
   {selected?<><Fakten zeilen={[{k:'Herkunft',v:`${selected.row.senderName??selected.row.senderAddress??'Absender fehlt'} · ${selected.row.receivedAt??'Eingangszeit fehlt'}`},{k:'Inhalt',v:selected.row.subject??'Betreff fehlt'},{k:'Originale',v:String(selected.capture.files.length)}]}/>{selected.capture.text?<p style={{whiteSpace:'pre-wrap'}}>{selected.capture.text}</p>:<p>Inhalt fehlt</p>}</>
    :<section className="kr-stapel" aria-label="Offene Eingänge"><h3>Offene Eingänge · neueste oben</h3>{mails.map(mail=><Button key={mail.id} data-spec-id="mailein.mail-waehlen" art="sekundaer" text={`${mail.subject??'Betreff fehlt'} · ${mail.senderName??mail.senderAddress??'Absender fehlt'} · ${mail.fileCount} Anhänge`} disabled={loading} onClick={()=>void choose(mail)}/>)}{!loading&&!failure&&!mails.length?<p data-spec-id="mailein.zustand.leer">Keine offenen Mails</p>:null}</section>}
  </div>
 </Dialog>;
}
