"use client";
import {useEffect,useState,type ReactNode} from 'react';
import Image from 'next/image';
import {Button,Icon} from '@/ui/kr';
import type {IntakeCapture} from '../captureContract';
import type {CaptureKind} from '../captureRecognition';
import styles from './IntakeSituation.module.css';
import {RESULT_COPY,type SituationResultPresentation,PACKAGE_COPY,resolveIntakeSituation,quoteCandidatePresentation,type IntakeQuoteCandidate,SITUATION_COPY} from '@/ui/situationCatalog';

type ResultOriginal={id:string;name:string;mime:string};
export function IntakeResultOriginal({originals,readOriginal,onOpen}:{originals:readonly ResultOriginal[];readOriginal?:(input:{fileId:string;clientEventId:string})=>Promise<import('../originalContract').OriginalReadResult>;onOpen:(fileId:string)=>void}){
 const first=originals[0],id=first?.id;
 const [preview,setPreview]=useState<{id:string;url:string}|null>(null);
 useEffect(()=>{if(!id||!readOriginal)return;let active=true;void readOriginal({fileId:id,clientEventId:crypto.randomUUID()}).then(result=>{if(active&&result.code==='OK'&&result.original.previewable&&result.original.url)setPreview({id,url:result.original.url});}).catch(cause=>console.error('[INTAKE_RESULT_ORIGINAL_READ_FAILED]',cause instanceof Error?cause.name:'UnknownError'));return()=>{active=false;};},[id,readOriginal]);
 if(!first)return null;
 return <button type="button" onClick={()=>onOpen(first.id)} aria-label={RESULT_COPY.original+' · '+first.name}>{preview?.id===first.id?first.mime.startsWith('image/')?<Image src={preview.url} width={480} height={360} alt={first.name} unoptimized/>:<iframe title={first.name} src={preview.url} className={styles.pdf} tabIndex={-1} aria-hidden="true"/>:<Icon name={first.mime.startsWith('image/')?'camera':'file'}/>}<span>{first.name}</span>{originals.length>1?<span className={styles.count}>{RESULT_COPY.originals(originals.length-1)}</span>:null}</button>;
}

/** One factual result layout for capture and its existing editors; no state is stored here. */
export function IntakeResultHeader({title,presentation,original,originalCount,children,footer}:{title:string;presentation:SituationResultPresentation;original:ReactNode;originalCount:number;children?:ReactNode;footer?:ReactNode}){
 const facts=presentation.facts.filter((fact):fact is typeof fact&{value:string}=>typeof fact.value==='string'&&Boolean(fact.value.trim()));
 const status=presentation.status==='done'?RESULT_COPY.done:presentation.status==='missing'?RESULT_COPY.missing(presentation.missing):RESULT_COPY.waiting(presentation.waiting??RESULT_COPY.confirmation);
 return <div className={styles.result} data-no-original={originalCount===0}>{originalCount>0?<div className={styles.source}>{original}</div>:null}<div className={styles.resultContent}><span className={styles.status} data-result-status={presentation.status}>{status}</span><h2>{title}</h2>{facts.length?<dl className={styles.facts}>{facts.map(fact=><div key={fact.label}><dt>{fact.label}</dt><dd className={fact.emphasis?styles.emphasis:undefined}>{fact.value}</dd></div>)}</dl>:null}{children}</div>{footer?<footer className={styles.resultFooter}>{footer}</footer>:null}</div>;
}

