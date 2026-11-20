'use client';

import {Children,type CSSProperties,type ReactNode} from 'react';
import {V45_TEXT} from '@/ui/situationCatalog';
import {Button} from './Button';
import {Icon} from './Icon';
import {vorfinalLageDarstellung,type LageTon} from './Lage';

export interface WerkstattkachelProps {
  auftragId:string;
  kundeId:string;
  kunde:string;
  nummer:string;
  nummerAnzeigen:boolean;
  zustand:LageTon|null;
  bild:ReactNode;
  ware:{lang:string;kurz:string};
  termin:{haupt:string;detail:string};
  station:{text:string;schritt:0|1|2|null;sichtbar:boolean};
  fortschritt:{text:string;anteil:number|null};
  hinweis?:{text:string;zustand:LageTon};
  laden:boolean;
  gesperrt:boolean;
  /** Existing source-bound controls retain their own command/rights/loading props. */
  hauptaktion:ReactNode;
  kurzaktionen:ReactNode;
  weitere:ReactNode;
  onAuftrag:(id:string)=>void;
  /** Null comes from the existing source/rights projection, never a no-op exit. */
  onKunde:((id:string)=>void)|null;
}

/** v10 cardHTML/syncCard (1948–1989), V45 baustein.werkstattkachel.
 * All dates, quantities, progress and decisions arrive from the real read port.
 * This component neither classifies nor stores a second workshop state. */
export function Werkstattkachel(props:WerkstattkachelProps) {
  const {auftragId,kundeId,kunde,nummer,nummerAnzeigen,zustand,bild,ware,termin,station,fortschritt,
    hinweis,laden,gesperrt,hauptaktion,kurzaktionen,weitere,onAuftrag,onKunde}=props;
  const blocked=laden||gesperrt,tone=zustand===null?undefined:vorfinalLageDarstellung(zustand).tone;
  const hasWeitere=onKunde!==null||Children.toArray(weitere).some(child=>typeof child!=='string'||child.trim().length>0);
  return <article className={'oc glass'+(hinweis?' has-hint':'')} data-glass="card"
    data-id={auftragId} data-customer-id={kundeId} data-tone={tone} data-amt=".55"
    data-spec-id="werkstatt.zeile" aria-busy={laden}>
    <button type="button" className="oc-open" data-blick={auftragId}
      aria-label={V45_TEXT.work$card_order({number:nummer})} disabled={blocked}
      onClick={()=>onAuftrag(auftragId)}>
      <span className="ph" data-b="ph" data-spec-id="werkstatt.bild">{bild}</span>
      <span className="oc-name">{kunde}{nummerAnzeigen?<small className="ano">{nummer}</small>:null}</span>
      <span className="rest" data-b="rest" data-spec-id="werkstatt.resttermin"><b>{termin.haupt}</b><small>{termin.detail}</small></span>
      <span className="what" data-b="what"><span className="w-l">{ware.lang}</span><span className="w-k" aria-hidden="true">{ware.kurz}</span></span>
      <span className="meta" data-spec-id="werkstatt.fortschritt">
        <span className="stat" data-b="stat" data-spec-id="werkstatt.station" hidden={!station.sichtbar}
          style={station.schritt===null?undefined:{'--s':station.schritt} as CSSProperties}><span className="trk3"><i/><i/><i/></span><span data-b="statn">{station.text}</span></span>
        <span className="prog"><i hidden={fortschritt.anteil===null}
          style={fortschritt.anteil===null?undefined:{'--p':fortschritt.anteil} as CSSProperties}/></span>
        <span data-b="prog">{fortschritt.text}</span>
      </span>
    </button>
    {hinweis?<p className="warnline" data-b="hint" data-tone={vorfinalLageDarstellung(hinweis.zustand).tone} data-spec-id="werkstatt.hinweis">
      <Icon variant="vorfinal" name={vorfinalLageDarstellung(hinweis.zustand).icon}/><span>{hinweis.text}</span>
    </p>:null}
    <div className="oc-foot" data-b="foot" data-spec-id="werkstatt.naechster" inert={blocked}>
      {hauptaktion}
      {hasWeitere?<details className="mehrx"><summary data-glass="pill">{V45_TEXT.common$more}</summary><div className="mehrin">
        {onKunde?<Button vorfinalForm="pill" text={V45_TEXT.work$card_customer({name:kunde})}
          disabled={blocked} onClick={()=>onKunde(kundeId)}/>:null}{weitere}
      </div></details>:null}
      {kurzaktionen}
    </div>
  </article>;
}
