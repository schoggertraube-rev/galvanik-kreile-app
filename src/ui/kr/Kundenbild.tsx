'use client';

import type {ReactNode} from 'react';
import {V45_TEXT} from '@/ui/situationCatalog';
import {Button} from './Button';
import {Lage,type LageTon} from './Lage';

/** Presentation of the existing read port's visible/unknown/withheld section.
 * Unknown is not an empty list; withheld data never reaches a rendered row. */
export type KundenbildAbschnitt<T>=
  |{zustand:'bekannt';zeilen:readonly T[];leerText:string}
  |{zustand:'unbekannt';text:string}
  |{zustand:'verborgen'};
export type KundenbildLink={id:string;elementId:string;text:string;onOeffnen:((id:string)=>void)|null;grund?:string};
export interface KundenbildProps {
  kundeId:string;
  version:string|number;
  variante:'ruhig'|'ueberfaellig'|'vereinbarung'|'leer';
  name:string;
  kontaktText:string;
  lage:{ton:LageTon;text:string}|null;
  zahlung:KundenbildAbschnitt<{id:string;text:string}>;
  vorgaenge:KundenbildAbschnitt<KundenbildLink>;
  absprachen:KundenbildAbschnitt<{id:string;text:string}>;
  belege:KundenbildAbschnitt<KundenbildLink>;
  belegeTitel:string;
  kundenkarte:KundenbildLink|null;
  mail:KundenbildLink|null;
  laden:boolean;
}

function Abschnitt<T>({quelle,titel,render}:{quelle:KundenbildAbschnitt<T>;titel:string;render:(zeile:T)=>ReactNode}){
  if(quelle.zustand==='verborgen')return null;
  return <><p className="sheet-sec">{titel}</p>{quelle.zustand==='unbekannt'
    ?<p className="muted" role="status">{quelle.text}</p>
    :quelle.zeilen.length?<div className="bk-links">{quelle.zeilen.map(render)}</div>:<p className="muted">{quelle.leerText}</p>}</>;
}

/** v10 kundeSpalte()/msg-k: only supplied facts, stable original target IDs.
 * No customer rating, payment classification, price sum or second source query. */
export function Kundenbild(props:KundenbildProps){
  const link=(row:KundenbildLink)=>row.onOeffnen
    ?<Button key={row.id} vorfinalForm="pill" text={row.text} data-spec-id={row.elementId} data-object-id={row.id}
      disabled={props.laden} onClick={()=>row.onOeffnen?.(row.id)}/>
    :<p key={row.id}>{row.text}{row.grund?<span className="muted"> · {row.grund}</span>:null}</p>;
  return <aside className="msg-k" data-glass="card" data-spec-id="baustein.kundenbild" data-customer-id={props.kundeId}
    data-source-version={props.version} data-zustand={props.variante} aria-busy={props.laden}>
    <h3>{props.name}</h3><p className="muted">{props.kontaktText}</p>
    {props.lage?<Lage zustand={props.lage.ton} text={props.lage.text} laden={props.laden}/>:null}
    <Abschnitt quelle={props.zahlung} titel={V45_TEXT.customer$group$bedingungen} render={row=><p key={row.id}>{row.text}</p>}/>
    <Abschnitt quelle={props.vorgaenge} titel={V45_TEXT.customer$orders} render={link}/>
    <Abschnitt quelle={props.absprachen} titel={V45_TEXT.customer$tab$agreements} render={row=><p className="abspr-z" key={row.id}>{row.text}</p>}/>
    <Abschnitt quelle={props.belege} titel={props.belegeTitel} render={link}/>
    {props.kundenkarte||props.mail?<div className="bk-links">
      {props.kundenkarte?link(props.kundenkarte):null}
      {props.mail?<details className="mehrx"><summary data-glass="pill">{V45_TEXT.common$more}</summary><div className="mehrin">{link(props.mail)}</div></details>:null}
    </div>:null}
  </aside>;
}
