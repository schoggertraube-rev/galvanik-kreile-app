"use client";
import type { ReactNode } from "react";
import { Button, Eingabe, Feld, Icon, Segment } from "@/ui/kr";
import { orderPositionUnitLabel,orderPositionSurfaceLabel } from "@/lib/orderPositionContract";
import {GOODS_DEVIATION_REASONS} from '../goodsReceiptContract';
import type { GoodsReceiptInput,GoodsReceiptOrderRead,GoodsReceiptPhotoKind } from "../goodsReceiptContract";

export type GoodsInspectionValue=Pick<GoodsReceiptInput,'mode'|'card'|'packagesReceived'|'packagesTotal'|'condition'|'deviations'|'foundUnattended'|'foundAt'|'procedure'|'procedureNote'|'photos'|'quantities'>;
type Props<T extends GoodsInspectionValue>={value:T;order:Pick<GoodsReceiptOrderRead,'customerName'|'fromQuote'|'items'|'note'>;prefix?:"ware"|"eingang";busy:boolean;onChange:(next:T)=>void;onFile:(kind:GoodsReceiptPhotoKind,files:FileList|null)=>void;onOriginal:(fileId:string)=>void};
/** One inspection form, shared by existing-order receipt and the intake's goods section. */
export function GoodsInspectionForm<T extends GoodsInspectionValue>({value,order,prefix="ware",busy,onChange,onFile,onOriginal}:Props<T>){
 const change=(patch:Partial<GoodsInspectionValue>)=>onChange({...value,...patch});
 const partial=value.condition==='teillieferung';
 const complete=[true,value.photos.length>0,value.condition!==null,value.quantities.every(q=>q.confirmed||q.received!==null)];
 const card=(index:number,title:string,body:ReactNode)=><section className={`ev-schritt9${complete[index]?' ev-schritt9--ok':''}${value.card===index?' ev-schritt9--auf':''}`} key={title}>
   <button type="button" className="ev-schritt9-kopf" aria-label={title} aria-describedby={`${prefix}.schritt.${index}.zustand`} disabled={busy} onClick={()=>change({card:index})} aria-expanded={value.card===index}><span className="ev-schritt9-nr">{complete[index]?<Icon name="check"/>:index+1}</span>{title}<span id={`${prefix}.schritt.${index}.zustand`} className="ev-schritt9-st">{complete[index]?'geprüft':'offen'}</span></button>
   <div className="ev-schritt9-inhalt" hidden={value.card!==index} style={value.card===index?undefined:{display:'none'}}>{body}</div>
 </section>;
 return <div className="ev-wp ev-wp--schritte"><div className="ev-wp-kopf"><Icon name="box"/><b>Warenprüfung</b><span>{value.mode==='erwartet'?'erwartete Ware':'Ware liegt vor'}</span></div>
  {card(0,'Wer',<><div className="ev-wp-wer"><Icon name="user"/><strong>{order.customerName??'fehlt'}</strong></div>
   <label className="kr-check"><input data-spec-id={`${prefix}.abgestellt`} type="checkbox" checked={value.foundUnattended} disabled={busy} onChange={e=>change({foundUnattended:e.target.checked,foundAt:e.target.checked?new Date().toISOString():null})}/><span>abgestellt vorgefunden</span></label>
   {value.foundUnattended?<Feld label="Fundzeit"><Eingabe type="datetime-local" value={value.foundAt?new Date(new Date(value.foundAt).getTime()-new Date(value.foundAt).getTimezoneOffset()*60000).toISOString().slice(0,16):''} onChange={e=>{if(e.target.value)change({foundAt:new Date(e.target.value).toISOString()});}}/></Feld>:null}</>)}
  {card(1,'Fotos',<div className="ev-wp-fotos">{([{id:'uebersicht',key:'paket',text:'Paket gesamt'},{id:'teile',key:'teile',text:'Ware/Teile'},{id:'abweichung',key:'abweichung',text:'Abweichung'}] as const).map(kind=>{
   const photos=value.photos.filter(photo=>photo.kind===kind.id);
   return <div key={kind.id} className="kr-stapel"><label role="button" tabIndex={0} onKeyDown={event=>{if(event.key==='Enter'||event.key===' '){event.preventDefault();event.stopPropagation();event.currentTarget.querySelector('input')?.click();}}} className={`ev-wp-foto${photos.length?' ev-wp-foto--ok':''}`} data-spec-id={`${prefix}.foto.${kind.key}`}><Icon name="camera"/><b>{kind.text}</b><input hidden aria-label={kind.text} type="file" accept="image/*" capture="environment" multiple disabled={busy} onChange={e=>{onFile(kind.id,e.target.files);e.target.value='';}}/></label>
    {photos.map((photo,index)=><Button key={photo.fileId} art="leise" text={`Ansehen · Foto ${index+1}`} onClick={()=>onOriginal(photo.fileId)}/>)}</div>;
  })}</div>)}
  {card(2,'Zustand',<><div data-spec-id={`${prefix}.warenzustand`}><Segment label="Zustand" wert={value.condition==='unauffaellig'?'unauffaellig':value.condition==='abweichung'||value.condition==='gefahr'?value.condition:''} optionen={[{wert:'unauffaellig',text:'Unauffällig'},{wert:'abweichung',text:'Abweichung'},{wert:'gefahr',text:'Gefahr'}]} onWert={condition=>{if(condition)change({condition,deviations:condition==='unauffaellig'?[]:value.deviations});}}/></div>
   {value.condition==='abweichung'||value.condition==='gefahr'?<div data-spec-id={`${prefix}.grund`} className="kr-schnellleiste">{GOODS_DEVIATION_REASONS.map(reason=><button type="button" className="kr-btn" key={reason} aria-label={reason} aria-pressed={value.deviations.includes(reason)} onClick={()=>change({deviations:value.deviations.includes(reason)?value.deviations.filter(v=>v!==reason):[...value.deviations,reason]})}>{reason==='verunreinigt'?'verunreinigt – nicht in Galvanik':reason}</button>)}</div>:null}</>)}
  {card(3,'Inhalt',<><div className="ev-wp-zeile"><b>Packstücke</b><div data-spec-id={`${prefix}.packstuecke`} className="kr-schnellleiste"><Button data-spec-id={`${prefix}.packstuecke-minus`} text="−" label="Packstücke weniger" disabled={busy||value.packagesReceived===1} onClick={()=>{const n=Math.max(1,(value.packagesReceived??1)-1);change({packagesReceived:n,packagesTotal:partial?Math.max(n+1,value.packagesTotal??n+1):n});}}/><strong>{value.packagesReceived??'fehlt'} von {value.packagesTotal??'fehlt'}</strong><Button data-spec-id={`${prefix}.packstuecke-plus`} text="+" label="Packstücke mehr" disabled={busy} onClick={()=>{const n=(value.packagesReceived??0)+1;change({packagesReceived:n,packagesTotal:partial?Math.max(n+1,value.packagesTotal??n+1):n});}}/></div>
   <button type="button" className="kr-btn" data-spec-id={`${prefix}.rest-kommt-noch`} aria-pressed={partial} onClick={()=>change({condition:partial?null:'teillieferung',packagesTotal:partial?value.packagesReceived:(value.packagesReceived??1)+1})}>Rest kommt noch</button></div>
   <div className="ev-wp-zeile"><b>Inhalt · erwartet laut Auftrag</b><Button data-spec-id={`${prefix}.alle-stimmen`} icon="check" text="Alle stimmen" disabled={busy} onClick={()=>change({quantities:value.quantities.map(q=>({...q,confirmed:true,received:null}))})}/></div>
   <div className="ev-wp-pos">{order.items.map((item,index)=>{
    const current=value.quantities.find(q=>q.itemId===item.id);if(!current)return <p role="alert" key={item.id}>Position nicht verfügbar · erneut laden</p>;
    const update=(patch:Partial<typeof current>)=>change({quantities:value.quantities.map(q=>q.itemId===item.id?{...q,...patch}:q)});
    return <article key={item.id} data-goods-position={index+1} className="kr-kachel"><div className="kr-kachel-inhalt"><strong>{item.name}</strong><p>erwartet {item.quantity} {item.unit?orderPositionUnitLabel(item.unit):'Einheit fehlt'} · {item.surface?orderPositionSurfaceLabel(item.surface):'Oberfläche fehlt'}</p>
     <button type="button" className="kr-btn" data-spec-id={`${prefix}.position.stimmt`} aria-pressed={current.confirmed} onClick={()=>update({confirmed:!current.confirmed,received:null})}>stimmt</button>
     {!current.confirmed?<Feld label="geliefert"><Eingabe data-spec-id={`${prefix}.position.geliefert`} type="number" min="0" step="any" value={current.received??''} onChange={e=>update({received:e.target.value===''?null:Number(e.target.value)})}/></Feld>:null}
     {!current.confirmed&&current.received!==null&&current.received!==current.expected?<Feld label="Abweichungsgrund"><Eingabe value={current.note??''} onChange={e=>update({note:e.target.value||null})}/></Feld>:null}
     {item.note?<p>{item.note}</p>:null}
    </div></article>;
   })}</div>
   {order.fromQuote?<div data-spec-id={`${prefix}.verfahren`}><Segment label="Verfahren/Termin wie im KV?" wert={value.procedure??''} optionen={[{wert:'stimmt',text:'stimmt'},{wert:'abweichend',text:'abweichend'}]} onWert={procedure=>change({procedure:procedure||null})}/>{value.procedure==='abweichend'?<Feld label="Abweichungsgrund"><Eingabe value={value.procedureNote??''} onChange={e=>change({procedureNote:e.target.value||null})}/></Feld>:null}</div>:null}
   {order.note?<p><b>Hinweise für die Werkstatt:</b> {order.note}</p>:null}
  </>)}
 </div>;
}
