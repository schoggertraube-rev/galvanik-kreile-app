"use client";
import type {ReactNode} from 'react';
import {Button,Icon} from '@/ui/kr';
import type {IntakeCapture} from '../captureContract';
import type {CaptureKind} from '../captureRecognition';
import styles from './IntakeSituation.module.css';

/** Uses secured originals and server candidates only; never guesses an order. */
export function IntakeSituation({capture,kind,busy,primary,onAssign,onOriginal,onOrder,onMore,onEdit,onKind}:{capture:IntakeCapture;kind:CaptureKind;busy:boolean;primary:ReactNode;onAssign:()=>void;onOriginal:(fileId:string)=>void;onOrder:(orderId:string)=>void;onMore:()=>void;onEdit:()=>void;onKind:(kind:Exclude<CaptureKind,'unklar'>)=>void}){
 const original=capture.files.find(file=>file.secured===true);
 const orders=(capture.expectedOrders??[]).filter(order=>!capture.customerId||order.customerId===capture.customerId);
 const pending=capture.files.some(file=>['wartet','laeuft'].includes(file.status));
 const failed=capture.files.some(file=>file.status==='fehler');
 const asking=kind==='ware'&&orders.length!==1||kind==='unklar';
 const title=pending?'Dein Original wird gelesen.':failed?'Dein Original ist noch nicht lesbar.':kind==='ware'?orders.length>1?'Welche Ware ist angekommen?':orders.length===1?'Deine angekündigte Ware ist da.':'Von wem ist die Ware?':kind==='anfrage'?'Du hast eine Anfrage aufgenommen.':kind==='kontakt'?'Du hast Kontaktdaten aufgenommen.':kind==='rechnung'?'Du hast eine Rechnung aufgenommen.':'Wozu gehört dein Eingang?';
 return <section className={styles.root} data-spec-id="rein.situation">
 <div className={styles.heading}>{original?<button className={styles.original} onClick={()=>onOriginal(original.id)} aria-label={'Original ansehen · '+original.name}><Icon name={original.mime.startsWith('image/')?'camera':'file'}/><span>{original.name}</span></button>:null}<div><h2>{title}</h2><p>{pending?'Du kannst dein gesichertes Original jederzeit öffnen.':asking?'Wähle einen passenden Vorgang oder ordne den Eingang zu. Es wird nichts geraten.':'Dein Original bleibt mit dem nächsten Schritt verbunden.'}</p></div></div>
 <div className={styles.chips} aria-label="Erkannte Angaben">{capture.customerId?<span>Kunde zugeordnet</span>:<span>Kunde noch offen</span>}<span>{capture.files.filter(file=>file.secured===true).length} Originale gesichert</span>{orders.length===1?<span>{orders[0].number}</span>:null}</div>
 <div className={styles.main}>{pending||busy?<p role="status">{busy?'Wird gesichert …':'Wird gelesen …'}</p>:failed?<Button art="primaer" text="Original zuordnen · Lesbarkeit klären" onClick={onAssign}/>:kind==='ware'&&orders.length>1?<div role="group" aria-label="Passende Vorgänge">{orders.slice(0,3).map(order=><Button key={order.id} text={order.number+' · '+(order.customerName??'Kunde fehlt')+' · '+(order.title??'Titel fehlt')} onClick={()=>onOrder(order.id)}/>)}</div>:primary??<Button art="primaer" text="Zuordnen · Kunde klären" onClick={onAssign}/>}</div>
 <details className={styles.alternatives}><summary>Anders zuordnen</summary><Button text="Zuordnung öffnen" onClick={onAssign} disabled={busy}/><Button text="Text ändern" onClick={onEdit} disabled={busy}/>{kind==='unklar'?<div aria-label="Art des Eingangs">{([['anfrage','Auftrag/KV'],['ware','Ware'],['rechnung','Eingangsrechnung'],[capture.files.length?'dokument':'notiz','Dokument/Notiz zum Kunden']] as const).map(([value,label])=><Button key={value} text={label} onClick={()=>onKind(value)} disabled={busy}/>)}</div>:null}</details>
 <Button art="leise" icon="camera" text="Weiteres Foto" onClick={onMore} disabled={busy}/>
 {capture.recognition?.text||capture.text?<details className={styles.text}><summary>Gelesener Text</summary><p>{capture.recognition?.text??capture.text}</p></details>:null}
 </section>;
}
