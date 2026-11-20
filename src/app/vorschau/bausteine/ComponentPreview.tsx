'use client';

import {useState,type ReactNode} from 'react';
import {useRouter} from 'next/navigation';
import type {getLiveOrderCardAction} from '@/app/actions/orders.actions';
import type {getExtraWorkMasterDataAction} from '@/app/actions/orders.actions';
import type {getCustomerSummaryAction} from '@/app/actions/customers.actions';
import type {readQuoteAction} from '@/app/actions/quotes.actions';
import type {getIntakeCaptureAction} from '@/app/actions/eingang.actions';
import {COMPONENT_PREVIEW_COPY as COPY,V45_TEXT,V45_TEXT_TEMPLATES,type V45TextKey} from '@/ui/situationCatalog';
import {formatEuro} from '@/lib/domain/formatEuro';
import {Hauptaktion} from '@/ui/kr/Hauptaktion';
import {Vertiefung} from '@/ui/kr/Vertiefung';
import {BausteinVerlauf} from '@/ui/kr/BausteinVerlauf';
import {Formularfeld} from '@/ui/kr/Formularfeld';
import {Lage,type LageTon} from '@/ui/kr/Lage';
import {Suchtreffer} from '@/ui/kr/Suchtreffer';
import {Fehler,type FehlerSituation} from '@/ui/kr/Fehler';
import {Teilchip} from '@/ui/kr/Teilchip';
import {Overlay} from '@/ui/kr/Overlay';
import {Eingang} from '@/ui/kr/Eingang';
import {Zeit} from '@/ui/kr/Zeit';
import {Mehrarbeit} from '@/ui/kr/Mehrarbeit';
import {Kundenbild} from '@/ui/kr/Kundenbild';
import {KVDokument} from '@/ui/kr/KVDokument';
import {KVVerlauf,type KVVerlaufProps} from '@/ui/kr/KVVerlauf';
import {Werkstattkachel} from '@/ui/kr/Werkstattkachel';

type Source=Extract<Awaited<ReturnType<typeof getLiveOrderCardAction>>,{code:'OK'}>['data'];
type Component=keyof typeof COPY.names;
type Props={source:Source;customer:Awaited<ReturnType<typeof getCustomerSummaryAction>>|null;
 quote:Awaited<ReturnType<typeof readQuoteAction>>|null;capture:Awaited<ReturnType<typeof getIntakeCaptureAction>>|null;
 master:Awaited<ReturnType<typeof getExtraWorkMasterDataAction>>|null};
const tones:Readonly<Record<string,LageTon>>={gruen:'succ',grün:'succ',succ:'succ',rot:'ral',ral:'ral',orange:'warn',warn:'warn',navy:'info',info:'info'};
const quoteVariants:Readonly<Record<string,KVVerlaufProps['variante']>>={draft:'entwurf',sent:'gesendet',old:'alte_fassung',accepted:'zugesagt',conditional:'vorbehalt',goods:'ware',converted:'auftrag'};

/** Only actual action readback is accepted. Presentation state controls do not
 * manufacture facts, mutate a domain object or claim a successful command. */
