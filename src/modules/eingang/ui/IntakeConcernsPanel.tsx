'use client';
import {useMemo,useState} from 'react';
import {CONCERN_COPY,QUOTE_REPLY_PICKER_COPY} from '@/ui/situationCatalog';
import type {IntakeMessage} from '../messageContract';
import styles from './IntakeConcernsPanel.module.css';

const categories=Object.entries(CONCERN_COPY.categories) as Array<[Category,string]>;
type Category=keyof typeof CONCERN_COPY.categories;
function category(row:IntakeMessage):Category{
 const concerns=row.openConcerns.length?row.openConcerns:row.concerns;
 if(row.orderKind==='kv'||concerns.some(value=>value.startsWith('kv_')))return 'kv';
 if(concerns.includes('reklamation'))return 'reklamation';
 if(concerns.some(value=>value==='termin'||value==='frist'))return 'termin';
 if(concerns.some(value=>value==='rechnung'||value==='beleg'||value==='zahlung'))return 'belege';
 return 'sonstiges';
}

/** Projection of the parent's one real intake list, not another mailbox or local store. */
export function IntakeConcernsPanel({messages,canCreateQuote,onMessage,onQuote,onPrepareQuote}:{messages:IntakeMessage[];canCreateQuote:boolean;onMessage:(row:IntakeMessage)=>void;onQuote:(id:string)=>void;onPrepareQuote:(row:IntakeMessage)=>void}){
 const [active,setActive]=useState<Category>('kv'),[selected,setSelected]=useState<string|null>(null);
 const rows=useMemo(()=>messages.filter(row=>category(row)===active),[messages,active]);
 const current=rows.find(row=>row.id===selected)??rows[0];
 const title=(row:IntakeMessage)=>row.subject?.trim()||row.text?.trim().split('\n')[0]||CONCERN_COPY.missingSubject;
 return <div className={styles.root} data-spec-id="nachrichten.anliegen"><header><h2>{CONCERN_COPY.title}</h2><p>{CONCERN_COPY.intro}</p></header>
 <nav className={styles.categories} aria-label={CONCERN_COPY.categoryLabel}>{categories.map(([id,label])=><button key={id} aria-pressed={active===id} onClick={()=>{setActive(id);setSelected(null);}}>{label}<span>{messages.filter(row=>category(row)===id&&row.usage==='offen').length}</span></button>)}</nav>
 <div className={styles.layout}><div className={styles.list}>{rows.map(row=><button key={row.id} className={styles.row} aria-pressed={current?.id===row.id} onClick={()=>setSelected(row.id)}><span>{row.channel==='mail'?CONCERN_COPY.mail:row.channel} · {row.usage==='offen'?CONCERN_COPY.yourTurn:CONCERN_COPY.continued}</span><strong>{title(row)}</strong><span>{row.customerName??row.senderName??row.senderAddress??CONCERN_COPY.missingSender}</span></button>)}</div>
 {current?<article className={styles.detail}><h2>{title(current)}</h2><p>{current.customerName??current.senderName??CONCERN_COPY.missingCustomer}</p><p className={styles.say}>{CONCERN_COPY.sentence(active==='kv',current.orderKind==='kv')}</p>
 <div className={styles.actions}>{active==='kv'&&current.orderKind==='kv'&&current.orderId?<button className={styles.primary} onClick={()=>onQuote(current.orderId!+(['kv_annahme','kv_ablehnung','preis_einwand','aenderung'].some(value=>current.openConcerns.includes(value))?'#'+current.id:''))}>{CONCERN_COPY.openQuote}</button>:active==='kv'&&current.openConcerns.some(value=>['kv_annahme','kv_ablehnung','aenderung','preis_einwand'].includes(value))?<button className={styles.primary} onClick={()=>onQuote('#'+current.id)}>{QUOTE_REPLY_PICKER_COPY.title}</button>:active==='kv'&&canCreateQuote?<button className={styles.primary} onClick={()=>onPrepareQuote(current)}>{CONCERN_COPY.prepareQuote}</button>:null}<button onClick={()=>onMessage(current)}>{CONCERN_COPY.openMessage}</button></div>
 <details><summary>{CONCERN_COPY.original}</summary><p className={styles.original}>{current.text??CONCERN_COPY.missingText}</p></details>
 </article>:<p className={styles.empty}>{CONCERN_COPY.empty}</p>}
 </div></div>;
}
