'use client';

import {V45_TEXT} from '@/ui/situationCatalog';
import {BausteinVerlauf} from './BausteinVerlauf';
import {Button} from './Button';
import {Vertiefung} from './Vertiefung';

export type KVVerlaufBeleg={id:string;art:'eingang'|'kv'|'warenbeleg'|'auftrag';text:string}&(
  |{onOeffnen:(id:string)=>void;grund?:string}
  |{onOeffnen:null;grund:string}
);
export interface KVVerlaufSchritt {
  ereignisId:string;
  zeit:string;
  titel:string;
  notiz:string|null;
  beleg:KVVerlaufBeleg|null;
}
export interface KVVerlaufProps {
  quoteId:string;
  version:string|number;
  fassung:string;
  variante:'entwurf'|'gesendet'|'alte_fassung'|'zugesagt'|'vorbehalt'|'ware'|'auftrag';
  schritte:readonly KVVerlaufSchritt[];
  aktuell:string;
  danach:string|null;
  datenluecken:readonly string[];
  verlaufOffen:boolean;
  onVerlaufOffen:(offen:boolean)=>void;
  laden:boolean;
  deaktiviert:boolean;
}

/** Frozen quoteProgress/quoteHistory evidence semantics, using the existing
 * v10 log/fold presentation. The source reader supplies chronological facts;
 * neither channel, acceptance, next step nor an original is inferred here. */
export function KVVerlauf(props:KVVerlaufProps){
  const beleg=(quelle:KVVerlaufBeleg)=> <Button vorfinalForm="pill" text={quelle.text}
    data-spec-id="progress.source" data-source-id={quelle.id} data-source-kind={quelle.art}
    disabled={props.laden||props.deaktiviert||quelle.onOeffnen===null}
    onClick={quelle.onOeffnen?()=>quelle.onOeffnen?.(quelle.id):undefined}/>;
  const inhalt=(row:KVVerlaufSchritt)=><><b>{row.titel}</b>{row.notiz?<p className="history-proof">{row.notiz}</p>:null}
    {row.beleg?beleg(row.beleg):null}{row.beleg?.onOeffnen===null?<p className="muted" role="status">{row.beleg.grund}</p>:null}</>;
  return <section data-spec-id="baustein.kv_verlauf" data-quote-id={props.quoteId} data-source-version={props.version}
    data-edition={props.fassung} data-zustand={props.variante} aria-busy={props.laden}>
    <div className="quote-progress" data-spec-id="kv.verlauf">
      <div className="progress-past"><BausteinVerlauf laden={props.laden}
        eintraege={props.schritte.slice(-3).map(row=>({ereignisId:row.ereignisId,zeit:row.zeit,inhalt:inhalt(row)}))}/></div>
      <div className="progress-current"><span className="progress-now">{V45_TEXT.progress$now({state:props.aktuell})}</span>
        {props.danach!==null?<span>{V45_TEXT.progress$next({step:props.danach})}</span>:null}</div>
    </div>
    {props.datenluecken.map((text,index)=><p key={index} className="muted" role="status">{text}</p>)}
    {props.schritte.length>0?<Vertiefung titel={V45_TEXT.common$history} offen={props.verlaufOffen} onOffen={props.onVerlaufOffen}
      laden={props.laden} deaktiviert={props.deaktiviert}>
      <BausteinVerlauf laden={props.laden} eintraege={props.schritte.map(row=>({ereignisId:row.ereignisId,zeit:row.zeit,inhalt:inhalt(row)}))}/>
    </Vertiefung>:null}
  </section>;
}
