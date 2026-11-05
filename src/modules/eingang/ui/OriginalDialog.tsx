"use client";
import {useCallback,useEffect,useRef,useState} from 'react';
import Image from 'next/image';
import {Button,Dialog,Hinweis,Kachel} from '@/ui/kr';
import type {IntakeCapture,IntakeCaptureResult} from '../captureContract';
import type {OriginalReadResult,OriginalConfirmResult} from '../originalContract';

export type OriginalPorts={open:(input:{fileId:string;clientEventId:string})=>Promise<OriginalReadResult>;confirm:(input:{fileId:string;clientEventId:string})=>Promise<OriginalConfirmResult>;capture:(itemId:string)=>Promise<IntakeCaptureResult>;retry:(input:{fileId:string;clientEventId:string})=>Promise<IntakeCaptureResult>};
type Data=Extract<OriginalReadResult,{code:'OK'}>['original'];
export function OriginalDialog({fileId,ports,onClose,onAssign,onMessage}:{fileId:string;ports:OriginalPorts;onClose:()=>void;onAssign:(itemId:string,move:boolean)=>string|null;onMessage:(s:string)=>void}){
 const [data,setData]=useState<Data|null>(null),[capture,setCapture]=useState<IntakeCapture|null>(null),[failure,setFailure]=useState<{message:string;blocked:boolean}|null>(null);
 const [loading,setLoading]=useState(true),[busy,setBusy]=useState(false),[message,setMessage]=useState<string|null>(null);
 const working=useRef(false),openKey=useRef(crypto.randomUUID()),confirmKey=useRef(crypto.randomUUID()),retryKey=useRef(crypto.randomUUID());
 const load=useCallback(async()=>{
  setLoading(true);setFailure(null);
  try{const result=await ports.open({fileId,clientEventId:openKey.current});if(result.code!=='OK'){setFailure({message:result.message,blocked:result.code==='FILE_BLOCKED'});return;}
   setData(result.original);if(result.original.restricted){setCapture(null);return;}const read=await ports.capture(result.original.itemId);
   if(read.code!=='OK'){setFailure({message:read.message,blocked:false});return;}setCapture(read.capture);
  }catch(error){console.error('[ORIGINAL_DIALOG_READ_FAILED]',error);setFailure({message:'Original nicht ladbar · Fehlercode: ORIGINAL_DIALOG_READ_FAILED.',blocked:false});}
  finally{setLoading(false);}
 },[fileId,ports]);
 useEffect(()=>{const timer=setTimeout(()=>void load(),0);return()=>clearTimeout(timer);},[load]);
 const confirm=async()=>{
  if(working.current||!data||data.restricted)return;working.current=true;setBusy(true);setMessage(null);
  try{const result=await ports.confirm({fileId,clientEventId:confirmKey.current});if(result.code!=='OK'){setMessage(result.message);return;}
   const read=await ports.capture(data.itemId);if(read.code!=='OK'){setMessage(read.message);return;}setCapture(read.capture);
   const text='Am Original geprüft · Vorschläge bestätigt';setMessage(text);onMessage(text);
  }catch(error){console.error('[ORIGINAL_DIALOG_CONFIRM_FAILED]',error);setMessage('Prüfung nicht gespeichert · Fehlercode: ORIGINAL_DIALOG_CONFIRM_FAILED.');}
  finally{working.current=false;setBusy(false);}
 };
 const retry=async()=>{
  if(working.current||!data||data.restricted)return;working.current=true;setBusy(true);setMessage(null);
  try{const result=await ports.retry({fileId,clientEventId:retryKey.current});if(result.code!=='OK'){setMessage(result.message);return;}setCapture(result.capture);retryKey.current=crypto.randomUUID();setMessage('Wird erneut gelesen');}
  catch(error){console.error('[ORIGINAL_DIALOG_RETRY_FAILED]',error);setMessage('Erkennung nicht erreichbar · Fehlercode: ORIGINAL_DIALOG_RETRY_FAILED.');}
  finally{working.current=false;setBusy(false);}
 };
 const suggestions=capture?.suggestions?.filter(s=>s.fileId===fileId&&s.status==='offen')??[];
 const needsCheck=suggestions.some(s=>s.confidence==='unsicher'&&!s.verifiedAt);
 const assigned=Boolean(data?.customerId||data?.orderId);
 return <Dialog titel="Original" icon="file" groesse="breit" schliessenSpecId="original.schliessen" onSchliessen={onClose} fuss={<>
  <Button text="Schließen" onClick={onClose}/>
  {data?.downloadUrl&&!failure?.blocked?<a className="kr-btn" data-spec-id="original.herunterladen" href={data.downloadUrl} download={data.name} target="_blank" rel="noreferrer">Herunterladen</a>:null}
  {data&&!data.restricted&&!failure?.blocked?<Button data-spec-id="original.erneut-lesen" icon="refresh" text="Erneut lesen" disabled={busy} onClick={()=>void retry()}/>:null}
  {data&&!data.restricted&&!failure?.blocked?<Button data-spec-id={assigned?'original.umhaengen':'original.wem-gehoert'} art={assigned?'sekundaer':'erledigen'} text={assigned?'Umhängen':'Wem gehört das?'} onClick={()=>setMessage(onAssign(data.itemId,assigned))}/>:null}
 </>}>
 <div data-spec-id="original" className="kr-stapel">
  {loading?<p role="status">Original wird geladen …</p>:null}
  {failure?<div data-spec-id={failure.blocked?'original.zustand.gesperrt':'original.zustand.fehler'}><Hinweis ton="warn">{failure.blocked?'Nicht geöffnet':'Original nicht ladbar'} · {failure.message}</Hinweis>{!failure.blocked?<Button text="Erneut" data-spec-id="original.erneut" onClick={()=>void load()}/>:null}</div>:null}
  {data?<><div className="kr-form"><Kachel titel="Datei" icon="photo"><strong>{data.name}</strong><p>unverändert · {new Intl.NumberFormat('de-DE',{maximumFractionDigits:1}).format(data.bytes/1024)} KB</p>
    {data.restricted?<Hinweis>Mail · Inhalt nur fürs Büro</Hinweis>:data.url&&data.previewable?data.mime.startsWith('image/')?<Image src={data.url} alt={data.name} width={1200} height={900} unoptimized style={{maxWidth:'100%',height:'auto',objectFit:'contain'}}/>:<iframe title={data.name} src={data.url} style={{width:'100%',height:'45vh',border:0}}/>:null}
    {!data.restricted&&capture?.text?<pre style={{whiteSpace:'pre-wrap',overflowWrap:'anywhere'}}>{capture.text}</pre>:null}
   </Kachel><Kachel titel="Erkannt" icon="scan">{suggestions.length?suggestions.map(s=><div key={s.id}><b>{s.field}: {typeof s.value==='string'?s.value:JSON.stringify(s.value)}</b><p>{s.verifiedAt?'geprüft':s.confidence==='unsicher'?'bitte prüfen':s.confidence==='sicher'?'sicher':'Vorschlag'} · {s.source?JSON.stringify(s.source):'Fundstelle fehlt'}</p></div>):<p>{data.restricted?'Mail · Inhalt nur fürs Büro':'Keine Vorschläge'}</p>}
    {needsCheck&&!data.restricted?<Button data-spec-id="original.am-original-geprueft" text="Am Original geprüft" icon="check" art="erledigen" disabled={busy} onClick={()=>void confirm()}/>:null}
   </Kachel></div><dl className="kr-fakten"><div><dt>Herkunft</dt><dd>{data.name}</dd></div><div><dt>Prüfsumme</dt><dd>SHA-256 {data.sha256}</dd></div><div><dt>Zuordnung</dt><dd>{data.orderId?`Auftrag ${data.orderId}`:data.customerId?`Kunde ${data.customerId}`:'nicht zugeordnet'}</dd></div></dl></>:null}
  {message?<div role="status"><Hinweis>{message}</Hinweis></div>:null}
 </div></Dialog>;
}
