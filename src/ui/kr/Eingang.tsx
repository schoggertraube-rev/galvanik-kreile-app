'use client';

import {useId,type ReactNode} from 'react';
import {V45_TEXT} from '@/ui/situationCatalog';
import {Button} from './Button';
import {Hauptaktion,type Fachaktion} from './Hauptaktion';

type EingangZiel={id:string;elementId:string;text:string;onWaehlen:((id:string)=>void)|null;grund?:string};
export interface EingangProps {
  originalId:string|null;
  version:string|number;
  variante:'leer'|'text'|'dateien'|'erkannt'|'unsicher'|'offline';
  label:string;
  text:string;
  onText:(text:string)=>void;
  /** Existing capture/file controls; this component creates no file input,
   * uploader, second OCR/recognizer, local queue or original writer. */
  erfassung:ReactNode;
  dateien:readonly {id:string;name:string;statusText:string;vorschau:ReactNode;ziel:EingangZiel|null}[];
  erkannt:readonly EingangZiel[];
  kandidaten:readonly EingangZiel[];
  datenluecken:readonly string[];
  aktion:(Fachaktion&{elementId:string;text:string})|null;
  laden:boolean;
  deaktiviert:boolean;
}

/** v10 SHEETS.plus/einLive ein2/ein-feld/ein-files/ein-erk/ein-opts.
 * The supplied source retains every raw character, file and recognized fact.
 * Names and text never trigger recognition or a success state here. */
export function Eingang(props:EingangProps){
  const id=useId(),blocked=props.laden||props.deaktiviert;
  const ziel=(row:EingangZiel,chip=false)=><div key={row.id} data-target-id={row.id}>
    <Button vorfinalForm="pill" className={chip?'chip ein-c':undefined} text={row.text} data-spec-id={row.elementId}
      disabled={blocked||row.onWaehlen===null} onClick={row.onWaehlen?()=>row.onWaehlen?.(row.id):undefined}/>
    {row.onWaehlen===null&&row.grund?<p className="muted" role="status">{row.grund}</p>:null}
  </div>;
  return <section className="ein2" data-spec-id="baustein.eingang" data-original-id={props.originalId??undefined}
    data-source-version={props.version} data-zustand={props.variante} aria-busy={props.laden}>
    <div className="ein-feld"><label htmlFor={id}>{props.label}</label>
      <textarea id={id} rows={4} value={props.text} placeholder={V45_TEXT.intake$placeholder}
        disabled={props.deaktiviert} onChange={event=>props.onText(event.currentTarget.value)}/>
      <div className="ein-werk">{props.erfassung}</div>
    </div>
    {props.dateien.length>0?<div className="ein-files">{props.dateien.map(file=><div className="ein-file" key={file.id} data-file-id={file.id}>
      {file.vorschau}<span><b>{file.name}</b><small>{file.statusText}</small></span>{file.ziel?ziel(file.ziel):null}
    </div>)}</div>:null}
    {props.erkannt.length>0?<div className="ein-erk">{props.erkannt.map(row=>ziel(row,true))}</div>:null}
    {props.kandidaten.length>0?<div className="ein-opts">{props.kandidaten.map(row=>ziel(row))}</div>:null}
    {props.datenluecken.map((text,index)=><p key={index} className="muted" role="status">{text}</p>)}
    {props.aktion?<div className="ein-haupt"><Hauptaktion {...props.aktion} laden={props.laden} gesperrt={props.deaktiviert||props.aktion.gesperrt}/></div>:null}
  </section>;
}
