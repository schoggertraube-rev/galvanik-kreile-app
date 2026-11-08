'use client';
import {useMemo,useState} from 'react';
import type {IntakeMessage} from '../messageContract';
import styles from './IntakeConcernsPanel.module.css';

const categories=[['kv','KV'],['reklamation','Reklamation'],['termin','Termine'],['belege','Belege'],['sonstiges','Sonstiges']] as const;
type Category=typeof categories[number][0];
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
 const title=(row:IntakeMessage)=>row.subject?.trim()||row.text?.trim().split('\n')[0]||'Betreff fehlt';
 return <div className={styles.root} data-spec-id="nachrichten.anliegen"><header><h2>Was sollen wir für unsere Kunden tun?</h2><p>Das Anliegen zuerst. Nachricht, Kundendaten und Handlung bleiben beieinander.</p></header>
 <nav className={styles.categories} aria-label="Anliegenarten">{categories.map(([id,label])=><button key={id} aria-pressed={active===id} onClick={()=>{setActive(id);setSelected(null);}}>{label}<span>{messages.filter(row=>category(row)===id&&row.usage==='offen').length}</span></button>)}</nav>
 <div className={styles.layout}><div className={styles.list}>{rows.map(row=><button key={row.id} className={styles.row} aria-pressed={current?.id===row.id} onClick={()=>setSelected(row.id)}><span>{row.channel==='mail'?'E-Mail':row.channel} · {row.usage==='offen'?'Du bist dran':'weitergeführt'}</span><strong>{title(row)}</strong><span>{row.customerName??row.senderName??row.senderAddress??'Absender noch nicht zugeordnet'}</span></button>)}</div>
 {current?<article className={styles.detail}><h2>{title(current)}</h2><p>{current.customerName??current.senderName??'Kunde noch nicht zugeordnet'}</p><p className={styles.say}>{active==='kv'?(current.orderKind==='kv'?'Dein KV und die Nachricht bleiben zusammen. Öffne den gespeicherten Stand.':'Du kannst den KV aus dieser Nachricht vorbereiten. Die Angaben bleiben mit dem Original verknüpft.'):'Du findest die Nachricht und den bisherigen Verlauf am selben Ort.'}</p>
 <div className={styles.actions}>{active==='kv'&&current.orderKind==='kv'&&current.orderId?<button className={styles.primary} onClick={()=>onQuote(current.orderId!)}>KV öffnen</button>:active==='kv'&&canCreateQuote?<button className={styles.primary} onClick={()=>onPrepareQuote(current)}>KV aus Nachricht öffnen</button>:null}<button onClick={()=>onMessage(current)}>Nachricht öffnen</button></div>
 <details><summary>Originalnachricht</summary><p className={styles.original}>{current.text??'Nachrichtentext fehlt'}</p></details>
 </article>:<p className={styles.empty}>Hier ist momentan kein Anliegen.</p>}
 </div></div>;
}