export function ComponentPreview({source,customer,quote,capture,master}:Props){
 const router=useRouter(),card=source.card;
 const [component,setComponent]=useState<Component>('lage'),[state,setState]=useState('normal');
 const [text,setText]=useState(capture?.code==='OK'?capture.capture.text??'':''),[expanded,setExpanded]=useState(false),[opener,setOpener]=useState<HTMLElement|null>(null);
 const [error,setError]=useState<FehlerSituation>('offline'),[selectedPart,setSelectedPart]=useState<string|null>(null);
 const [minutes,setMinutes]=useState(''),[date,setDate]=useState(''),[note,setNote]=useState(''),[activity,setActivity]=useState<string|null>(null);
 const loading=state==='laden',disabled=state==='deaktiviert';
 const openOrder=()=>router.push('/orders/'+encodeURIComponent(card.id));
 const reload=()=>router.refresh();
 const history=card.dueDateChanges.map(row=>({ereignisId:row.eventId,zeit:row.changedAt,inhalt:<>{row.changedTo} · {row.reason}</>}));
 const tone=source.nextActionRule?.farbe===null||source.nextActionRule?.farbe===undefined?null:tones[source.nextActionRule.farbe];
 const missing=<p role="status" className="muted">{COPY.noFact}</p>;
 const stateText=(prefix:string,state:string|null|undefined)=>{
  const key=prefix+'.'+state;return state&&Object.hasOwn(V45_TEXT_TEMPLATES,key)?V45_TEXT_TEMPLATES[key as V45TextKey]:COPY.noFact;
 };
 const q=quote?.code==='OK'?quote.quote:null,c=customer?.code==='OK'?customer.data:null;
 const entry=capture?.code==='OK'?capture.capture:null;
 const actors=q?.actorTrace?[q.actorTrace.createdBy,q.actorTrace.lastActor].filter((row,index,rows)=>row!==null&&rows.findIndex(other=>other?.eventId===row.eventId)===index):[];
 const noWrite={text:V45_TEXT.common$save,gesperrt:true,onAusloesen:null,grund:COPY.unbound} as const;
 let body:ReactNode=missing;
 switch(component){
  case 'hauptaktion':body=<Hauptaktion elementId="order.open" text={COPY.open} laden={loading} gesperrt={disabled} onAusloesen={openOrder}/>;break;
  case 'vertiefung':body=<Vertiefung titel={COPY.history} offen={expanded} onOffen={setExpanded} laden={loading} deaktiviert={disabled}><BausteinVerlauf eintraege={history} laden={loading}/></Vertiefung>;break;
  case 'verlauf':body=history.length?<BausteinVerlauf eintraege={history} laden={loading}/>:missing;break;
  case 'formularfeld':body=<Formularfeld id="preview-field" label={COPY.field} art="text" wert={text} onWert={setText} laden={loading} deaktiviert={disabled}/>;break;
  case 'lage':body=tone&&source.nextActionRule?.zustand?<Lage zustand={tone} text={stateText('order.state',source.nextActionRule.zustand)} laden={loading}/>:missing;break;
  case 'suchtreffer':body=<Suchtreffer treffer={[{key:card.id,id:card.orderNumber,titel:card.title,grund:card.customerName,quelle:'Auftrag',onOeffnen:openOrder}]} selectedKey={card.id} laden={loading} deaktiviert={disabled} leer={missing}/>;break;
  case 'fehler':body=<><Formularfeld id="preview-error" label={COPY.state} art="auswahl" wert={error} onWert={value=>{if(Object.hasOwn(COPY.errors,value))setError(value as FehlerSituation);}} optionen={Object.entries(COPY.errors).map(([wert,text])=>({wert,text}))} laden={false} deaktiviert={false}/><Fehler situation={error} objektId={card.id} gegenstand={card.orderNumber} ausweg={COPY.refresh} laden={loading} deaktiviert={disabled} aktion={{id:'preview.refresh',text:COPY.refresh,onAusloesen:reload}}/></>;break;
  case 'teilchip':body=<>{card.items.map(item=><Teilchip key={item.id} auftragId={card.id} teilId={item.id} name={item.name} gut={item.finished?item.quantity:null} menge={item.quantity} zustand={item.finished?'fertig':null} laden={loading} deaktiviert={disabled} onOeffnen={({teilId})=>setSelectedPart(teilId)}/>)}
    {card.items.filter(item=>item.id===selectedPart).map(item=><section key={item.id} data-preview-part-id={item.id}><h3>{item.name}</h3><p>{item.quantity} · {item.surfaceRequested}</p></section>)}</>;break;
  case 'overlay':body=<><button type="button" className="btn2" disabled={disabled||loading} onClick={event=>setOpener(event.currentTarget)}>{COPY.overlay}</button>{opener?<Overlay variante="auftrag" bezugId={card.id} version={card.version} elternId={null} oeffner={opener} titel={card.orderNumber} laden={loading} fehler={null} vorSchliessen={()=>true} onSchliessen={()=>setOpener(null)}><Formularfeld id="preview-dialog-field" label={COPY.field} art="text" wert={text} onWert={setText} laden={loading} deaktiviert={disabled}/></Overlay>:null}</>;break;
  case 'eingang':body=<Eingang originalId={entry?.id??null} version={entry?.version??null} variante={entry?.files.length?'dateien':text===''?'leer':'text'} label={COPY.field} text={text} onText={setText} erfassung={null}
    dateien={entry?entry.files.map(file=>({id:file.id,name:file.name,statusText:file.secured===true?V45_TEXT.intake$original_kept:COPY.noFact,vorschau:null,ziel:null})):[]}
    erkannt={entry?.recognition?[{id:entry.id,elementId:'intake.describe',text:entry.recognition.text,onWaehlen:null}]:[]} kandidaten={[]}
    datenluecken={[COPY.draft,...(entry?.text?[entry.text]:[])]} aktion={{elementId:'intake.save',...noWrite}} laden={loading} deaktiviert={disabled}/>;break;
  case 'werkstattkachel':body=<Werkstattkachel auftragId={card.id} kundeId={card.customerId} kunde={card.customerName} nummer={card.orderNumber} nummerAnzeigen
    zustand={tone??null} bild={missing} ware={{lang:card.title,kurz:card.title}} termin={{haupt:card.dueAt===null?COPY.noFact:card.dueAt,detail:''}}
    station={{text:card.station,schritt:null,sichtbar:false}} fortschritt={{text:COPY.noFact,anteil:null}} laden={loading} gesperrt={disabled}
    hauptaktion={<Hauptaktion elementId="order.open" text={COPY.open} laden={loading} gesperrt={disabled} onAusloesen={openOrder}/>}
    kurzaktionen={null} weitere={null} onAuftrag={openOrder} onKunde={c?()=>router.push('/customers/'+encodeURIComponent(c.id)):null}/>;break;
  case 'zeit':body=<Zeit auftragId={card.id} version={card.version} variante="heute_offen" datum={date} heute={source.serverReadAt?.slice(0,10)??null}
    minuten={minutes} dauerText={COPY.noFact} enthaltenText={COPY.noFact} notiz={note} auswahl={[]} grenzen={null} verteilung={missing}
    laden={loading} deaktiviert={disabled} fehler={null} aktion={noWrite} onDatum={setDate} onMinuten={setMinutes} onNotiz={setNote}/>;break;
  case 'mehrarbeit':body=<Mehrarbeit auftragId={card.id} version={card.version} variante={activity===null?'auswahl':'gewaehlt'} teilId={selectedPart??''}
    teile={card.items.map(item=>({wert:item.id,text:item.name}))} aktivitaetId={activity}
    aktivitaeten={master?.code==='OK'?master.data.catalog.filter(row=>row.active).map(row=>({id:row.id,text:row.name,dauerText:null})):[]}
    minuten={minutes} dauerText={COPY.noFact} grenzen={null} grund={note} statusText={COPY.draft} zusammenfassung={<p>{card.orderNumber}</p>}
    preisfeld={null} belege={null} laden={loading} deaktiviert={disabled} fehler={master?.code==='OK'?null:COPY.unavailable} aktion={noWrite}
    onTeil={setSelectedPart} onAktivitaet={setActivity} onMinuten={setMinutes} onGrund={setNote}/>;break;
  case 'kundenbild':body=<Kundenbild kundeId={card.customerId} version={c?c.updatedAt:null} variante={null} name={card.customerName}
    kontaktText={c?[c.phone,c.email].filter(Boolean).join(' · '):card.customerPhone===null?COPY.noFact:card.customerPhone} lage={null}
    zahlung={c?.invoiceOpenCents===undefined?{zustand:'verborgen'}:{zustand:'bekannt',zeilen:[{id:c.id,text:formatEuro(c.invoiceOpenCents)}],leerText:COPY.noFact}}
    vorgaenge={c?{zustand:'bekannt',zeilen:c.orders.map(row=>({id:row.id,elementId:'order.open',text:row.orderNumber+' · '+row.title,onOeffnen:id=>router.push('/orders/'+encodeURIComponent(id))})),leerText:V45_TEXT.customer$orders_empty}:{zustand:'unbekannt',text:COPY.unavailable}}
    absprachen={c?{zustand:'bekannt',zeilen:c.agreements.map(row=>({id:row.id,text:row.label+(row.value===null?'':' · '+row.value)})),leerText:V45_TEXT.customer$agreement_empty}:{zustand:'unbekannt',text:COPY.unavailable}}
    belege={{zustand:'unbekannt',text:COPY.noFact}} belegeTitel={V45_TEXT.customer$tab$files}
    kundenkarte={c?{id:c.id,elementId:'customer.open',text:c.name,onOeffnen:id=>router.push('/customers/'+encodeURIComponent(id))}:null} mail={null} laden={loading}/>;break;
  case 'kv_dokument':body=q?<KVDokument quoteId={q.quoteId} version={q.version} fassung={q.lifecycle?String(q.lifecycle.edition):null} originalId={null}
    variante={q.lifecycle?.stage==='geaendert_seit_versand'?'neue_fassung':q.lifecycle?.sentAt&&q.lifecycle.sentEdition===q.lifecycle.edition?'versendet':q.lifecycle?.stage==='entwurf'?'entwurf':null} titel={V45_TEXT.quote$paper_title} bezug={V45_TEXT.quote$number({number:q.quoteNumber,edition:q.lifecycle?String(q.lifecycle.edition):'—'})}
    kunde={{id:q.customerId,name:q.customerDisplayName,anschrift:[]}} positionen={{zustand:'bekannt',zeilen:q.positions.map(row=>({id:row.id,bezeichnung:row.quantity+' × '+row.name,verfahren:row.surfaceRequested,betrag:row.lineTotalCents===null?{zustand:'verborgen'}:{zustand:'bekannt',text:formatEuro(row.lineTotalCents)}})),leerText:V45_TEXT.common$empty}}
    netto={q.totalNetCents===null?{zustand:'verborgen'}:{zustand:'bekannt',text:formatEuro(q.totalNetCents)}} termin={{zustand:'bekannt',text:q.dueDate}}
    gueltig={q.validUntil===null?{zustand:'unbekannt',grund:COPY.noFact}:{zustand:'bekannt',text:q.validUntil}}
    wuensche={q.lifecycle?.specialRequests?[{id:q.quoteId,text:q.lifecycle.specialRequests}]:[]} bedingung={V45_TEXT.quote$editor_condition} laden={loading}/>:missing;break;
  case 'kv_verlauf':body=q?<KVVerlauf quoteId={q.quoteId} version={q.version} fassung={q.lifecycle?String(q.lifecycle.edition):null} variante={quote?.code==='OK'&&quote.nextActionRule.zustand?quoteVariants[quote.nextActionRule.zustand]??null:null}
    schritte={actors.flatMap(actor=>actor?[{ereignisId:actor.eventId,zeit:actor.at,titel:actor.name===null?COPY.noFact:actor.name,notiz:actor.mailSender,
      beleg:{id:q.quoteId,art:'kv' as const,text:V45_TEXT.progress$source,onOeffnen:(id:string)=>{if(id===q.quoteId)setComponent('kv_dokument');}}}]:[])}
    aktuell={stateText('quote',quote?.code==='OK'?quote.nextActionRule.zustand:null)} danach={null} datenluecken={[COPY.noFact]}
    verlaufOffen={expanded} onVerlaufOffen={setExpanded} laden={loading} deaktiviert={disabled}/>:missing;break;
 }
 return <div data-preview-source-id={card.id} data-source-version={card.version}>
  <p className="muted">{card.orderNumber} · {card.customerName}</p>
  <div className="two"><Formularfeld id="preview-component" label={COPY.component} art="auswahl" wert={component} onWert={value=>{if(Object.hasOwn(COPY.names,value))setComponent(value as Component);}} optionen={Object.entries(COPY.names).map(([wert,text])=>({wert,text}))} laden={false} deaktiviert={false}/>
   <Formularfeld id="preview-state" label={COPY.state} art="auswahl" wert={state} onWert={setState} optionen={[{wert:'normal',text:COPY.normal},{wert:'laden',text:COPY.loading},{wert:'deaktiviert',text:COPY.disabled}]} laden={false} deaktiviert={false}/></div>
  <section className="pn" data-glass="card" data-preview-component={component}>{body}</section>
 </div>;
}
