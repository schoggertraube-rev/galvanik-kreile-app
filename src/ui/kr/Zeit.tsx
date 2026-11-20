'use client';

import {useId,type ReactNode} from 'react';
import {V45_TEXT} from '@/ui/situationCatalog';
import {Button} from './Button';
import {Formularfeld} from './Formularfeld';
import {Hauptaktion,type Fachaktion} from './Hauptaktion';
import {weiterMitEnter} from './tastatur';

export interface ZeitProps {
  auftragId:string;
  version:number;
  variante:'heute_offen'|'heute_erfasst'|'historisch';
  datum:string;
  heute:string;
  minuten:string;
  dauerText:string;
  enthaltenText:string;
  notiz:string;
  auswahl:readonly {wert:string;text:string}[];
  grenzen:{min:number;max:number;schritt:number};
  verteilung:ReactNode;
  laden:boolean;
  deaktiviert:boolean;
  fehler:string|null;
  aktion:Fachaktion&{text:string};
  onDatum:(value:string)=>void;
  onMinuten:(value:string)=>void;
  onNotiz:(value:string)=>void;
}

/** v10 az() pills/rng/lead-acts; V45 daily total/extra/allocation semantics.
 * A correction passes the caller's full new day value, never total + input.
 * No time writer exists here: absent source commands remain visibly disabled. */
export function Zeit(props:ZeitProps){
  const id=useId(),blocked=props.laden||props.deaktiviert;
  return <section data-spec-id="baustein.zeit" data-object-id={props.auftragId}
    data-source-version={props.version} data-zustand={props.variante} aria-busy={props.laden}>
    <div className="pills az5">{props.auswahl.map(option=><Button key={option.wert}
      vorfinalForm="pill" text={option.text} disabled={blocked} onClick={()=>props.onMinuten(option.wert)}/>)}</div>
    <div className="rng"><label htmlFor={id+'-range'}><span>{V45_TEXT.werkzeit$total}</span><b>{props.dauerText}</b></label>
      {props.minuten!==''?<input id={id+'-range'} type="range" min={props.grenzen.min} max={props.grenzen.max}
        step={props.grenzen.schritt} value={props.minuten} aria-valuetext={props.dauerText} disabled={blocked}
        onKeyDown={weiterMitEnter} onChange={event=>props.onMinuten(event.currentTarget.value)}/>:null}
    </div>
    <Formularfeld id={id+'-minutes'} art="zahl" label={V45_TEXT.work$time_total} wert={props.minuten}
      grenzen={props.grenzen} laden={props.laden} deaktiviert={props.deaktiviert} onWert={props.onMinuten}/>
    <Formularfeld id={id+'-date'} art="datum" label={V45_TEXT.work$time_date} wert={props.datum}
      grenzen={{max:props.heute}} laden={props.laden} deaktiviert={props.deaktiviert} onWert={props.onDatum}/>
    <p className="fact">{V45_TEXT.werkzeit$included} <b>{props.enthaltenText}</b></p>
    {props.verteilung}
    <Formularfeld id={id+'-note'} art="mehrzeilig" label={V45_TEXT.work$time_note} wert={props.notiz}
      laden={props.laden} deaktiviert={props.deaktiviert} onWert={props.onNotiz}/>
    {props.fehler?<p className="warnline" role="status">{props.fehler}</p>:null}
    <Hauptaktion elementId="work.time_save" laden={props.laden} {...props.aktion} gesperrt={props.deaktiviert||props.aktion.gesperrt}/>
  </section>;
}