/** Uses secured originals and server candidates only; never guesses an order. */
export function IntakeSituation({readOriginal,capture,kind,busy,primary,onAssign,onOriginal,onOrder,onMore,onEdit,onKind,onTask,quotes=[],onQuote,onCustomerCandidate}:{readOriginal?:(input:{fileId:string;clientEventId:string})=>Promise<import("../originalContract").OriginalReadResult>;capture:IntakeCapture;kind:CaptureKind;busy:boolean;primary:ReactNode;onAssign:()=>void;onOriginal:(fileId:string)=>void;onOrder:(orderId:string)=>void;onMore:()=>void;onEdit:()=>void;onKind:(kind:Exclude<CaptureKind,'unklar'>)=>void;onTask?:()=>void;quotes?:IntakeQuoteCandidate[];onCustomerCandidate?:(customerId:string)=>void;onQuote?:(id:string)=>void}){
 const [alternatives,setAlternatives]=useState(false);
 const orders=(capture.expectedOrders??[]).filter(order=>!capture.customerId||order.customerId===capture.customerId);
 const pending=capture.files.some(file=>['wartet','laeuft'].includes(file.status));
 const failed=capture.files.some(file=>file.status==='fehler');
 const candidates=[...quotes.map(quoteCandidatePresentation),...orders.map(order=>({id:order.id,kind:'order' as const,label:order.number+' · '+(order.customerName??'')+' · '+(order.title??''),reason:order.reason==='rework'?PACKAGE_COPY.rework:PACKAGE_COPY.waiting}))];
 const onlyQuote=quotes.length===1&&orders.length===0?quotes[0]:null;
 const view=resolveIntakeSituation({originalCount:capture.files.filter(file=>file.secured===true).length,recognizedText:Boolean(capture.recognition?.text),kind,customerId:capture.customerId,candidates,...(onlyQuote?{context:'quote' as const,quote:{...onlyQuote,sent:true},match:'chosen' as const}:{}),recognized:orders.length===1?[{label:'Auftrag',value:orders[0].number},{label:'Kunde',value:orders[0].customerName}]:[]});

 const resultAction=<div className={styles.main}>{pending||busy?<p role="status">{busy?SITUATION_COPY.pendingSave:SITUATION_COPY.pendingRead}</p>:kind==='notiz'&&onTask?<Button art="primaer" text={SITUATION_COPY.task} onClick={onTask}/>:failed?<Button art="primaer" text={SITUATION_COPY.assignment} onClick={onAssign}/>:kind==='ware'&&quotes.length>0?<div role="group" aria-label="Passende Vorgänge">{candidates.slice(0,3).map(candidate=><div key={candidate.kind+candidate.id}><Button art={onlyQuote?'primaer':'standard'} text={onlyQuote&&view.primary?view.primary.label:candidate.label} onClick={()=>candidate.kind==='quote'?onQuote?.(candidate.id):onOrder(candidate.id)}/><p>{candidate.reason}</p></div>)}</div>:kind==='ware'&&orders.length>1?<div role="group" aria-label="Passende Vorgänge">{orders.slice(0,3).map(order=><Button key={order.id} text={view.candidates.find(candidate=>candidate.id===order.id)?.label??order.number} onClick={()=>onOrder(order.id)}/>)}</div>:kind==='ware'&&candidates.length===0&&onTask?<Button art="primaer" text={view.fallback.label} onClick={onTask}/>:primary??<Button art="primaer" text={SITUATION_COPY.assignment} onClick={onAssign}/>}</div>;
 return <section className={styles.root} data-spec-id="rein.situation">
 <IntakeResultHeader title={view.title} presentation={{status:failed?'missing':pending||busy?'waiting':view.status,missing:failed?[RESULT_COPY.recognition]:view.missing,waiting:pending||busy?RESULT_COPY.recognition:view.waiting,facts:view.facts}} originalCount={capture.files.filter(file=>file.secured===true).length} original={<IntakeResultOriginal originals={capture.files.filter(file=>file.secured===true)} readOriginal={readOriginal} onOpen={onOriginal}/>} footer={resultAction}><p>{view.sentence}</p> {kind==='ware'&&capture.packageContext?.status==='UNAVAILABLE'?<p role="alert">{PACKAGE_COPY.unavailable}</p>:null}
 {kind==='ware'&&!capture.customerId&&capture.packageContext?.status==='OK'&&capture.packageContext.customers.length>0&&onCustomerCandidate?<div role="group" aria-label={PACKAGE_COPY.candidateTitle}><p>{PACKAGE_COPY.history}</p>{capture.packageContext.customers.map(customer=><Button key={customer.customerId} text={PACKAGE_COPY.customer(customer.customerName)} disabled={busy} onClick={()=>onCustomerCandidate(customer.customerId)}/>)}</div>:null}
 <div className={styles.alternatives}><Button text={SITUATION_COPY.alternatives} onClick={()=>setAlternatives(value=>!value)} aria-expanded={alternatives} disabled={busy}/>{alternatives?<div>{primary||view.primary||kind==='ware'&&candidates.length===0&&onTask?<Button text={SITUATION_COPY.assignment} onClick={onAssign} disabled={busy}/>:null}<Button text={SITUATION_COPY.editText} onClick={onEdit} disabled={busy}/>{kind==='unklar'?<div aria-label="Art des Eingangs">{([['anfrage','Auftrag/KV'],['ware','Ware'],['rechnung','Eingangsrechnung'],[capture.files.length?'dokument':'notiz','Dokument/Notiz zum Kunden']] as const).map(([value])=><Button key={value} text={SITUATION_COPY.kindLabels[value]} onClick={()=>onKind(value)} disabled={busy}/>)}</div>:null}</div>:null}</div>
 <Button art="leise" icon="camera" text={SITUATION_COPY.morePhoto} onClick={onMore} disabled={busy}/>
 {capture.recognition?.text||capture.text?<details className={styles.text}><summary>{SITUATION_COPY.readText}</summary><p>{capture.recognition?.text??capture.text}</p></details>:null}</IntakeResultHeader>
 </section>;
}
