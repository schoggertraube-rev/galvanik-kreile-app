'use client';

import {PENDING_UNDO_COPY as COPY} from '@/ui/situationCatalog';
import {Button} from './Button';
import styles from './RueckgaengigLeiste.module.css';

export type RueckgaengigEintrag={id:string;text:string;frist:string;gestartet:boolean};
export interface RueckgaengigLeisteProps {
  eintraege:readonly RueckgaengigEintrag[];
  jetzt:number;
  beschaeftigtId:string|null;
  quelleUnbekannt:boolean;
  fehler:string|null;
  onRueckgaengig:(id:string)=>void;
}

/** One controlled U-291 bar, V45 feedback()/v10 toast. Display time never
 * schedules a command or authorizes withdrawal: the existing queue CAS does.
 * Ring values are discrete source-state updates, with no new motion curve. */
export function RueckgaengigLeiste(props:RueckgaengigLeisteProps){
  if(props.eintraege.length===0&&!props.quelleUnbekannt&&!props.fehler)return null;
  const remaining=(row:RueckgaengigEintrag)=>{
    const deadline=Date.parse(row.frist);
    return Number.isFinite(deadline)&&Number.isFinite(props.jetzt)?Math.max(0,Math.min(10,Math.ceil((deadline-props.jetzt)/1000))):null;
  };
  const first=props.eintraege.find(row=>{const seconds=remaining(row);return !row.gestartet&&seconds!==null&&seconds>0;});
  const firstRemaining=first?remaining(first):null;
  const status=(row:RueckgaengigEintrag)=>remaining(row)===null?COPY.unknown:row.gestartet?COPY.started:COPY.pending;
  const button=(row:RueckgaengigEintrag)=><Button vorfinalForm="pill" text={COPY.undo}
    aria-label={row.text+' · '+COPY.undo} data-spec-id="undo.withdraw" data-pending-id={row.id}
    disabled={props.quelleUnbekannt||props.beschaeftigtId!==null||row.gestartet||remaining(row)===null||remaining(row)===0}
    aria-busy={props.beschaeftigtId===row.id} onClick={()=>props.onRueckgaengig(row.id)}/>;
  return <aside className={'toast show '+styles.bar} aria-label={COPY.title} data-spec-id="undo.bar">
    {firstRemaining!==null?<svg className={styles.ring} viewBox="0 0 24 24" role="progressbar" aria-label={COPY.remaining}
      aria-valuemin={0} aria-valuemax={10} aria-valuenow={firstRemaining}>
      <circle cx="12" cy="12" r="9" pathLength="10" fill="none" stroke="currentColor" strokeWidth="2" strokeDasharray={firstRemaining+' 10'} transform="rotate(-90 12 12)"/>
    </svg>:null}
    <div><span role="status">{props.quelleUnbekannt?COPY.unknown:props.eintraege.length===1?props.eintraege[0].text:COPY.count(props.eintraege.length)}</span>
      {props.fehler?<p role="status">{props.fehler}</p>:null}
      {props.eintraege.length===1?<>{button(props.eintraege[0])}<small>{status(props.eintraege[0])}</small></>:null}
      {props.eintraege.length>1?<details><summary>{COPY.undo}</summary><div className={styles.stack}>
        {props.eintraege.map(row=><div key={row.id} className={styles.row} data-pending-id={row.id}>
          <span>{row.text}<small>{status(row)}</small></span>{button(row)}
        </div>)}
      </div></details>:null}
    </div>
  </aside>;
}
