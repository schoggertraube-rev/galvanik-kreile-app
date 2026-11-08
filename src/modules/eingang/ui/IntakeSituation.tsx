"use client";
import {useEffect,useState,type ReactNode} from 'react';
import Image from 'next/image';
import {Button,Icon} from '@/ui/kr';
import type {IntakeCapture} from '../captureContract';
import type {CaptureKind} from '../captureRecognition';
import styles from './IntakeSituation.module.css';
import {PACKAGE_COPY,resolveIntakeSituation,quoteCandidatePresentation,type IntakeQuoteCandidate,SITUATION_COPY} from '@/ui/situationCatalog';

/** Uses secured originals and server candidates only; never guesses an order. */
export function IntakeSituation({readOriginal,capture,kind,busy,primary,onAssign,onOriginal,onOrder,onMore,onEdit,onKind,onTask,quotes=[],onQuote,onCustomerCandidate}:{readOriginal?:(input:{fileId:string;clientEventId:string})=>Promise<import("../originalContract").OriginalReadResult>;capture:IntakeCapture;kind:CaptureKind;busy:boolean;primary:ReactNode;onAssign:()=>void;onOriginal:(fileId:string)=>void;onOrder:(orderId:string)=>void;onMore:()=>void;onEdit:()=>void;onKind:(kind:Exclude<CaptureKind,'unklar'>)=>void;onTask?:()=>void;quotes?:IntakeQuoteCandidate[];onCustomerCandidate?:(customerId:string)=>void;onQuote?:(id:string)=>void}){
 const [alternatives,setAlternatives]=useState(false);
 const original=capture.files.find(file=>file.secured===true);
 const[preview,setPreview]=useState<{id:string;url:string}|null>(null);
 const originalId=original?.mime.startsWith('image/')?original.id:null;
 useEffect(()=>{if(!originalId||!readOriginal)return;let active=true;void readOriginal({fileId:originalId,clientEventId:crypto.randomUUID()}).then(result=>{if(active&&result.code==='OK'&&result.original.previewable&&result.original.url)setPreview({id:originalId,url:result.original.url});}).catch(cause=>console.error('[INTAKE_SITUATION_PREVIEW_FAILED]',cause instanceof Error?cause.name:'UnknownError'));return()=>{active=false;};},[originalId,readOriginal]);
 const orders=(capture.expectedOrders??[]).filter(order=>!capture.customerId||order.customerId===capture.customerId);
 const pending=capture.files.some(file=>['wartet','laeuft'].includes(file.status));
 const failed=capture.files.some(file=>file.status==='fehler');
 const candidates=[...quotes.map(quoteCandidatePresentation),...orders.map(order=>({id:order.id,kind:'order' as const,label:order.number+' · '+(order.customerName??'')+' · '+(order.title??''),reason:order.reason==='rework'?PACKAGE_COPY.rework:PACKAGE_COPY.waiting}))];
 const onlyQuote=quotes.length===1&&orders.length===0?quotes[0]:null;
 const view=resolveIntakeSituation({originalCount:capture.files.filter(file=>file.secured===true).length,recognizedText:Boolean(capture.recognition?.text),kind,customerId:capture.customerId,candidates,...(onlyQuote?{context:'quote' as const,quote:{...onlyQuote,sent:true},match:'chosen' as const}:{}),recognized:orders.length===1?[{label:'Auftrag',value:orders[0].number},{label:'Kunde',value:orders[0].customerName}]:[]});

 return <section className={styles.root} data-spec-id="rein.situation">
 <div className={styles.heading}>{original?<button className={styles.original} onClick={()=>onOriginal(original.id)} aria-label={SITUATION_COPY.original+' · '+original.name}>{preview?.id===original.id?<Image src={preview.url} width={72} height={72} alt={original.name} unoptimized/>:<Icon name={original.mime.startsWith('image/')?'camera':'file'}/>}<span>{original.name}</span></button>:null}<div><h2>{view.title}</h2><p>{view.sentence}</p></div></div>
 {view.chips.length?<div className={styles.chips} aria-label="Erkannte Angaben">{view.chips.map(chip=><span key={chip.label}>{chip.value}</span>)}</div>:null}
 {kind==='ware'&&capture.packageContext?.status==='UNAVAILABLE'?<p role="alert">{PACKAGE_COPY.unavailable}</p>:null}
 {kind==='ware'&&!capture.customerId&&capture.packageContext?.status==='OK'&&capture.packageContext.customers.length>0&&onCustomerCandidate?<div role="group" aria-label={PACKAGE_COPY.candidateTitle}><p>{PACKAGE_COPY.history}</p>{capture.packageContext.customers.map(customer=><Button key={customer.customerId} text={PACKAGE_COPY.customer(customer.customerName)} disabled={busy} onClick={()=>onCustomerCandidate(customer.customerId)}/>)}</div>:null}
 <div className={styles.main}>{pending||busy?<p role="status">{busy?SITUATION_COPY.pendingSave:SITUATION_COPY.pendingRead}</p>:kind==='notiz'&&onTask?<Button art="primaer" text={SITUATION_COPY.task} onClick={onTask}/>:failed?<Button art="primaer" text={SITUATION_COPY.assignment} onClick={onAssign}/>:kind==='ware'&&quotes.length>0?<div role="group" aria-label="Passende Vorgänge">{candidates.slice(0,3).map(candidate=><div key={candidate.kind+candidate.id}><Button text={onlyQuote&&view.primary?view.primary.label:candidate.label} onClick={()=>candidate.kind==='quote'?onQuote?.(candidate.id):onOrder(candidate.id)}/><p>{candidate.reason}</p></div>)}</div>:kind==='ware'&&orders.length>1?<div role="group" aria-label="Passende Vorgänge">{orders.slice(0,3).map(order=><Button key={order.id} text={view.candidates.find(candidate=>candidate.id===order.id)?.label??order.number} onClick={()=>onOrder(order.id)}/>)}</div>:kind==='ware'&&candidates.length===0&&onTask?<Button art="primaer" text={view.fallback.label} onClick={onTask}/>:primary??<Button art="primaer" text={SITUATION_COPY.assignment} onClick={onAssign}/>}</div>
 <div className={styles.alternatives}><Button text={SITUATION_COPY.alternatives} onClick={()=>setAlternatives(value=>!value)} aria-expanded={alternatives} disabled={busy}/>{alternatives?<div>{primary||view.primary||kind==='ware'&&candidates.length===0&&onTask?<Button text={SITUATION_COPY.assignment} onClick={onAssign} disabled={busy}/>:null}<Button text={SITUATION_COPY.editText} onClick={onEdit} disabled={busy}/>{kind==='unklar'?<div aria-label="Art des Eingangs">{([['anfrage','Auftrag/KV'],['ware','Ware'],['rechnung','Eingangsrechnung'],[capture.files.length?'dokument':'notiz','Dokument/Notiz zum Kunden']] as const).map(([value])=><Button key={value} text={SITUATION_COPY.kindLabels[value]} onClick={()=>onKind(value)} disabled={busy}/>)}</div>:null}</div>:null}</div>
 <Button art="leise" icon="camera" text={SITUATION_COPY.morePhoto} onClick={onMore} disabled={busy}/>
 {capture.recognition?.text||capture.text?<details className={styles.text}><summary>{SITUATION_COPY.readText}</summary><p>{capture.recognition?.text??capture.text}</p></details>:null}
 </section>;
}
