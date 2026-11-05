"use client";
import{useCallback,useEffect,useRef,useState}from'react';
import{Button,Dialog,Hinweis}from'@/ui/kr';
import{uploadIntakeOriginal}from'../intakeOriginalUpload';
import{getIntakeDeviceId}from'../deviceContract';
import{goodsReceiptGaps,goodsReceiptWare,type GoodsReceiptInput,type GoodsReceiptRecord,type GoodsReceiptReadResult,type GoodsReceiptFailure}from'../goodsReceiptContract';
import type{IntakeFileGrant,IntakeFileInput,IntakeCaptureResult}from'../captureContract';
import{GoodsInspectionForm}from'./GoodsInspectionForm';
import{retainPendingOriginal,readPendingOriginals,acknowledgePendingOriginal}from'../pendingOriginals';

type SaveResult={code:'OK';receipt:GoodsReceiptRecord;replayed:boolean}|GoodsReceiptFailure;
export type GoodsReceiptPorts={scope:()=>Promise<{code:'OK';scope:string}|GoodsReceiptFailure>;read:(orderId:string)=>Promise<GoodsReceiptReadResult>;save:(input:GoodsReceiptInput)=>Promise<SaveResult>;prepareFile:(input:IntakeFileInput)=>Promise<IntakeFileGrant>;finishFile:(id:string)=>Promise<IntakeCaptureResult>};
type Data=Extract<GoodsReceiptReadResult,{code:'OK'}>;
function restore(data:Data,sourceId?:string,receiptId?:string):GoodsReceiptInput{
 const saved=receiptId?data.receipts.find(r=>r.id===receiptId&&r.status==='entwurf'):[...data.receipts].reverse().find(r=>r.status==='entwurf');
 return saved?{id:saved.id,clientKey:saved.client_key,clientEventId:crypto.randomUUID(),itemId:saved.item_id,orderId:data.order.id,expectedOrderVersion:data.order.version,expectedVersion:saved.version,
  mode:saved.modus,command:'draft',card:saved.karte,packagesReceived:saved.packstuecke_da,packagesTotal:saved.packstuecke_gesamt,condition:saved.zustand,deviations:saved.abweichung,foundUnattended:saved.abgestellt,foundAt:saved.fund_zeit,procedure:saved.verfahren_wie_kv,procedureNote:saved.verfahren_abweichung,photos:saved.fotos,
  quantities:saved.mengen.map(q=>({itemId:q.teil_id,expected:q.erwartet,received:q.geaendert?q.bestaetigt:null,confirmed:!q.geaendert&&q.bestaetigt!==null,note:q.hinweis}))}
 :{id:crypto.randomUUID(),clientKey:crypto.randomUUID(),clientEventId:crypto.randomUUID(),itemId:sourceId??null,orderId:data.order.id,expectedOrderVersion:data.order.version,expectedVersion:0,mode:'erwartet',command:'draft',card:1,
  packagesReceived:1,packagesTotal:1,condition:null,deviations:[],foundUnattended:false,foundAt:null,procedure:null,procedureNote:null,photos:[],quantities:data.order.items.map(q=>({itemId:q.id,expected:q.quantity,received:null,confirmed:false,note:null}))};
}
export function GoodsReceiptDialog({orderId,sourceId,ports,onClose,onOriginal,onMessage}:{orderId:string;sourceId?:string;ports:GoodsReceiptPorts;onClose:()=>void;onOriginal:(itemId:string,fileId:string)=>void;onMessage:(message:string)=>void}){
 const[data,setData]=useState<Data|null>(null),[input,setInput]=useState<GoodsReceiptInput|null>(null),[error,setError]=useState<string|null>(null),[busy,setBusy]=useState(false),[loading,setLoading]=useState(true);
 const[pendingCommand,setPendingCommand]=useState<GoodsReceiptInput['command']|null>(null),[remainingUploads,setRemainingUploads]=useState(0);
 const current=useRef<GoodsReceiptInput|null>(null),version=useRef(0),orderVersion=useRef(0),queue=useRef(Promise.resolve(true)),timer=useRef<ReturnType<typeof setTimeout>|null>(null),submitting=useRef(false),dirty=useRef(false),uploaded=useRef(new Map<string,{file:File;fileId:string;itemId:string;kind:GoodsReceiptInput['photos'][number]['kind']}>());
 const pending=useRef<GoodsReceiptInput|null>(null),pendingSource=useRef<GoodsReceiptInput|null>(null);
 const closeAfterUpload=useRef(false);
 const scope=useRef<string|null>(null),persistedPhotos=useRef(new Set<string>()),resumeUploads=useRef<()=>void>(()=>{});
 const load=useCallback(async()=>{
  setLoading(true);setError(null);
  try{const result=await ports.read(orderId);if(result.code!=='OK'){setError(result.message);return;}
   const local=await ports.scope();if(local.code!=='OK')throw Error(local.message);scope.current=local.scope;
   const files=(await readPendingOriginals(local.scope)).filter(original=>original.kind==='file'&&original.context?.orderId===orderId);
   const context=files[0]?.kind==='file'?files[0].context:undefined;
   const next=restore(result,sourceId,context?.receiptId);
   if(context&&!result.receipts.some(r=>r.id===context.receiptId)){next.id=context.receiptId;next.clientKey=context.clientKey;}
   if(files.length){next.itemId=files[0].itemId;for(const original of files)if(original.kind==='file'&&original.context)uploaded.current.set(original.id,{file:original.file,fileId:original.id,itemId:original.itemId,kind:original.context.photoKind});setRemainingUploads(uploaded.current.size);setTimeout(()=>resumeUploads.current(),0);}
   persistedPhotos.current=new Set(next.photos.map(photo=>photo.fileId));
   setData(result);setInput(next);current.current=next;version.current=next.expectedVersion;orderVersion.current=next.expectedOrderVersion;}
  catch(cause){console.error('[GOODS_DIALOG_READ_FAILED]',cause);setError('Warenprüfung nicht verfügbar · Fehlercode: GOODS_DIALOG_READ_FAILED.');}finally{setLoading(false);}
 },[orderId,sourceId,ports]);
 useEffect(()=>{const start=setTimeout(()=>void load(),0);return()=>{clearTimeout(start);if(timer.current)clearTimeout(timer.current);};},[load]);
 const persist=(command:GoodsReceiptInput['command'])=>{
  if(timer.current){clearTimeout(timer.current);timer.current=null;}
  const requested=current.current;if(!requested)return Promise.resolve(false);
  const run=async():Promise<boolean>=>{
   const payload=pending.current??{...requested,command,clientEventId:crypto.randomUUID(),expectedVersion:version.current,expectedOrderVersion:orderVersion.current};
   if(!pending.current)pendingSource.current=requested;
   pending.current=payload;
   setPendingCommand(payload.command);
   try{const result=await ports.save(payload);if(result.code!=='OK'){setError('Nicht gespeichert · alle Eingaben sind noch da · '+result.message);return false;}
    version.current=result.receipt.version;
    persistedPhotos.current=new Set(result.receipt.fotos.map(photo=>photo.fileId));
    setError(null);if(current.current===pendingSource.current)dirty.current=false;
    if(payload.command==='draft'){
     const previousSource=pendingSource.current;pending.current=null;pendingSource.current=null;setPendingCommand(null);
     if(previousSource!==requested||command!=='draft')return run();
    }
    return true;
   }catch(cause){console.error('[GOODS_DIALOG_WRITE_FAILED]',cause);setError('Nicht gespeichert · alle Eingaben sind noch da · Fehlercode: GOODS_DIALOG_WRITE_FAILED.');return false;}
  };
  queue.current=queue.current.then(run,run);return queue.current;
 };
 const change=(next:GoodsReceiptInput)=>{
  if(submitting.current)return;if(pending.current&&pending.current.command!=='draft'){setError('Annahme noch nicht sicher bestätigt · zuerst Erneut wählen. Alle Eingaben bleiben erhalten.');return;}current.current=next;setInput(next);dirty.current=true;
  if(timer.current)clearTimeout(timer.current);timer.current=setTimeout(()=>void persist('draft'),300);
 };
 const close=async()=>{
  if(submitting.current){if(uploaded.current.size)closeAfterUpload.current=true;return;}
  if(pending.current&&pending.current.command!=='draft'){setError('Annahme noch nicht sicher bestätigt · zuerst Erneut wählen. Alle Eingaben bleiben erhalten.');return;}
  if(!dirty.current&&!pending.current){await queue.current;onClose();return;}
  submitting.current=true;setBusy(true);
  try{if(await persist('draft'))onClose();}finally{submitting.current=false;setBusy(false);}
 };
 const upload=async()=>{
  if(submitting.current||!current.current||!uploaded.current.size)return;
  submitting.current=true;setBusy(true);setError(null);
  try{for(const [key,task]of uploaded.current){
    const partition=scope.current;if(!partition)throw Error('GOODS_PENDING_SCOPE_UNAVAILABLE');
    if(persistedPhotos.current.has(task.fileId)){await acknowledgePendingOriginal(partition,task.fileId);uploaded.current.delete(key);setRemainingUploads(uploaded.current.size);continue;}
    const draft=current.current;if(!draft)throw Error('GOODS_PHOTO_CONTEXT_LOST');
    await retainPendingOriginal(partition,{id:task.fileId,itemId:task.itemId,kind:'file',file:task.file,captureOrigin:'warenfoto',context:{orderId,receiptId:draft.id,clientKey:draft.clientKey,photoKind:task.kind}});
    const hash=Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',await task.file.arrayBuffer())),byte=>byte.toString(16).padStart(2,'0')).join('');
    const grant=await ports.prepareFile({itemId:task.itemId,fileId:task.fileId,name:task.file.name,mime:task.file.type,bytes:task.file.size,sha256:hash,deviceId:getIntakeDeviceId(),captureOrigin:'warenfoto'});
    if(grant.code!=='OK')throw Error(grant.message);
    if(grant.upload){const sent=await uploadIntakeOriginal(grant.upload,task.file);if(!sent.ok)throw Error('GOODS_PHOTO_UPLOAD_NOT_ACKNOWLEDGED');}
    const finished=await ports.finishFile(task.fileId);if(finished.code!=='OK')throw Error(finished.message);
    const before=current.current;if(!before)throw Error('GOODS_PHOTO_CONTEXT_LOST');
    const next:GoodsReceiptInput={...before,itemId:task.itemId,photos:[...before.photos.filter(photo=>photo.fileId!==task.fileId),{fileId:task.fileId,kind:task.kind}]};
    current.current=next;setInput(next);dirty.current=true;
    if(!await persist('draft'))throw Error('GOODS_PHOTO_ASSOCIATION_NOT_ACKNOWLEDGED');
    await acknowledgePendingOriginal(partition,task.fileId);uploaded.current.delete(key);setRemainingUploads(uploaded.current.size);
   }
  }catch(cause){console.error('[GOODS_DIALOG_PHOTO_FAILED]',cause);setError('Foto nicht vollständig gesichert · Erneut übertragen · '+(cause instanceof Error?cause.message:'GOODS_DIALOG_PHOTO_FAILED'));}
  finally{submitting.current=false;setBusy(false);if(closeAfterUpload.current){closeAfterUpload.current=false;queueMicrotask(()=>void close());}}
 };
 const addFiles=(kind:GoodsReceiptInput['photos'][number]['kind'],files:FileList|null)=>{
  if(!files||!current.current)return;const itemId=current.current.itemId??crypto.randomUUID();
  for(const file of files){const key=crypto.randomUUID();uploaded.current.set(key,{file,fileId:key,itemId,kind});}
  setRemainingUploads(uploaded.current.size);
  void upload();
 };
 useEffect(()=>{
  resumeUploads.current=()=>void upload();
  const resume=()=>{if(uploaded.current.size)void upload();};
  const leaving=(event:BeforeUnloadEvent)=>{if(dirty.current||pending.current||uploaded.current.size){event.preventDefault();event.returnValue='';}};
  window.addEventListener('online',resume);window.addEventListener('beforeunload',leaving);
  return()=>{window.removeEventListener('online',resume);window.removeEventListener('beforeunload',leaving);};
 });
 const focusGap=(first:string)=>{
  const value=current.current;if(!value)return;
  const card=first.includes('Foto')||first.includes('Abweichung')?1:first==='Zustand'?2:3;
  change({...value,card});
  const selector=first==='Zustand'?'[data-spec-id="ware.warenzustand"] button':first==='Abweichungsgrund'?'[data-spec-id="ware.grund"] button':first.includes('Abweichung')?'[data-spec-id="ware.foto.abweichung"]':first.includes('Foto')?'[data-spec-id="ware.foto.paket"]':first==='Packstücke'?'[data-spec-id="ware.packstuecke-plus"]':first==='Verfahren/Termin wie im KV'?'[data-spec-id="ware.verfahren"] button':'[data-spec-id="ware.position.stimmt"]';
  requestAnimationFrame(()=>{const field=document.querySelector<HTMLElement>(selector);field?.scrollIntoView({block:'nearest'});field?.focus();});
 };
 const accept=async(primary:boolean)=>{
  if(submitting.current||!data||!current.current)return;const value=current.current;
  const gaps=primary&&data.canStartGalvanik?goodsReceiptGaps(value,data.order.fromQuote):value.condition?[]:['Zustand'];
  if(gaps.length){focusGap(gaps[0]);setError('Noch offen: '+gaps[0]);return;}
  submitting.current=true;setBusy(true);
  try{const derived=goodsReceiptWare(value),packaging=value.condition==='abweichung'&&derived==='da';
   const command=primary&&data.canStartGalvanik&&(value.condition!=='abweichung'||packaging)?'galvanik':'accept';
   if(!await persist(command))return;
   const read=await ports.read(orderId);if(read.code!=='OK'){setError(read.message);return;}const stored=read.receipts.find(receipt=>receipt.id===value.id);
   if(!stored||stored.status==='entwurf'){setError('Warenannahme konnte nicht sicher erneut gelesen werden. Code: GOODS_RECEIPT_READBACK_FAILED.');return;}
   onMessage(`Ware ${read.order.number??read.order.id} angenommen · ${stored.status==='galvanik'?'in Galvanik':'Wareneingang'}`);onClose();
  }catch(cause){console.error('[GOODS_DIALOG_ACCEPT_READBACK_FAILED]',cause);setError('Nicht gespeichert oder noch nicht sicher bestätigt · alle Eingaben sind noch da · Fehlercode: GOODS_DIALOG_ACCEPT_READBACK_FAILED.');}
  finally{submitting.current=false;setBusy(false);}
 };
 const ware=input?goodsReceiptWare(input):null;
 const label=!data?.canStartGalvanik?'Ware annehmen':input?.condition==='teillieferung'?'Teillieferung · in Galvanik':ware==='abweichung'?'Mit Abweichung annehmen':'Annehmen · in Galvanik';
 return <Dialog titel="Ware annehmen" icon="box" groesse="breit" schliessenSpecId="ware.schliessen" onSchliessen={()=>void close()} vorSchliessen={()=>{void close();return false;}} fuss={<>
   <Button data-spec-id="ware.abbrechen" text="Abbrechen" onClick={()=>void close()}/>
   {data?.canStartGalvanik&&input?.condition==='teillieferung'?<Button data-spec-id="ware.teil-warten" text="Teillieferung · auf Rest warten" disabled={busy} onClick={()=>void accept(false)}/>:data?.canStartGalvanik&&ware!=='abweichung'?<Button data-spec-id="ware.nur-annehmen" text="Nur annehmen" disabled={busy} onClick={()=>void accept(false)}/>:null}
   <Button data-spec-id="ware.annehmen" art="erledigen" icon="check" text={busy?remainingUploads?'Foto wird gesichert …':pendingCommand&&pendingCommand!=='draft'?'Wird angenommen …':'Wird gespeichert …':label} onClick={()=>void accept(true)}/>
 </>}><div data-spec-id="ware" className="kr-stapel">
  {loading?<p role="status">Warenprüfung wird geladen …</p>:null}
  {data&&input?<><div className="kr-kontext"><strong>{data.order.number??'Auftragsnummer fehlt'} · {data.order.customerName??'Kunde fehlt'} · {data.order.title??'Bezeichnung fehlt'}</strong></div>
   <dl className="kr-fakten"><div><dt>Erwartet</dt><dd>{data.order.ware} · {data.order.fromQuote?'aus KV':'direkt beauftragt'}</dd></div><div><dt>Positionen</dt><dd>{data.order.items.length}</dd></div></dl>
   <GoodsInspectionForm value={input} order={data.order} busy={busy} onChange={change} onFile={addFiles} onOriginal={fileId=>{if(input.itemId)onOriginal(input.itemId,fileId);}}/>
  </>:null}
  {error?<div role="alert" data-spec-id={error.startsWith('Noch offen:')?'ware.zustand.teilweise':'ware.zustand.fehler'}><Hinweis ton="warn">{error}</Hinweis>{data?<>{pendingCommand?<Button text="Erneut" data-spec-id="ware.erneut" disabled={busy} onClick={()=>void (pendingCommand==='draft'?persist('draft'):accept(pendingCommand==='galvanik'))}/>:null}{error.startsWith('Noch offen:')?<Button text="Zur Lücke" data-spec-id="ware.zur-luecke" onClick={()=>{focusGap(error.slice('Noch offen: '.length));setError(null);}}/>:null}</>:<Button text="Erneut laden" onClick={()=>void load()}/>}</div>:null}
  {remainingUploads&&!busy?<Button text="Erneut übertragen" onClick={()=>void upload()}/>:null}
 </div></Dialog>;
}
