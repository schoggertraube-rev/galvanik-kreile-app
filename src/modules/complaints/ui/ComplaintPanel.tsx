'use client';
import {useCallback,useEffect,useState} from 'react';
import {Button,Hinweis,Zustand} from '@/ui/kr';
import type {Complaint,ComplaintFilter,ComplaintReadResult} from '../contract';
import {COMPLAINT_CHANGED_EVENT,COMPLAINT_STATE_LABELS} from '../dialogContract';

export function ComplaintPanel({filter,read,orderId,mayRecord=false,delivered=false}:{filter:ComplaintFilter;read:(filter:ComplaintFilter)=>Promise<ComplaintReadResult>;orderId?:string;mayRecord?:boolean;delivered?:boolean}) {
  const [rows,setRows]=useState<Complaint[]|null>(null),[error,setError]=useState<string|null>(null),key=JSON.stringify(filter);
  const load=useCallback(async()=>{try{const result=await read(JSON.parse(key));if(result.code!=='OK'){setError(result.message);return;}setRows(result.complaints);setError(null);}catch(cause){console.error('[COMPLAINT_PANEL_READ_FAILED]',cause);setError('Reklamationen konnten nicht geladen werden.');}},[read,key]);
  useEffect(()=>{const timer=setTimeout(()=>void load(),0);const refresh=()=>void load();window.addEventListener(COMPLAINT_CHANGED_EVENT,refresh);return()=>{clearTimeout(timer);window.removeEventListener(COMPLAINT_CHANGED_EVENT,refresh);};},[load]);
  const open=(arg:string)=>window.dispatchEvent(new CustomEvent('kreile:oeffne',{cancelable:true,detail:{ziel:'reklamation',arg}}));
  return <section className="kr-stapel" aria-label="Reklamationen"><h3>Reklamationen</h3>{error?<Zustand art="fehler" text={error} aktion={{text:'Erneut',onClick:()=>void load()}}/>:rows===null?<Zustand art="laedt" text="Reklamationen werden geladen …"/>:rows.map(row=><Hinweis key={row.id} ton={row.stand==='abgeschlossen'?'ok':'warn'}><Button icon="alert" text={(row.nummer??'Nummer fehlt')+' · '+(row.stand?COMPLAINT_STATE_LABELS[row.stand]:'Stand fehlt')} onClick={()=>open(row.id)}/></Hinweis>)}{rows?.length===0?<p>Keine Reklamationen vorhanden.</p>:null}{orderId&&delivered&&mayRecord?<Button icon="alert" text="Reklamation aufnehmen" onClick={()=>open(orderId+'#aufnehmen')}/>:null}</section>;
}
