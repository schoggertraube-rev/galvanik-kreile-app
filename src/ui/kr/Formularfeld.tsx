'use client';

import {weiterMitEnter} from './tastatur';
import type {AuswahlOption} from './Formular';

interface FeldBasis {
  id:string;
  label:string;
  laden:boolean;
  deaktiviert:boolean;
  pflicht?:boolean;
  fehler?:{text:string;specId:string};
}
export type FormularfeldProps=FeldBasis&(
  |{art:'text'|'zahl'|'datum'|'mehrzeilig';wert:string;onWert:(wert:string)=>void}
  |{art:'auswahl';wert:string;onWert:(wert:string)=>void;optionen:readonly AuswahlOption[]}
  |{art:'checkbox';wert:boolean;onWert:(wert:boolean)=>void}
);

/**
 * S19: v10 field/label/input/textarea (e.g. 1661/2299/2316).
 * Native selection/checkbox semantics are V45's declared field variants.
 * The shared S18 Enter handler is reused, never reimplemented per screen.
 * No parsing, domain default, validation or save happens in this component.
 */
export function Formularfeld(props:FormularfeldProps) {
  const errorId=props.id+'-error';
  const common={id:props.id,disabled:props.laden||props.deaktiviert,required:props.pflicht,
    'aria-invalid':props.fehler?true:undefined,'aria-describedby':props.fehler?errorId:undefined};
  return <div className="field" data-spec-id="baustein.formularfeld" aria-busy={props.laden} onKeyDown={weiterMitEnter}>
    <label htmlFor={props.id}>{props.label}</label>
    {props.art==='checkbox'?<input {...common} type="checkbox" checked={props.wert}
      onChange={event=>props.onWert(event.currentTarget.checked)}/>
      :props.art==='auswahl'?<select {...common} value={props.wert}
        onChange={event=>props.onWert(event.currentTarget.value)}>
        {props.optionen.map(option=><option key={option.wert} value={option.wert} disabled={option.gesperrt}>{option.text}</option>)}
      </select>
      :props.art==='mehrzeilig'?<textarea {...common} value={props.wert}
        onChange={event=>props.onWert(event.currentTarget.value)}/>
      :<input {...common} type={props.art==='zahl'?'number':props.art==='datum'?'date':'text'}
        value={props.wert} onChange={event=>props.onWert(event.currentTarget.value)}/>}
    {props.fehler?<p className="muted" id={errorId} data-spec-id={props.fehler.specId}>{props.fehler.text}</p>:null}
  </div>;
}
