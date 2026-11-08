'use client';
import {useCallback,useEffect,useRef,useState} from 'react';
import {Dialog,Rueckfrage} from '@/ui/kr';
import type {QuoteReadback,QuotePositionInput,ReadQuoteResult,UpdateQuoteInput,UpdateQuoteResult} from '../public';
import type {QuoteLifecycleInput} from '../server/quoteLifecycle';
import styles from './QuoteCard.module.css';

type Proposal={before:QuoteReadback;after:{dueDate:string;positions:QuotePositionInput[];calculation:unknown};changes:string[];missing:string[];canApply:boolean;candidate:Omit<UpdateQuoteInput,'clientEventId'>|null};
type Failure={code:Exclude<ReadQuoteResult['code'],'OK'>|'UNAUTHENTICATED';message:string};
export type QuoteCardPorts={
 read:(quoteId:string)=>Promise<Failure|{code:'OK';quote:QuoteReadback;canEdit:boolean}>;
 change:(input:QuoteLifecycleInput)=>Promise<Failure|{code:'OK';quote:QuoteReadback}>;
 prepare:(input:{quoteId:string;text:string})=>Promise<Failure|{code:'OK';preparation:Proposal}>;
 update:(input:UpdateQuoteInput)=>Promise<UpdateQuoteResult|Failure>;
};
const euro=(cents:number)=>new Intl.NumberFormat('de-DE',{style:'currency',currency:'EUR'}).format(cents/100);
const date=(value:string|null|undefined)=>value?new Intl.DateTimeFormat('de-DE',{timeZone:'Europe/Berlin'}).format(new Date(value)):'Datum fehlt';

