"use client";
import {useEffect,useMemo,useState} from 'react';
import {Dialog} from '@/ui/kr';
import {QUOTE_REPLY_PICKER_COPY as copy,SITUATION_COPY} from '@/ui/situationCatalog';
import styles from './QuoteCard.module.css';

type Target={id:string;number:string;customer:string;parts:string};
export type QuoteReplyPickerPorts={read:()=>Promise<{code:'OK';source:{id:string;text:string|null;customer:string};targets:Target[];limited:boolean}|{code:string;message:string}>};
/** Read-only choice from the existing quote reader, always bounded by the saved source customer. */
export function QuoteReplyPicker({ports,onQuote,onClose,onAssign}:{ports:QuoteReplyPickerPorts;onQuote:(id:string)=>void;onClose:()=>void;onAssign:()=>void}){
 const [result,setResult]=useState<Extract<Awaited<ReturnType<QuoteReplyPickerPorts['read']>>,{code:'OK'}>|null>(null),[error,setError]=useState<string|null>(null),[query,setQuery]=useState(''),[generation,setGeneration]=useState(0);
 useEffect(()=>{let active=true;void ports.read().then(read=>{if(!active)return;if(read.code==='OK'&&'targets'in read){setResult(read);setError(null);}else setError('message'in read?read.message:copy.unavailable);}).catch(cause=>{console.error('[QUOTE_REPLY_PICKER_FAILED]',cause);if(active)setError(copy.unavailable);});return()=>{active=false;};},[ports,generation]);
 const candidates=useMemo(()=>{
  if(!result)return [];
  const match=result.source.text?.match(/\bKV[-\s]*(?:(\d{4})[-\s]+)?(\d{1,9})\b/iu),needle=query.trim().toLocaleLowerCase('de-DE');
  return result.targets.filter(row=>{const pieces=row.number.split('-');if(match&&(Number(pieces.at(-1))!==Number(match[2])||match[1]&&pieces[1]!==match[1]))return false;return !needle||(row.number+' '+row.parts).toLocaleLowerCase('de-DE').includes(needle);});
 },[result,query]);
 return <div className={styles.card}><Dialog titel={copy.title} groesse="breit" onSchliessen={onClose} meldung={error?{ton:'fehler',text:error}:null} fuss={<><button className={styles.button} onClick={onClose}>{SITUATION_COPY.back}</button><button className={styles.button} onClick={onAssign}>{copy.assignment}</button></>}>
 {result?<><div className={styles.say}><p>{copy.sentence(result.source.customer)}</p><p>{result.source.text}</p></div><label className={styles.edit}>{copy.search}<input value={query} onChange={event=>setQuery(event.target.value)}/></label><div className={styles.edit}>{candidates.slice(0,3).map(row=><button className={styles.button} key={row.id} onClick={()=>onQuote(row.id)}><span>{row.customer+' · '+row.number}<br/>{row.parts}<br/>{copy.reason(result.source.customer)}</span></button>)}</div>{!candidates.length?<p>{copy.empty}</p>:null}{candidates.length>3?<p>{copy.more(candidates.length)}</p>:null}{result.limited?<p>{copy.limited}</p>:null}</>:!error?<p>{SITUATION_COPY.pendingRead}</p>:null}
 {error?<button className={styles.button} onClick={()=>setGeneration(value=>value+1)}>{SITUATION_COPY.reload}</button>:null}
 </Dialog></div>;
}
