"use client";
import {useState,type ReactNode} from 'react';
import {Button,Icon} from '@/ui/kr';
import type {IntakeCapture} from '../captureContract';
import type {CaptureKind} from '../captureRecognition';
import styles from './IntakeSituation.module.css';

/** Uses secured originals and server candidates only; never guesses an order. */
export function IntakeSituation({capture,kind,busy,primary,onAssign,onOriginal,onOrder,onMore,onEdit,onKind,onTask}:{capture:IntakeCapture;kind:CaptureKind;busy:boolean;primary:ReactNode;onAssign:()=>void;onOriginal:(fileId:string)=>void;onOrder:(orderId:string)=>void;onMore:()=>void;onEdit:()=>void;onKind:(kind:Exclude<CaptureKind,'unklar'>)=>void;onTask?:()=>void}){
 const [alternatives,setAlternatives]=useState(false);
 const original=capture.files.find(file=>file.secured===true);
 const orders=(capture.expectedOrders??[]).filter(order=>!capture.customerId||order.customerId===capture.customerId);
 const pending=capture.files.some(file=>['wartet','laeuft'].includes(file.status));
 const failed=capture.files.some(file=>file.status==='fehler');
 const asking=kind==='ware'&&orders.length!==1||kind==='unklar';
 const title=kind==='notiz'?'Vorschlag: als Aufgabe auf deinen Tag':orders.length>1?orders.length+' passen gleich gut – tipp den richtigen an.':orders.length===1?'Ware zu '+orders[0].number:'Absender nicht erkannt';

 return <section className={styles.root} data-spec-id="rein.situation">
 <div className={styles.heading}>{original?<button className={styles.original} onClick={()=>onOriginal(original.id)} aria-label={'Original ansehen · '+original.name}><Icon name={original.mime.startsWith('image/')?'camera':'file'}/><span>{original.name}</span></button>:null}<div><h2>{title}</h2><p>{kind==='notiz'?"Grund: kein Kunde und kein Vorgang im Text. Der Wortlaut bleibt erhalten.":asking?"Fotografier das Paketetikett, dann ordne ich sie zu.":null}</p></div></div>
 {orders.length===1?<div className={styles.chips} aria-label="Erkannte Angaben"><span>{orders[0].number}</span>{orders[0].customerName?<span>{orders[0].customerName}</span>:null}</div>:null}
 <div className={styles.main}>{pending||busy?<p role="status">{busy?'Wird gesichert …':'Wird gelesen …'}</p>:kind==='notiz'&&onTask?<Button art="primaer" text="Aufgabe anlegen" onClick={onTask}/>:failed?<Button art="primaer" text="Anderen Kunden oder Vorgang wählen" onClick={onAssign}/>:kind==='ware'&&orders.length>1?<div role="group" aria-label="Passende Vorgänge">{orders.slice(0,3).map(order=><Button key={order.id} text={order.number+' · '+(order.customerName??'Kunde fehlt')+' · '+(order.title??'Titel fehlt')} onClick={()=>onOrder(order.id)}/>)}</div>:primary??<Button art="primaer" text="Anderen Kunden oder Vorgang wählen" onClick={onAssign}/>}</div>
 <div className={styles.alternatives}><Button text="Anders zuordnen" onClick={()=>setAlternatives(value=>!value)} aria-expanded={alternatives} disabled={busy}/>{alternatives?<div><Button text="Zuordnung öffnen" onClick={onAssign} disabled={busy}/><Button text="Text ändern" onClick={onEdit} disabled={busy}/>{kind==='unklar'?<div aria-label="Art des Eingangs">{([['anfrage','Auftrag/KV'],['ware','Ware'],['rechnung','Eingangsrechnung'],[capture.files.length?'dokument':'notiz','Dokument/Notiz zum Kunden']] as const).map(([value,label])=><Button key={value} text={label} onClick={()=>onKind(value)} disabled={busy}/>)}</div>:null}</div>:null}</div>
 <Button art="leise" icon="camera" text="Weiteres Foto" onClick={onMore} disabled={busy}/>
 {capture.recognition?.text||capture.text?<details className={styles.text}><summary>Gelesener Text</summary><p>{capture.recognition?.text??capture.text}</p></details>:null}
 </section>;
}
