import {Fragment} from 'react';
import {V45_TEXT} from '@/ui/situationCatalog';

export type DokumentWert={zustand:'bekannt';text:string}|{zustand:'unbekannt';grund:string};
export type DokumentGeld=DokumentWert|{zustand:'verborgen'};
export interface KVDokumentProps {
  quoteId:string;
  version:string|number;
  fassung:string;
  originalId:string|null;
  variante:'entwurf'|'versendet'|'neue_fassung';
  titel:string;
  bezug:string;
  kunde:{id:string;name:string;anschrift:readonly string[]};
  positionen:{zustand:'bekannt';zeilen:readonly {id:string;bezeichnung:string;verfahren:string;betrag:DokumentGeld}[];leerText:string}
    |{zustand:'unbekannt';grund:string};
  netto:DokumentGeld;
  termin:DokumentWert;
  gueltig:DokumentWert;
  wuensche:readonly {id:string;text:string}[];
  bedingung:string;
  laden:boolean;
}

function Wert({quelle}:{quelle:DokumentWert}){
  return quelle.zustand==='bekannt'?<>{quelle.text}</>:<span className="muted" role="status">{quelle.grund}</span>;
}

/** v10 OV.kvdoc() bill/dl, with the frozen quotePaper's customer, wishes,
 * date and edition. All values belong to one supplied commercial original;
 * no recalculation, current-price lookup or invented PDF/send evidence. */
export function KVDokument(props:KVDokumentProps){
  return <article className="kv-paper" data-spec-id="baustein.kv_dokument" data-quote-id={props.quoteId}
    data-source-version={props.version} data-edition={props.fassung} data-original-id={props.originalId??undefined}
    data-zustand={props.variante} aria-busy={props.laden}>
    <h3>{props.titel}</h3><p className="muted">{props.bezug}</p>
    <div className="kv-paper-to" data-customer-id={props.kunde.id}>{props.kunde.name}
      {props.kunde.anschrift.map((zeile,index)=><Fragment key={index}><br/>{zeile}</Fragment>)}
    </div>
    <div className="bill"><dl>
      {props.positionen.zustand==='bekannt'
        ?props.positionen.zeilen.map(row=><Fragment key={row.id}>
          <dt data-item-id={row.id}>{row.bezeichnung}<small>{row.verfahren}</small></dt>
          {row.betrag.zustand!=='verborgen'?<dd><Wert quelle={row.betrag}/></dd>:null}
        </Fragment>):null}
      <dt>{V45_TEXT.quote$editor_delivery}</dt><dd><Wert quelle={props.termin}/></dd>
      {props.netto.zustand!=='verborgen'?<><dt className="sum">{V45_TEXT.quote$editor_total}</dt><dd className="sum"><Wert quelle={props.netto}/></dd></>:null}
      <dt>{V45_TEXT.quote$valid}</dt><dd><Wert quelle={props.gueltig}/></dd>
    </dl></div>
    {props.positionen.zustand==='unbekannt'?<p role="status" className="muted">{props.positionen.grund}</p>
      :props.positionen.zeilen.length===0?<p className="muted">{props.positionen.leerText}</p>:null}
    {props.wuensche.map(row=><p key={row.id} className="kv-paper-wishes">{row.text}</p>)}
    <small>{props.bedingung}</small>
  </article>;
}
