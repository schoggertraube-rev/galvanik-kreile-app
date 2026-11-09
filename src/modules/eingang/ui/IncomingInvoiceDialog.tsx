'use client';
import {BELEG_AUTO_COPY as C,belegFailureCopy} from '@/ui/situationCatalog';
import {useEffect,useRef,useState} from 'react';
import {Button,Checkbox,Dialog,Eingabe,Feld,Hinweis,Kachel,Rueckfrage,Segment,Textfeld,Zustandskette} from '@/ui/kr';
import {invoiceDate,invoiceFieldErrors,invoiceWarnings,type InvoiceFields,type InvoicePorts,type InvoiceSupplier,type InvoiceView} from '../invoiceContract';
import {INTAKE_CHANGED_EVENT} from '../messageContract';
import {uploadIntakeOriginal} from '../intakeOriginalUpload';

type Mode='rueckgaengig'|'neu_ablegen'|'pruefen'|'bezahlt'|'unklar'|'klaeren'|'bezahlt_markieren'|'ansicht';
type Outcome='offen'|'bezahlt'|'doppelt'|'ungueltig';
function dateLabel(value:string){return invoiceDate(value)?new Intl.DateTimeFormat('de-DE',{weekday:'short',day:'2-digit',month:'2-digit',timeZone:'Europe/Berlin'}).format(new Date(value+'T12:00:00Z')).replace(/^(\p{L}+)\.,?\s/u,'$1 '):'';}
function today(){return new Intl.DateTimeFormat('sv-SE',{timeZone:'Europe/Berlin'}).format(new Date());}
const fieldRows=[['nummer','rechnungsnummer','Rechnungsnummer','text'],['datum','rechnungsdatum','Rechnungsdatum','date'],['netto','netto','Netto','text'],['ust','ust','USt','text'],['brutto','brutto','Brutto','text'],['faelligAm','faellig','Fällig am','date'],['iban','iban','IBAN','text']] as const;