/** The one quote card reads its persisted aggregate; no prototype state enters the app. */
export function QuoteCard({quoteId,ports,onClose,onCustomer,onOrder}:{quoteId:string;ports:QuoteCardPorts;onClose:()=>void;onCustomer:(id:string)=>void;onOrder:(id:string)=>void}){
 const [quote,setQuote]=useState<QuoteReadback|null>(null),[canEdit,setCanEdit]=useState(false),[error,setError]=useState<string|null>(null),[message,setMessage]=useState<string|null>(null),[mode,setMode]=useState<'read'|'edit'|'reject'>('read'),[text,setText]=useState(''),[proposal,setProposal]=useState<Proposal|null>(null),[busy,setBusy]=useState(false),[closePrompt,setClosePrompt]=useState(false);
 const closeIntent=useRef<'close'|'read'>('close');
 const working=useRef(false),keys=useRef(new Map<string,string>());
 const requestKey=(intent:string)=>{let key=keys.current.get(intent);if(!key){key=crypto.randomUUID();keys.current.set(intent,key);}return key;};
 const load=useCallback(async()=>{try{const result=await ports.read(quoteId);if(result.code!=='OK'){setError(result.message);return;}setQuote(result.quote);setCanEdit(result.canEdit);setError(null);}catch(cause){console.error('[QUOTE_CARD_READ_FAILED]',cause);setError('KV konnte nicht geladen werden · Erneut laden.');}},[ports,quoteId]);
 useEffect(()=>{let active=true;Promise.resolve().then(()=>ports.read(quoteId)).then(result=>{if(!active)return;if(result.code!=='OK'){setError(result.message);return;}setQuote(result.quote);setCanEdit(result.canEdit);setError(null);}).catch(cause=>{console.error('[QUOTE_CARD_READ_FAILED]',cause);if(active)setError('KV konnte nicht geladen werden · Erneut laden.');});return()=>{active=false;};},[ports,quoteId]);
 const close=()=>{if(working.current)return;if(text.trim()){closeIntent.current='close';setClosePrompt(true);return;}onClose();};
 const run=async(work:()=>Promise<void>)=>{if(working.current)return;working.current=true;setBusy(true);setError(null);try{await work();}catch(cause){console.error('[QUOTE_CARD_ACTION_FAILED]',cause);setError('Speicherergebnis unklar · alle Eingaben sind noch da. Erneut mit derselben Anfrage versuchen.');}finally{working.current=false;setBusy(false);}};
 const change=(action:'accept'|'reject')=>{if(!quote)return;const current=quote;
  if(action==='reject'&&text.trim().length<3){setError('Grund der Absage wählen');return;}
  const identity={quoteId,expectedVersion:current.version,edition:current.lifecycle?.edition??1,clientEventId:requestKey(current.version+':'+action+':'+text.trim())};
  void run(async()=>{const result=await ports.change(action==='accept'?{...identity,action,evidence:'Am Telefon zugesagt · von der angemeldeten Person bestätigt'}:{...identity,action,reason:text.trim()});if(result.code!=='OK'){setError(result.message);return;}setQuote(result.quote);setText('');setMode('read');setMessage(action==='accept'?'Zusage gespeichert · Ware erwartet.':'Absage gespeichert.');window.dispatchEvent(new Event('kreile:intake-changed'));});
 };
 const prepare=()=>void run(async()=>{const result=await ports.prepare({quoteId,text});if(result.code!=='OK'){setError(result.message);return;}setProposal(result.preparation);});
 const apply=()=>{if(!proposal?.candidate)return;const candidate=proposal.candidate;void run(async()=>{const result=await ports.update({...candidate,clientEventId:requestKey('update:'+JSON.stringify(candidate))});if(result.code!=='OK'){setError(result.message);return;}setQuote(result.quote);setText('');setProposal(null);setMode('read');setMessage('KV geändert · neue Fassung sicher gespeichert.');window.dispatchEvent(new Event('kreile:intake-changed'));});};
 const lifecycle=quote?.lifecycle,edition=lifecycle?.edition??1,accepted=lifecycle?.acceptedEdition===edition,sent=lifecycle?.sentEdition===edition,fixed=Boolean(lifecycle?.sentAt||lifecycle?.acceptedAt),blockedGoods=lifecycle?.goods?.find(goods=>!goods.orderId),who=quote?.customerDisplayName??'Kunde';
 const sentence=quote?.linkedOrderId?`Aus ${quote.quoteNumber} ist der Auftrag geworden.`:lifecycle?.stage==='abgesagt'?`${who} hat abgesagt. Es gibt keinen Auftrag.`:blockedGoods&&!accepted?`Die Ware liegt in ${blockedGoods.location} – es fehlt nur die Zusage von ${who}.`:accepted?`${who} hat ${lifecycle?.acceptedAt?'am '+date(lifecycle.acceptedAt)+' ':''}zugesagt.`:sent?`Liegt seit ${date(lifecycle?.sentAt)} bei ${who}.`:'Du bereitest den KV vor.';
 return <><div className={styles.card}><Dialog titel={quote?`${quote.quoteNumber} · ${who}`:'KV wird geladen …'} groesse="breit" onSchliessen={onClose} vorSchliessen={()=>{if(working.current)return false;if(text.trim()){closeIntent.current='close';setClosePrompt(true);return false;}return true;}} meldung={error?{ton:'fehler',text:error}:message?{ton:'erfolg',text:message}:null} fuss={<><button className={styles.button} onClick={close} disabled={busy}>Zurück</button>{quote?<a className={styles.button} href={`/api/documents/${encodeURIComponent(quoteId)}/quote-pdf`} target="_blank" rel="noreferrer">Drucken</a>:null}</>}>
 {!quote?<><p role="status">{error?'KV nicht verfügbar.':'KV wird geladen …'}</p>{error?<button className={styles.button} onClick={()=>void load()}>Erneut laden</button>:null}</>:<>
 <div className={styles.say}><p><strong>{sentence}</strong> {accepted&&!quote.linkedOrderId&&!blockedGoods?'Sobald die Teile da sind, wird daraus mit einem Klick der Auftrag.':sent&&!accepted?'Du kannst die telefonische Zusage festhalten.':null}</p><div className={styles.actions}>
 {quote.linkedOrderId?<button className={styles.primary} onClick={()=>onOrder(quote.linkedOrderId!)}>Auftrag öffnen</button>:null}
 {canEdit&&sent&&!accepted&&lifecycle?.stage!=='abgesagt'?<button className={styles.soft} disabled={busy} onClick={()=>change('accept')}>{busy?'Wird gespeichert …':`${who} hat am Telefon zugesagt`}</button>:null}
 {canEdit&&!quote.linkedOrderId&&lifecycle?.stage!=='abgesagt'?<><button className={styles.button} disabled={busy} onClick={()=>{setMode('edit');setProposal(null);setText('');}}>{fixed?`Ändern · Fassung ${edition+1} anlegen`:'KV bearbeiten'}</button><button className={styles.button} disabled={busy} onClick={()=>{setMode('reject');setProposal(null);setText('');}}>{who} sagt ab</button></>:null}
 </div></div>
 {mode==='read'?<dl className={styles.facts}><dt>Kunde</dt><dd><button className={styles.link} onClick={()=>onCustomer(quote.customerId)}>{who}</button></dd><dt>Teile</dt><dd>{quote.positions.map(row=><div key={row.id}>{row.quantity} × {row.name} – {row.surfaceRequested}</div>)}</dd><dt>Arbeitszeit</dt><dd>{lifecycle?.calculation?Number(lifecycle.calculation.hours).toLocaleString('de-DE',{maximumFractionDigits:4})+' Std.':'fehlt'}</dd><dt>Preis</dt><dd>{euro(quote.totalNetCents)} netto</dd><dt>Fertig</dt><dd>{date(quote.dueDate)}{lifecycle?.deliveryWeeks?` · ${lifecycle.deliveryWeeks} Wochen ab Zusage und Ware`:''}</dd><dt>Fassung</dt><dd>{edition}{sent?` · gesendet am ${date(lifecycle?.sentAt)}${lifecycle?.sentChannel==='druck'?' per Post':' per E-Mail'}`:''}</dd>{lifecycle?.specialRequests||quote.note?<><dt>Wünsche</dt><dd>{lifecycle?.specialRequests??quote.note}</dd></>:null}</dl>:<div className={styles.edit}>
 <label>{mode==='reject'?'Grund der Absage':'Was soll geändert werden?'}<textarea value={text} onChange={event=>{setText(event.target.value);setProposal(null);}} maxLength={mode==='reject'?4000:6000} disabled={busy}/></label>
 {mode==='reject'?<button className={styles.primary} disabled={busy} onClick={()=>change('reject')}>{busy?'Wird gespeichert …':text.trim().length<3?'Grund der Absage wählen':'Absage festhalten'}</button>:<><button className={styles.button} disabled={busy||!text.trim()} onClick={prepare}>Änderungsvorschlag anzeigen</button>{proposal?<div><h3>Vorher → Nachher</h3>{proposal.changes.map(value=><p key={value}>{value}</p>)}{proposal.missing.map(value=><p role="status" key={value}>{value}</p>)}<button className={styles.primary} disabled={busy||!proposal.canApply} onClick={apply}>{busy?'Wird gespeichert …':`Fassung ${fixed?edition+1:edition} anlegen`}</button></div>:null}</>}
 <button className={styles.button} disabled={busy} onClick={()=>{if(text.trim()){closeIntent.current='read';setClosePrompt(true);}else setMode('read');}}>Zurück zur KV-Karte</button>
 </div>}
 <details className={styles.history}><summary>Verlauf und Anfrage</summary><p>Erstellt am {date(quote.createdAt)} · {quote.actorDisplayName}</p>{lifecycle?.sentAt?<p>Gesendet am {date(lifecycle.sentAt)}</p>:null}{lifecycle?.acceptanceEvidence?<p>{lifecycle.acceptanceEvidence}</p>:null}{lifecycle?.declineReason?<p>{lifecycle.declineReason}</p>:null}{quote.note?<pre>{quote.note}</pre>:null}</details>
 </>}
 </Dialog></div>{closePrompt?<Rueckfrage felder={['Eingaben am KV']} beschaeftigt={busy} onVerwerfen={()=>{setText('');setProposal(null);setClosePrompt(false);if(closeIntent.current==='close')onClose();else setMode('read');}} onWeiter={()=>setClosePrompt(false)}/>:null}</>;
}
