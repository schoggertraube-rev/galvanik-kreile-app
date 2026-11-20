'use client';

import {useId,type ReactNode} from 'react';
import {V45_TEXT} from '@/ui/situationCatalog';
import {Formularfeld} from './Formularfeld';
import {Hauptaktion,type Fachaktion} from './Hauptaktion';
import {weiterMitEnter} from './tastatur';

export interface MehrarbeitProps {
  auftragId:string;
  version:number;
  variante:'auswahl'|'gewaehlt'|'freigabe_offen';
  teilId:string;
  teile:readonly {wert:string;text:string;gesperrt?:boolean}[];
  aktivitaetId:string|null;
  aktivitaeten:readonly {id:string;text:string;dauerText:string|null}[];
  minuten:string;
  dauerText:string;
  grenzen:{min:number;max:number;schritt:number};
  grund:string;
  statusText:string;
  zusammenfassung:ReactNode;
  /** Already authorized by the existing price read port; null carries no amount. */
  preisfeld:ReactNode|null;
  /** The shared intake/capture control, never a second upload input. */
  belege:ReactNode;
  laden:boolean;
  deaktiviert:boolean;
  fehler:string|null;
  aktion:Fachaktion&{text:string};
  onTeil:(id:string)=>void;
  onAktivitaet:(id:string)=>void;
  onMinuten:(wert:string)=>void;
  onGrund:(wert:string)=>void;
}

/** Source v10 mehr(): read/chips/xt/rng/lead-acts. V45 supplies activity,
 * minutes, part and reason. No price math, approval, optimistic write or upload. */
export function Mehrarbeit(props:MehrarbeitProps){
  const id=useId(),blocked=props.laden||props.deaktiviert;
  return <section data-spec-id="baustein.mehrarbeit" data-object-id={props.auftragId}
    data-source-version={props.version} data-part-id={props.teilId} data-zustand={props.variante} aria-busy={props.laden}>
    {props.zusammenfassung}
    <p role="status">{props.statusText}</p>
    <div className="chips" role="group" aria-label={V45_TEXT.werkzeit$activity}>
      {props.aktivitaeten.map(activity=><button key={activity.id} type="button" className={activity.dauerText!==null?'xt has':'xt'}
        data-spec-id="work.activity" aria-pressed={props.aktivitaetId===activity.id} disabled={blocked}
        onClick={()=>props.onAktivitaet(activity.id)}><span>{activity.text}</span>
        {activity.dauerText!==null?<>{' '}<small>{activity.dauerText}</small></>:null}</button>)}
    </div>
    <div className="rng"><label htmlFor={id+'-range'}><span>{V45_TEXT.werkzeit$extra}</span><b>{props.dauerText}</b></label>
      {props.minuten!==''?<input id={id+'-range'} type="range" min={props.grenzen.min} max={props.grenzen.max}
        step={props.grenzen.schritt} value={props.minuten} aria-valuetext={props.dauerText} disabled={blocked}
        onKeyDown={weiterMitEnter} onChange={event=>props.onMinuten(event.currentTarget.value)}/>:null}
    </div>
    <Formularfeld id={id+'-minutes'} art="zahl" label={V45_TEXT.work$minutes} wert={props.minuten}
      grenzen={props.grenzen} laden={props.laden} deaktiviert={props.deaktiviert} onWert={props.onMinuten}/>
    <Formularfeld id={id+'-part'} art="auswahl" label={V45_TEXT.werkzeit$location} wert={props.teilId}
      optionen={props.teile} laden={props.laden} deaktiviert={props.deaktiviert} onWert={props.onTeil}/>
    <Formularfeld id={id+'-reason'} art="mehrzeilig" label={V45_TEXT.werkzeit$optional} wert={props.grund}
      laden={props.laden} deaktiviert={props.deaktiviert} onWert={props.onGrund}/>
    {props.preisfeld}{props.belege}
    {props.fehler?<p className="warnline" role="status">{props.fehler}</p>:null}
    <Hauptaktion elementId="extra.save" laden={props.laden} {...props.aktion} gesperrt={props.deaktiviert||props.aktion.gesperrt}/>
  </section>;
}
