"use client";
import {Button,Eingabe,Icon,Segment} from "@/ui/kr";
import {INTAKE_PROCESSING_WEEKS,type IntakeTermSuggestion} from "@/lib/intakeSuggestionsContract";

export type IntakeTermSelection={kind:"adopted"|"kept"|"proposal"|"kv";basisKey:string;wishDate:string;achievableDate:string;title?:string};
const dateLabel=(value:string)=>new Intl.DateTimeFormat("de-DE",{timeZone:"UTC",weekday:"short",day:"2-digit",month:"2-digit"}).format(new Date(value+"T00:00:00Z"));

export function IntakeTermBlock({handover,handoverOrigin,onHandover,weeks,onWeeks,term,loading,failed,date,onDate,choice,onProposal,onOffer,onKeep,onChange,canDecide,quote,expired,surfacePending}:{
 handover:""|"PICKUP"|"SHIPPING";handoverOrigin:"customer-card"|"last-order"|null;onHandover:(mode:"PICKUP"|"SHIPPING")=>void;
 weeks:1|2|3|5|null;onWeeks:(weeks:1|2|3|5)=>void;term:IntakeTermSuggestion|null;loading:boolean;failed:boolean;
 date:string;onDate:(date:string)=>void;choice:IntakeTermSelection|null;onProposal:(proposal:NonNullable<IntakeTermSuggestion["proposals"]>[number])=>void;
 onOffer:()=>void;onKeep:()=>void;onChange:()=>void;canDecide:boolean;quote:boolean;expired:boolean;surfacePending:boolean;
}){
 const blocked=term?.rating==="nicht_machbar"||term?.rating==="unmoeglich";
 return <div className="ev-tv" data-spec-id="eingang.terminvorschlag">
  <div className="ev-tv-z"><div className="ev-tv-l">Übergabe {handoverOrigin?<small data-spec-id="eingang.uebergabe.herkunft">{handoverOrigin==="customer-card"?"aus Kundenkarte":"wie zuletzt"}</small>:null}</div><div data-spec-id="eingang.uebergabe"><Segment label="Übergabe" wert={handover} optionen={[{wert:"PICKUP",text:"Abholung"},{wert:"SHIPPING",text:"Versand"}]} onWert={value=>{if(value)onHandover(value);}}/></div></div>
  {!handover?<><div className="ev-tv-leer"><Icon name="calendar"/>Erst Abholung oder Versand wählen</div>{surfacePending?<p data-spec-id="eingang.abgleich">Noch nicht abgeglichen – erst Oberfläche wählen</p>:null}</>:<>
   <div className="ev-tv-z"><div className="ev-tv-l">Bearbeitungszeit {term?.estimatedWeeks?<small>App-Schätzung: {term.estimatedWeeks} Wochen</small>:null}</div><div className="ev-tv-k-reihe" data-spec-id="eingang.bearbeitungszeit">{INTAKE_PROCESSING_WEEKS.map(value=><button key={value} type="button" className="ev-tv-w" aria-pressed={(weeks??term?.estimatedWeeks)===value} data-spec-id={`eingang.bearbeitungszeit.${value}`} onClick={()=>onWeeks(value)}>{value} {value===1?"Woche":"Wochen"}</button>)}</div></div>
   {expired?<div className="ev-tv-wunsch ev-tv-wunsch--warn" role="status">Termin nicht mehr leistbar – neu wählen</div>:null}
   {choice?<div className="ev-vorschlag ev-vorschlag--ok"><Icon name="check"/><b>{choice.kind==="proposal"?`Liefertermin ${dateLabel(choice.achievableDate)} · Vorschlag ${choice.title} · Termin bestätigt`:choice.kind==="adopted"?`Gegenvorschlag ${dateLabel(choice.achievableDate)} · Wunsch war ${dateLabel(choice.wishDate)} · Kunde erhält ihn mit der Auftragsbestätigung`:choice.kind==="kv"?`Wunsch ${dateLabel(choice.wishDate)} übernommen (KV)`:`Wunsch ${dateLabel(choice.wishDate)} zugesagt (über Auslastung) · Termin bestätigt`}</b><Button data-spec-id="eingang.liefertermin.aendern" text="Ändern" onClick={onChange}/></div>:<>
    {failed?<p data-spec-id="eingang.abgleich">Terminvorschlag nicht verfügbar</p>:term?.unavailableReason?<p data-spec-id="eingang.abgleich" role="status">{term.unavailableReason}</p>:term&&date?<div data-spec-id="eingang.abgleich" className={`ev-tv-wunsch${blocked?" ev-tv-wunsch--warn":" ev-tv-wunsch--ok"}`}><Icon name={blocked?"alert":"check"}/><span>Wunsch {dateLabel(date)} · {term.rating==="unmoeglich"?"unmöglich":term.rating==="nicht_machbar"?"nicht machbar":term.rating??"wird geprüft"}{blocked&&term.offerDate?` · frühestens ${dateLabel(term.offerDate)}`:""}</span>{blocked&&term.offerDate?<Button data-spec-id="eingang.abgleich.anbieten" art="primaer" text={`${dateLabel(term.offerDate)} anbieten`} onClick={onOffer}/>:null}{blocked&&term.rating!=="unmoeglich"&&(canDecide||quote)?<Button data-spec-id="eingang.abgleich.trotzdem" text={quote?"Wunsch übernehmen":"Wunsch trotzdem zusagen"} onClick={onKeep}/>:null}</div>:null}
   </>}
   {!failed&&(!date||choice?.kind==="proposal")&&term?.proposals?.length?<div className="ev-tv-kacheln">{term.proposals.map(proposal=><button key={proposal.id} type="button" className="ev-tv-k" data-spec-id={`eingang.vorschlag.${proposal.id}`} aria-pressed={choice?.kind==="proposal"&&choice.title===proposal.title} onClick={()=>onProposal(proposal)}><span className="ev-tv-k-t">{proposal.title}</span><b>{dateLabel(proposal.date)}</b><span className={`ev-tv-ampel ev-tv-ampel--${proposal.rating==="Luft"?"ok":"warn"}`}>{proposal.utilization} % · {proposal.rating}</span></button>)}</div>:null}
   {loading?<small role="status">wird berechnet …</small>:null}
   {term?.reasons.length?<details><summary>So berechnet</summary>{term.reasons.map(reason=><p key={reason.kind}>{reason.text}</p>)}</details>:null}
  </>}
  {!choice?<label className="ev-tv-z"><span className="ev-tv-l">anderes Datum</span><Eingabe aria-label="Liefertermin" data-spec-id="eingang.liefertermin" type="date" value={date} onChange={event=>onDate(event.target.value)}/></label>:null}
 </div>;
}