/** 3.8 is a projection of the canonical intake/original and its one supplier_invoice. */
export function IncomingInvoiceDialog({initial,ports,onClose,onMessage,onAutomaticReady}:{initial:InvoiceView;ports:InvoicePorts;onClose:()=>void;onMessage:(text:string,taskId?:string)=>void;onAutomaticReady?:()=>void}){
 const [view,setView]=useState(initial),[fields,setFields]=useState({...initial.fields}),[selected,setSelected]=useState<InvoiceSupplier|null>(initial.supplier);
 const currentFields=useRef(fields);useEffect(()=>{currentFields.current=fields;},[fields]);
 const [mode,setMode]=useState<Mode>(initial.canRebook?'neu_ablegen':initial.invoice?.zahlstatus==='unklar'?'klaeren':initial.invoice?.zahlstatus==='offen'?'bezahlt_markieren':initial.invoice?'ansicht':'pruefen');
 const [supplierQuery,setSupplierQuery]=useState(initial.supplier?.name??''),[suppliers,setSuppliers]=useState<InvoiceSupplier[]>([]),[searching,setSearching]=useState(false);
 const [initialPaidDate]=useState(today),[paidDate,setPaidDate]=useState(initialPaidDate),[reason,setReason]=useState(''),[outcome,setOutcome]=useState<Outcome|' '>(' '),[correct,setCorrect]=useState(false);
 const [duplicate,setDuplicate]=useState<InvoiceView['duplicate']>(null),[duplicateReason,setDuplicateReason]=useState(''),[errors,setErrors]=useState<Record<string,string>>({});
 const [proofFileId,setProofFileId]=useState<string|null>(initial.invoice?.nachweis_file_id??null),[proofName,setProofName]=useState(''),[uploading,setUploading]=useState(false),[proofRetry,setProofRetry]=useState(false),proofInput=useRef<HTMLInputElement>(null);
 const pendingProof=useRef<{file:File;id:string;sha256:string}|null>(null);
 const [message,setMessage]=useState<string|null>(null),[retry,setRetry]=useState(false),[busy,setBusy]=useState(false),[discard,setDiscard]=useState(false),[uncertain,setUncertain]=useState(initial.uncertain);
 const working=useRef(false),key=useRef(crypto.randomUUID()),root=useRef<HTMLDivElement>(null);
 const changed=JSON.stringify(fields)!==JSON.stringify(initial.fields)||proofRetry||proofFileId!==(initial.invoice?.nachweis_file_id??null)||paidDate!==initialPaidDate||reason!==''||duplicateReason!==''||mode==='bezahlt'||correct||outcome!==' ';
 const close=()=>{if(working.current)return;if(changed)setDiscard(true);else onClose();};
 useEffect(()=>{
  if(supplierQuery.trim().length<2||selected&&supplierQuery===selected.name)return;
  let active=true;const timer=setTimeout(async()=>{
   setSearching(true);
   try{const result=await ports.searchSuppliers(supplierQuery);if(!active)return;if(result.code==='OK')setSuppliers(result.suppliers);else setMessage(belegFailureCopy(result.code));}
   catch(error){console.error('[INVOICE_SUPPLIER_SEARCH_CLIENT_FAILED]',error);if(active)setMessage('Lieferantensuche fehlgeschlagen · Fehlercode: INVOICE_SUPPLIER_SEARCH_CLIENT_FAILED.');}
   finally{if(active)setSearching(false);}
  },250);return()=>{active=false;clearTimeout(timer);};
 },[supplierQuery,selected,ports]);
 useEffect(()=>{
  const refresh=async(event:Event)=>{try{const detail=(event as CustomEvent<{itemId?:string;customerId?:string;customerName?:string}>).detail;const result=await ports.read({id:initial.item.id});if(result.code!=='OK'){setMessage(belegFailureCopy(result.code));return;}
   setView(result.view);setUncertain(result.view.uncertain);setSelected(result.view.supplier);setSupplierQuery(result.view.supplier?.name??'');setFields(current=>({...current,lieferantId:result.view.supplier?.id??current.lieferantId}));
   if(detail?.itemId===initial.item.id&&detail.customerId===result.view.supplier?.id&&!result.view.invoice&&result.view.automation?.state==='ready'&&(Object.keys(result.view.fields) as Array<keyof InvoiceFields>).every(key=>key==='lieferantId'||currentFields.current[key]===result.view.fields[key]))onAutomaticReady?.();
   if(detail?.itemId===initial.item.id&&detail.customerId&&detail.customerName&&result.view.invoice&&!result.view.invoice.lieferant_id){const found=await ports.searchSuppliers(detail.customerName);if(found.code==='OK'){const supplier=found.suppliers.find(value=>value.id===detail.customerId);if(supplier){setSelected(supplier);setSupplierQuery(supplier.name);setFields(current=>({...current,lieferantId:supplier.id}));setCorrect(true);setOutcome('offen');}}}
  }catch(error){console.error('[INVOICE_RETURN_READ_FAILED]',error);setMessage('Lieferant konnte nicht neu gelesen werden · Fehlercode: INVOICE_RETURN_READ_FAILED.');}};
  window.addEventListener(INTAKE_CHANGED_EVENT,refresh);return()=>window.removeEventListener(INTAKE_CHANGED_EVENT,refresh);
 },[initial.item.id,ports,onAutomaticReady]);
 const chooseSupplier=(supplier:InvoiceSupplier)=>{if(view.invoice&&!view.invoice.lieferant_id){setCorrect(true);setOutcome('offen');}setSelected(supplier);setSupplierQuery(supplier.name);setSuppliers([]);setFields(current=>{
  const next={...current,lieferantId:supplier.id};if(!next.faelligAm&&invoiceDate(next.datum)&&supplier.paymentTermDays!==null){const date=new Date(next.datum+'T12:00:00Z');date.setUTCDate(date.getUTCDate()+supplier.paymentTermDays);next.faelligAm=date.toISOString().slice(0,10);}return next;
 });};
 const update=(field:keyof InvoiceFields,value:string)=>{if(working.current)return;setFields(current=>{
  const next={...current,[field]:value};
  if(field==='datum'&&selected?.paymentTermDays!==null&&selected?.paymentTermDays!==undefined&&invoiceDate(value)&&!current.faelligAm){const date=new Date(value+'T12:00:00Z');date.setUTCDate(date.getUTCDate()+selected.paymentTermDays);next.faelligAm=date.toISOString().slice(0,10);}return next;
 });setErrors(current=>({...current,[field]:''}));};
 const focusError=(values:Record<string,string>)=>{const first=Object.keys(values)[0];const node=root.current?.querySelector<HTMLElement>('[data-invoice-field="'+first+'"]');node?.focus();node?.scrollIntoView({block:'center'});};
 const uploadProof=async(file?:File)=>{
  if(working.current)return;working.current=true;setBusy(true);setUploading(true);setMessage(null);setProofRetry(false);
  try{
   if(file){if(file.size<1||file.size>150*1024*1024)throw Error('INVOICE_PROOF_SIZE_INVALID');const digest=await crypto.subtle.digest('SHA-256',await file.arrayBuffer());pendingProof.current={file,id:crypto.randomUUID(),sha256:[...new Uint8Array(digest)].map(value=>value.toString(16).padStart(2,'0')).join('')};}
   const pending=pendingProof.current;if(!pending)throw Error('INVOICE_PROOF_MISSING');
   const grant=await ports.prepareFile({itemId:view.item.id,fileId:pending.id,name:pending.file.name,mime:pending.file.type||'application/octet-stream',bytes:pending.file.size,sha256:pending.sha256});
   if(grant.code!=='OK'){setMessage(grant.message);setProofRetry(true);return;}
   if(grant.upload)await uploadIntakeOriginal(grant.upload,pending.file);
   const finished=await ports.finishFile(pending.id);if(finished.code!=='OK'){setMessage(finished.message);setProofRetry(true);return;}
   setProofFileId(pending.id);setProofName(pending.file.name);setView(current=>({...current,item:{...current.item,version:finished.capture.version}}));pendingProof.current=null;
  }catch(error){console.error('[INVOICE_PROOF_UPLOAD_FAILED]',{code:error instanceof Error?error.name:'INVOICE_PROOF_UPLOAD_FAILED'});setMessage('Nachweis nicht sicher gespeichert · Eingaben bleiben erhalten · Fehlercode: INVOICE_PROOF_UPLOAD_FAILED.');setProofRetry(true);}
  finally{working.current=false;setBusy(false);setUploading(false);}
 };
 const save=async(status:Outcome|'unklar')=>{
  if(working.current)return;
  const validation=invoiceFieldErrors(fields,status==='unklar'||status==='ungueltig');
  if(!view.invoice&&status==='offen'&&!fields.lieferantId)delete validation.lieferantId;
  if(status==='unklar'&&(reason.trim().length<3||reason.length>200))validation.reason='Grund fehlt · 3 bis 200 Zeichen';
  if(status==='bezahlt'&&(!invoiceDate(paidDate)||paidDate>today()))validation.paidDate='Bezahlt am fehlt oder liegt in der Zukunft';
  if(mode==='klaeren'&&outcome===' ')validation.outcome='Ergebnis fehlt';
  if(status==='ungueltig'&&(reason.trim().length<3||reason.length>200))validation.reason='Grund fehlt · 3 bis 200 Zeichen';
  if(status==='doppelt'&&!duplicate&&!view.duplicate)validation.duplicate='Verweis auf vorhandene Rechnung fehlt';
  if(Object.keys(validation).length){setErrors(validation);setMessage('Pflichtangaben prüfen.');focusError(validation);return;}
  if(!view.fileId){setMessage('Gesichertes Original fehlt.');return;}
  working.current=true;setBusy(true);setMessage(null);setRetry(false);
  try{
   const invoice=view.invoice;
   const result=invoice?await (mode==='klaeren'?ports.clarify:ports.status)({invoiceId:invoice.id,version:invoice.version,clientKey:key.current,result:status as Outcome,
    paidDate:status==='bezahlt'?paidDate:null,proofFileId:status==='bezahlt'?proofFileId:null,duplicateId:status==='doppelt'?(duplicate??view.duplicate)?.id??null:null,reason:reason.trim()||null,fields:mode==='neu_ablegen'||mode==='klaeren'&&correct?fields:null,...(mode==='rueckgaengig'?{command:'undo' as const}:mode==='neu_ablegen'?{command:'rebook' as const}:{})})
    :await ports.save({...((status==='doppelt')?{attachOriginal:true as const}:{}),itemId:view.item.id,fileId:view.fileId,version:view.item.version,clientKey:key.current,fields,status:status as Exclude<typeof status,'ungueltig'>,
     paidDate:status==='bezahlt'?paidDate:null,proofFileId:status==='bezahlt'?proofFileId:null,duplicateId:status==='doppelt'?duplicate?.id??null:null,duplicateReason:duplicateReason.trim()||null,unclearReason:status==='unklar'?reason.trim():null});
   if(result.code==='DUPLICATE'){setDuplicate(result.duplicate);return;}
   if(result.code!=='OK'){setErrors(result.fields??{});setMessage(belegFailureCopy(result.code));setRetry(true);return;}
   const text=mode==='rueckgaengig'?C.undone:mode==='neu_ablegen'?C.rebooked:result.invoice.unklar_grund==='Lieferant fehlt'?'Lieferant fehlt · Aufgabe angelegt':mode==='klaeren'?'Rechnung geklärt · '+status:mode==='bezahlt_markieren'?'Als bezahlt markiert':status==='doppelt'?'Als doppelt abgelegt · Eingang erledigt':status==='unklar'?'Eingangsrechnung unklar · Aufgabe für Recht Geld':status==='bezahlt'?'Eingangsrechnung erfasst · bezahlt':'Eingangsrechnung erfasst · fällig '+dateLabel(result.invoice.faellig_am??'');
   onMessage(text,result.invoice.aufgabe_id??undefined);onClose();window.dispatchEvent(new Event(INTAKE_CHANGED_EVENT));
  }catch(error){console.error('[INCOMING_INVOICE_SAVE_CLIENT_FAILED]',error);setMessage('Nicht gespeichert · alle Eingaben sind noch da · Fehlercode: INCOMING_INVOICE_SAVE_CLIENT_FAILED.');setRetry(true);}
  finally{working.current=false;setBusy(false);}
 };
 const missingSupplier=!!view.invoice&&!view.invoice.lieferant_id&&view.invoice.unklar_grund==='Lieferant fehlt';
 const readOnly=mode==='rueckgaengig'||mode==='ansicht'||mode==='bezahlt_markieren'||mode==='klaeren'&&!correct&&!missingSupplier;
 const warnings=invoiceWarnings(fields,selected),due=dateLabel(fields.faelligAm),primaryLabel=mode==='rueckgaengig'?C.undoConfirm:mode==='neu_ablegen'?C.rebook:uploading?'Nachweis wird gesichert …':busy?'Wird erfasst …':mode==='klaeren'?'Klärung speichern':mode==='bezahlt_markieren'?'Als bezahlt markieren':mode==='unklar'?'Als unklar erfassen':mode==='bezahlt'?'Erfassen · bezahlt':due?'Erfassen · fällig '+due:'Erfassen';
 const primaryId=mode==='klaeren'?'klaerung-speichern':mode==='bezahlt_markieren'?'als-bezahlt':mode==='unklar'?'unklar-speichern':mode==='bezahlt'?'bezahlt-speichern':'offen';
 const primary=()=>void save(mode==='rueckgaengig'?'ungueltig':mode==='klaeren'?(outcome===' '?'offen':outcome):mode==='bezahlt'||mode==='bezahlt_markieren'?'bezahlt':mode==='unklar'?'unklar':'offen');
 return <><Dialog titel="Rechnung prüfen" icon="file" groesse="breit" schliessenSpecId="rechnungein.schliessen" onSchliessen={close} vorSchliessen={()=>!working.current}
  unterzeile={mode==='klaeren'?'Rechnung klären':mode==='bezahlt_markieren'?'Eingangsrechnung · als bezahlt markieren':undefined}
  meldung={message?{text:message,ton:'fehler'}:null}
  fuss={<><Button data-spec-id={mode==='klaeren'?'rechnungein.klaeren-abbrechen':'rechnungein.abbrechen'} text={mode==='ansicht'?'Schließen':'Abbrechen'} onClick={close} disabled={busy}/>
   {view.canUndo&&mode!=='rueckgaengig'?<Button text={C.undo} disabled={busy} onClick={()=>{setMode('rueckgaengig');setReason('');}}/>:null}
   {mode==='rueckgaengig'?<Button text={C.back} disabled={busy} onClick={()=>{setMode('bezahlt_markieren');setReason('');}}/>:null}
   {mode==='pruefen'&&!duplicate?<><Button data-spec-id="rechnungein.unklar" icon="alert" text="Unklar – klären" onClick={()=>setMode('unklar')}/><Button data-spec-id="rechnungein.ist-bezahlt" icon="check" text="Ist schon bezahlt" onClick={()=>setMode('bezahlt')}/></>:null}
   {(mode==='unklar'||mode==='bezahlt')&&!duplicate?<Button data-spec-id="rechnungein.zurueck-daten" text="Zurück" onClick={()=>setMode('pruefen')}/>:null}
   {duplicate?<><Button data-spec-id="rechnungein.doppelt-ablegen" text="Als doppelt ablegen" art="erledigen" disabled={busy} onClick={()=>void save('doppelt')}/>{!duplicate.exact?<Button data-spec-id="rechnungein.trotzdem" text="Trotzdem erfassen" disabled={busy} onClick={()=>{if(duplicateReason.trim().length<3||duplicateReason.length>200){setErrors({duplicateReason:'Grund fehlt · 3 bis 200 Zeichen'});return;}setDuplicate(null);}}/>:null}</>:mode!=='ansicht'?<Button data-spec-id={'rechnungein.'+primaryId} art="erledigen" icon="check" text={primaryLabel} disabled={busy} onClick={primary}/>:null}
  </>}>
 <div ref={root} data-spec-id="rechnungein" aria-busy={busy} className="kr-stapel">
  <div className="ev-rweg"><Zustandskette schritte={[
   {key:'eingegangen',label:'Eingegangen',icon:'check',status:'erledigt',sub:new Intl.DateTimeFormat('de-DE').format(new Date(view.item.at))},
   {key:'geprueft',label:'Geprüft',icon:'check',status:view.invoice?'erledigt':'aktiv'},
   {key:'faellig',label:due?'Fällig '+due:'Fälligkeit fehlt',icon:'calendar',status:'warten',sub:'Der Tag 3 Arbeitstage vorher'},
   {key:'bezahlt',label:'Bezahlt',icon:'check',status:view.invoice?.zahlstatus==='bezahlt'?'erledigt':'warten'},
  ]}/><p className="ev-rweg-wer">Wer zahlt: alle mit Recht Geld · erscheint auf Der Tag 3 Arbeitstage vor Fälligkeit</p>
   <div className="kr-form"><Hinweis ton="warn">Pflichtangaben § 14 UStG · am Original prüfen · noch nicht vollständig nachgewiesen</Hinweis><Hinweis ton={warnings.length?'warn':undefined}>{warnings.length?warnings.join(' · '):'Rechnerische Prüfung am Original'}</Hinweis></div>
   <Button art="leise" text="Positionen ins Lager übernehmen · Stufe 3" disabled/>
  </div>
  {missingSupplier?<Hinweis ton="warn">Lieferant fehlt · Rechnung kann erst nach Ergänzung bezahlt werden</Hinweis>:null}
  {uncertain>0?<div data-spec-id="rechnungein.zustand.teilweise"><Hinweis ton="warn">{uncertain} Felder unsicher · mit dem Original vergleichen</Hinweis><Button data-spec-id="rechnungein.geprueft" text="Geprüft" onClick={()=>setUncertain(0)}/></div>:null}
  {view.duplicate&&!duplicate?<div data-spec-id="rechnungein.dublette-hinweis"><Hinweis ton="warn">Rechnung {fields.nummer} von {selected?.name??'Lieferant fehlt'} gibt es schon ({view.duplicate.internalNumber})</Hinweis></div>:null}
  {duplicate?<div data-spec-id="rechnungein.zustand.dublette"><Hinweis ton="warn">Rechnung {duplicate.number} von {selected?.name??'Lieferant fehlt'} gibt es schon ({duplicate.internalNumber})</Hinweis>
   {!duplicate.exact?<Feld label="Grund für die zweite Erfassung" fehler={errors.duplicateReason}><Eingabe data-spec-id="rechnungein.dublette_grund" maxLength={200} value={duplicateReason} onChange={event=>setDuplicateReason(event.target.value)}/></Feld>:null}</div>:null}
  {retry?<div data-spec-id="rechnungein.zustand.fehler"><p>Nicht gespeichert · alle Eingaben sind noch da</p><Button data-spec-id="rechnungein.erneut" text="Neu laden · Eingaben behalten" onClick={()=>{if(working.current)return;working.current=true;setBusy(true);void ports.read({id:view.item.id}).then(result=>{if(result.code!=='OK'){setMessage(belegFailureCopy(result.code));return;}setView(result.view);setRetry(false);setMessage(null);}).catch(error=>{console.error('[INVOICE_RETRY_READ_FAILED]',{name:error instanceof Error?error.name:'unknown'});setMessage(belegFailureCopy('UNAVAILABLE'));}).finally(()=>{working.current=false;setBusy(false);});}} disabled={busy}/></div>:null}
  <div className="r38-raster"><Kachel titel="Original" icon="file">{view.originals.map(file=><button key={file.id} className="kr-zeile" type="button" data-spec-id="rechnungein.original" onClick={()=>ports.openOriginal(file.itemId??view.item.id,file.id)}><span><b>{file.name||'Beleg'}</b><small>gesichert · unverändert</small></span></button>)}{!view.originals.length?<Hinweis ton="warn">Original fehlt</Hinweis>:null}</Kachel>
   <section aria-label="Rechnung"><h3 className="kr-block-label">1 · Rechnung</h3><div className="kr-form">
    <Feld label="Lieferant" voll fehler={errors.lieferantId}><Eingabe data-invoice-field="lieferantId" data-spec-id="rechnungein.lieferant" required value={supplierQuery} disabled={busy} readOnly={readOnly||!!view.invoice&&!missingSupplier&&mode!=='neu_ablegen'} onChange={event=>{setSupplierQuery(event.target.value);setSelected(null);update('lieferantId','');}}/>
     {searching?<span role="status">Lieferant wird gesucht …</span>:null}
    </Feld>
    {!readOnly&&!selected&&(!view.invoice||missingSupplier||mode==='neu_ablegen')?<div className="kr-voll">{suppliers.map(value=><Button key={value.id} text={value.name+' · übernehmen'} onClick={()=>chooseSupplier(value)}/>)}<Button data-spec-id="rechnungein.lieferant-anlegen" text="Lieferant anlegen" onClick={()=>{
     void ports.createSupplier(view.item.id).then(result=>{if(result.code!=='OK')setMessage(belegFailureCopy(result.code));}).catch(error=>{console.error('[INVOICE_CREATE_SUPPLIER_OPEN_FAILED]',error);setMessage('Lieferant kann nicht geöffnet werden · Fehlercode: INVOICE_CREATE_SUPPLIER_OPEN_FAILED.');});
    }}/></div>:null}
    {fieldRows.map(([field,id,label,type])=><Feld key={field} label={label} className={errors[field]?'kr-feld--fehler':undefined}><Eingabe data-invoice-field={field} data-spec-id={'rechnungein.'+id} type={type} required={field!=='iban'&&!readOnly} readOnly={readOnly||field==='iban'&&!!view.invoice} disabled={busy} value={fields[field]} aria-invalid={!!errors[field]} aria-describedby={errors[field]?'invoice-error-'+id:undefined} inputMode={['netto','ust','brutto'].includes(field)?'decimal':undefined} onChange={event=>update(field,event.target.value)}/>{errors[field]?<span id={'invoice-error-'+id} className="kr-feld-fehler" data-spec-id={'rechnungein.'+id+'.fehler'}>{errors[field]}</span>:null}</Feld>)}
   </div></section></div>
  {mode==='rueckgaengig'?<Feld label={C.undoReason} fehler={errors.reason}><Textfeld data-invoice-field="reason" value={reason} maxLength={200} onChange={event=>setReason(event.target.value)}/></Feld>:null}
  {mode==='unklar'?<div data-spec-id="rechnungein.zustand.unklar"><h3>Unklar · was ist zu klären?</h3><Feld label="Grund" fehler={errors.reason}><Textfeld data-invoice-field="reason" data-spec-id="rechnungein.grund" maxLength={200} value={reason} onChange={event=>setReason(event.target.value)}/></Feld></div>:null}
  {mode==='klaeren'?<div data-spec-id="rechnungein.zustand.klaeren"><h3>Rechnung klären</h3><p>{view.invoice?.unklar_grund}</p><div data-spec-id="rechnungein.ergebnis"><Feld label="Ergebnis" fehler={errors.outcome}><Segment label="Ergebnis" wert={outcome} onWert={setOutcome} optionen={[{wert:'offen',text:'offen'},{wert:'bezahlt',text:'schon bezahlt'},{wert:'doppelt',text:'doppelt'},{wert:'ungueltig',text:'ungültig'}]}/></Feld></div>
   {outcome==='ungueltig'?<Feld label="Grund" fehler={errors.reason}><Textfeld data-invoice-field="reason" data-spec-id="rechnungein.grund" value={reason} maxLength={200} onChange={event=>setReason(event.target.value)}/></Feld>:null}
   {outcome==='doppelt'?<Feld label="Doppelt zu" fehler={errors.duplicate}><Eingabe readOnly value={view.duplicate?.internalNumber??'Vorhandene Rechnung fehlt'}/></Feld>:null}
   <Checkbox checked={correct} onChange={setCorrect}>Angaben berichtigen</Checkbox></div>:null}
  {mode==='bezahlt'||mode==='bezahlt_markieren'||mode==='klaeren'&&outcome==='bezahlt'?<div data-spec-id={'rechnungein.zustand.'+(mode==='bezahlt_markieren'?'bezahlt_markieren':'bezahlt')}><h3>{mode==='bezahlt_markieren'?'Fällig '+due+' · offen':'Ist schon bezahlt · wann?'}</h3><Feld label="Bezahlt am" fehler={errors.paidDate}><Eingabe data-invoice-field="paidDate" data-spec-id="rechnungein.bezahlt_am" type="date" required disabled={busy} value={paidDate} max={today()} onChange={event=>setPaidDate(event.target.value)}/></Feld>
   <input ref={proofInput} type="file" hidden onChange={event=>{const file=event.currentTarget.files?.[0];event.currentTarget.value='';if(file)void uploadProof(file);}}/>
   <Button data-spec-id="rechnungein.nachweis" art="sekundaer" text={uploading?'Wird gesichert …':'Nachweis'} disabled={busy} onClick={()=>proofInput.current?.click()}/>{proofName?<p role="status">{proofName} · gesichert</p>:null}
   {proofRetry?<Button text="Nachweis erneut sichern" disabled={busy} onClick={()=>void uploadProof()}/>:null}
  </div>:null}
 </div></Dialog>
 {discard?<Rueckfrage felder={[...fieldRows.filter(([field])=>fields[field]!==initial.fields[field]).map(([, ,label])=>label),...(fields.lieferantId!==initial.fields.lieferantId?['Lieferant']:[]),...(reason?['Grund']:[]),...(duplicateReason?['Grund für die zweite Erfassung']:[]),...(outcome!==' '?['Ergebnis']:[])]} beschaeftigt={busy} onVerwerfen={onClose} onWeiter={()=>setDiscard(false)}/>:null}</>;
}
