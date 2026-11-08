import "server-only";
import {createHash} from "node:crypto";
import {sql} from "drizzle-orm";
import {hasAuthorizationArea,resolveAuthorization,type AuthorizationSnapshot} from "@/lib/server/authorization";
import {withPrivilegedTenantTransaction,type PrivilegedTenantTransaction} from "@/lib/server/privilegedDb";
import {readGoodsReceiptOrder,updateGoodsReceiptOrder,readGoodsReceiptEvent,appendGoodsReceiptEvent,type GoodsReceiptOrder} from "@/lib/server/goodsReceiptOrderPort";
import {orderPositionQuantityError} from "@/lib/orderPositionContract";
import {goodsReceiptGaps,goodsReceiptWare,parseGoodsReceiptInput,type GoodsReceiptInput,type GoodsReceiptRecord,type GoodsReceiptFailure,type GoodsReceiptReadResult} from "../goodsReceiptContract";
import {bindIntakeOriginalToOrder} from "./intakeOrderBinding";

import {quoteHasCreatedOrder} from '@/lib/server/quoteGoodsContextPort';
import {saveQuoteGoodsReceipt} from './quoteGoodsReceipt';

type ReceiptRow=GoodsReceiptRecord;
type Failure=GoodsReceiptFailure;
export type GoodsReceiptResult={code:"OK";receipt:ReceiptRow;replayed:boolean}|Failure;
export type GoodsReceiptDependencies={
 createMissingTask?:(tx:PrivilegedTenantTransaction,auth:AuthorizationSnapshot,input:{orderId:string;missing:string[];clientKey:string})=>Promise<string>;
 createDeviationReply?:(tx:PrivilegedTenantTransaction,auth:AuthorizationSnapshot,input:{orderId:string;receiptId:string;fileIds:string[]})=>Promise<void>;
};
class InspectionFailure extends Error{constructor(public result:Failure){super(result.message);}}
function fail(code:Failure["code"],message:string):never{throw new InspectionFailure({code,message});}
function intent(input:GoodsReceiptInput){const {expectedVersion:_receiptVersion,expectedOrderVersion:_orderVersion,clientEventId:_event,...fields}=input;void _receiptVersion;void _orderVersion;void _event;return createHash('sha256').update(JSON.stringify(fields)).digest('hex');}
const receiptProjection=sql`id::text,client_key::text,item_id::text,auftrag_id,kv_id::text,kv_fassung,lagerort,modus,status,version,karte,packstuecke_da,packstuecke_gesamt,zustand,abweichung,abgestellt,fund_zeit::text,verfahren_wie_kv,verfahren_abweichung,fotos,mengen,offen,bestaetigt_von::text`;
async function readReceipt(tx:PrivilegedTenantTransaction,auth:AuthorizationSnapshot,id:string){const rows=await tx.execute<ReceiptRow>(sql`SELECT ${receiptProjection} FROM public.goods_receipt WHERE tenant_id=${auth.tenantId} AND id=${id}::uuid`);return rows.length===1?rows[0]:null;}
function receiptSnapshot(value:unknown):ReceiptRow|null{
 if(!value||typeof value!=='object'||Array.isArray(value))return null;const row=value as Record<string,unknown>;
 if(typeof row.id!=='string'||typeof row.client_key!=='string'||typeof row.auftrag_id!=='string'||typeof row.modus!=='string'||typeof row.status!=='string'
  ||typeof row.version!=='number'||!Number.isSafeInteger(row.version)||row.version<1||!Array.isArray(row.fotos)||!Array.isArray(row.mengen)||!Array.isArray(row.offen)||row.offen.some(v=>typeof v!=='string')
  ||!(row.item_id===null||typeof row.item_id==='string')||!(row.bestaetigt_von===null||typeof row.bestaetigt_von==='string'))return null;
 if(!Number.isInteger(row.karte)||typeof row.abgestellt!=="boolean"||!Array.isArray(row.abweichung))return null;
 return row as GoodsReceiptRecord;
}
type Prepared={input:GoodsReceiptInput;order:GoodsReceiptOrder|null;before:ReceiptRow|null;gaps:string[];ware:ReturnType<typeof goodsReceiptWare>;packaging:boolean;hash:string;replay:ReceiptRow|null};

async function prepare(tx:PrivilegedTenantTransaction,auth:AuthorizationSnapshot,input:GoodsReceiptInput,deps:GoodsReceiptDependencies):Promise<Prepared>{
 await tx.execute(sql`SELECT pg_advisory_xact_lock(hashtextextended('goods-receipt:'||${auth.tenantId}||':'||${input.clientKey},0))`);
 const hash=intent(input);const prior=input.itemId?await tx.execute<{payload:Record<string,unknown>}>(sql`SELECT nachher AS payload FROM public.intake_event WHERE tenant_id=${auth.tenantId} AND item_id=${input.itemId}::uuid AND art='ware' AND befehl_id=${input.clientEventId}::uuid`):await readGoodsReceiptEvent(tx,auth,input.clientEventId);
 const before=await readReceipt(tx,auth,input.id);
 if(prior.length){
  if(prior.length!==1||prior[0].payload.intent!==hash||prior[0].payload.receiptId!==input.id||!before)fail('CONFLICT','Diese Speicherung wurde bereits anders verwendet.');
  const original=receiptSnapshot(prior[0].payload.after??prior[0].payload);if(!original||original.id!==input.id||original.auftrag_id!==input.orderId)fail('UNAVAILABLE','Wiederholungsbeleg ist nicht lesbar. Fehlercode: GOODS_RECEIPT_REPLAY_INVALID.');
  return {input,order:null,before,gaps:[],ware:'erwartet',packaging:false,hash,replay:original};
 }
 if(before&&(before.client_key!==input.clientKey||before.auftrag_id!==input.orderId||before.modus!==input.mode||before.item_id!==null&&before.item_id!==input.itemId))fail('CONFLICT','Die Prüfkennung gehört zu einem anderen Vorgang.');
 if(before&&before.status!=='entwurf')fail('CONFLICT','Diese Warenannahme ist bereits bestätigt. Erneut öffnen liest den gespeicherten Beleg.');
 if((before?.version??0)!==input.expectedVersion)fail('CONFLICT','Warenprüfung wurde inzwischen geändert. Eingaben bleiben erhalten.');
 const order=await readGoodsReceiptOrder(tx,auth,input.orderId);
 if(!order)fail('NOT_FOUND','Auftrag nicht verfügbar.');
 if(order.version!==input.expectedOrderVersion)fail('CONFLICT','Auftrag wurde inzwischen geändert. Bitte abgleichen.');
 if(order.station==='abgeholt'||order.status==='storniert'||!order.items.length)fail('VALIDATION_ERROR','Für diesen Auftrag ist keine Warenannahme möglich.');
 for(const row of input.quantities){const stored=order.items.find(item=>item.id===row.itemId);if(!stored||stored.quantity!==row.expected||(row.received!==null&&row.received>0&&orderPositionQuantityError(row.received,stored.unit)!==null))fail('VALIDATION_ERROR','Eine Position oder Menge passt nicht mehr zum Auftrag.');}
 if(input.itemId){const sources=await tx.execute<{kunde_id:string|null;vorgang_id:string|null}>(sql`SELECT kunde_id,vorgang_id FROM public.intake_item WHERE tenant_id=${auth.tenantId} AND id=${input.itemId}::uuid FOR UPDATE`);
  if(sources.length!==1||sources[0].kunde_id&&sources[0].kunde_id!==order.customerId||sources[0].vorgang_id&&sources[0].vorgang_id!==order.id)fail('CONFLICT','Originale gehören nicht zu diesem Auftrag.');}
 if(input.photos.length){
  if(!input.itemId)fail('VALIDATION_ERROR','Der Eingang zu den Fotos fehlt.');
  const photos=await tx.execute<{id:string}>(sql`SELECT file.id::text FROM public.intake_file file JOIN public.intake_item source ON source.tenant_id=file.tenant_id AND source.id=file.item_id
   WHERE file.tenant_id=${auth.tenantId} AND file.id=ANY(ARRAY[${sql.join(input.photos.map(photo=>sql`${photo.fileId}`),sql`, `)}]::uuid[])
    AND (file.item_id=${input.itemId}::uuid OR source.vorgang_id=${order.id}) AND file.mime LIKE 'image/%'
    AND EXISTS(SELECT 1 FROM public.intake_event secured WHERE secured.tenant_id=file.tenant_id AND secured.item_id=file.item_id AND secured.art='original_gespeichert' AND secured.nachher->>'fileId'=file.id::text) ORDER BY file.id FOR SHARE OF source,file`);
  if(photos.length!==input.photos.length)fail('VALIDATION_ERROR','Ein Pflichtfoto ist noch nicht sicher gespeichert. Originale bleiben erhalten.');
 }
 const gaps=goodsReceiptGaps(input,order.fromQuote);
 if(input.quantities.length!==order.items.length&&!gaps.includes('Positionen prüfen'))gaps.push('Positionen prüfen');
 const ware=input.procedure==='abweichend'?'abweichung':goodsReceiptWare(input);
 const packaging=input.condition==='abweichung'&&ware==='da';
 if(input.command!=='draft'){
  if(!input.condition)fail('VALIDATION_ERROR','Zustand fehlt.');
  if(input.command==='galvanik'&&gaps.length)fail('VALIDATION_ERROR','Noch offen: '+gaps.join(', '));
  if(gaps.length&&!deps.createMissingTask)fail('UNAVAILABLE','Fehlende Angaben müssen als Aufgabe gesichert werden. Fehlercode: GOODS_MISSING_TASK_CONTRACT_PENDING.');
  if(packaging&&!deps.createDeviationReply)fail('UNAVAILABLE','Der Antwortvorschlag zur Verpackungsabweichung fehlt. Fehlercode: GOODS_DEVIATION_REPLY_CONTRACT_PENDING.');
 }
 return {input,order,before,gaps,ware,packaging,hash,replay:null};
}

async function write(tx:PrivilegedTenantTransaction,auth:AuthorizationSnapshot,prepared:Prepared,deps:GoodsReceiptDependencies,aggregateMode:"increment"|"station"|"creation"="increment"):Promise<GoodsReceiptResult>{
 if(prepared.replay)return {code:'OK',receipt:prepared.replay,replayed:true};
 const {input,order,before,gaps,ware,packaging,hash}=prepared;
 if(!order)throw Error('GOODS_RECEIPT_ORDER_PREFLIGHT_MISSING');
 const status=input.command==='draft'?'entwurf':input.command==='galvanik'?'galvanik':'angenommen';
 const quantities=input.quantities.map(row=>({teil_id:row.itemId,erwartet:row.expected,bestaetigt:row.confirmed?row.expected:row.received,geaendert:!row.confirmed,hinweis:row.note}));
 const taskId=status!=='entwurf'&&gaps.length?await deps.createMissingTask!(tx,auth,{orderId:order.id,missing:gaps,clientKey:input.clientKey}):null;
 let orderVersion=order.version;
 if(status!=='entwurf')orderVersion=await updateGoodsReceiptOrder(tx,auth,order,ware,aggregateMode);
 if(before)await tx.execute(sql`UPDATE public.goods_receipt SET item_id=${input.itemId}::uuid,status=${status},karte=${input.card},packstuecke_da=${input.packagesReceived},packstuecke_gesamt=${input.packagesTotal},zustand=${input.condition},
   abweichung=ARRAY[${sql.join(input.deviations.map(value=>sql`${value}`),sql`, `)}]::text[],abgestellt=${input.foundUnattended},fund_zeit=${input.foundAt}::timestamptz,verfahren_wie_kv=${input.procedure},verfahren_abweichung=${input.procedureNote},
   fotos=${JSON.stringify(input.photos)}::jsonb,mengen=${JSON.stringify(quantities)}::jsonb,offen=ARRAY[${sql.join(gaps.map(value=>sql`${value}`),sql`, `)}]::text[],aufgabe_id=${taskId}::uuid,
   bestaetigt_von=${status==='entwurf'?null:auth.userId}::uuid,bestaetigt_am=${status==='entwurf'?sql`NULL`:sql`statement_timestamp()`},version=version+1,geaendert_am=statement_timestamp()
   WHERE tenant_id=${auth.tenantId} AND id=${input.id}::uuid AND version=${input.expectedVersion}`);
 else await tx.execute(sql`INSERT INTO public.goods_receipt(id,tenant_id,client_key,item_id,auftrag_id,modus,status,karte,packstuecke_da,packstuecke_gesamt,zustand,abweichung,abgestellt,fund_zeit,verfahren_wie_kv,verfahren_abweichung,fotos,mengen,offen,aufgabe_id,bestaetigt_von,bestaetigt_am)
  VALUES(${input.id}::uuid,${auth.tenantId},${input.clientKey}::uuid,${input.itemId}::uuid,${order.id},${input.mode},${status},${input.card},${input.packagesReceived},${input.packagesTotal},${input.condition},ARRAY[${sql.join(input.deviations.map(value=>sql`${value}`),sql`, `)}]::text[],
   ${input.foundUnattended},${input.foundAt}::timestamptz,${input.procedure},${input.procedureNote},${JSON.stringify(input.photos)}::jsonb,${JSON.stringify(quantities)}::jsonb,ARRAY[${sql.join(gaps.map(value=>sql`${value}`),sql`, `)}]::text[],${taskId}::uuid,
   ${status==='entwurf'?null:auth.userId}::uuid,${status==='entwurf'?sql`NULL`:sql`statement_timestamp()`})`);
 const receipt=await readReceipt(tx,auth,input.id);if(!receipt||receipt.version!==input.expectedVersion+1)throw Error('GOODS_RECEIPT_READBACK_INVALID');
 if(input.itemId)await bindIntakeOriginalToOrder(tx,auth,{itemId:input.itemId,orderId:order.id,customerId:order.customerId,clientEventId:input.clientEventId,complete:status!=='entwurf'});
 if(aggregateMode!=='station')await appendGoodsReceiptEvent(tx,auth,{clientEventId:input.clientEventId,orderId:order.id,receiptId:input.id,version:orderVersion,intent:hash,before,after:receipt});
 if(input.itemId)await tx.execute(sql`INSERT INTO public.intake_event(tenant_id,item_id,art,befehl_id,von,vorher,nachher)
   VALUES(${auth.tenantId},${input.itemId}::uuid,'ware',${input.clientEventId}::uuid,${auth.userId},${JSON.stringify(before)}::jsonb,${JSON.stringify({after:receipt,receiptId:input.id,intent:hash})}::jsonb)`);
 if(packaging&&status!=='entwurf')await deps.createDeviationReply!(tx,auth,{orderId:order.id,receiptId:input.id,fileIds:input.photos.map(photo=>photo.fileId)});
 return {code:'OK',receipt,replayed:false};
}

export async function saveGoodsReceipt(input:unknown,deps:GoodsReceiptDependencies={}):Promise<GoodsReceiptResult>{
 if(input&&typeof input==='object'&&'quoteId'in input)return saveQuoteGoodsReceipt(input);
 const parsed=parseGoodsReceiptInput(input);if(!parsed||parsed.command==='galvanik')return {code:'VALIDATION_ERROR',message:'Warenprüfung ist ungültig.'};
 const auth=await resolveAuthorization();if(!auth.ok)return {code:'UNAUTHENTICATED',message:auth.message};
 if(!hasAuthorizationArea(auth.data,'eingang'))return {code:'FORBIDDEN',message:'Warenannahme erfordert Eingang.'};
 try{return await withPrivilegedTenantTransaction(auth.data,async tx=>write(tx,auth.data,await prepare(tx,auth.data,parsed,deps),deps));}
 catch(error){console.error('[GOODS_RECEIPT_WRITE_FAILED]',error);return error instanceof InspectionFailure?error.result:{code:'UNAVAILABLE',message:'Warenprüfung konnte nicht sicher gespeichert werden. Fehlercode: GOODS_RECEIPT_WRITE_FAILED.'};}
}
export function createGoodsReceiptStationBinding(input:GoodsReceiptInput,deps:GoodsReceiptDependencies={}){
 let prepared:Prepared|null=null;let result:GoodsReceiptResult|null=null;
 return {before:async(tx:PrivilegedTenantTransaction,auth:AuthorizationSnapshot)=>{try{if(!hasAuthorizationArea(auth,'eingang'))fail('FORBIDDEN','Warenannahme erfordert Eingang.');prepared=await prepare(tx,auth,input,deps);if(prepared.order)return {orderId:prepared.order.id,expectedVersion:prepared.order.version,ware:prepared.ware};}catch(error){if(error instanceof InspectionFailure)result=error.result;throw error;}},
  after:async(tx:PrivilegedTenantTransaction,auth:AuthorizationSnapshot)=>{try{if(!prepared)throw Error('GOODS_RECEIPT_PREFLIGHT_MISSING');result=await write(tx,auth,prepared,deps,'station');}catch(error){if(error instanceof InspectionFailure)result=error.result;throw error;}},result:()=>result};
}
/** Used by the existing intake command after it created the order, in that same transaction. */
export async function writeCreatedOrderGoodsReceipt(tx:PrivilegedTenantTransaction,auth:AuthorizationSnapshot,input:GoodsReceiptInput,deps:GoodsReceiptDependencies={}){
 const parsed=parseGoodsReceiptInput(input);if(!parsed||parsed.mode!=='erfassung'||parsed.command!=='accept')fail('VALIDATION_ERROR','Warenprüfung der Erfassung ist ungültig.');
 return write(tx,auth,await prepare(tx,auth,parsed,deps),deps,'creation');
}
export async function readGoodsReceipts(orderId:string):Promise<GoodsReceiptReadResult>{
 if(typeof orderId!=="string"||!orderId.trim()||orderId.length>128)return {code:'VALIDATION_ERROR',message:'Auftragskennung fehlt.'};
 const auth=await resolveAuthorization();if(!auth.ok)return {code:'UNAUTHENTICATED' as const,message:auth.message};
 if(!hasAuthorizationArea(auth.data,'eingang')&&!hasAuthorizationArea(auth.data,'auftraege'))return {code:'FORBIDDEN' as const,message:'Warenprüfung ist nicht freigegeben.'};
 try{return await withPrivilegedTenantTransaction(auth.data,async tx=>{
  const order=await readGoodsReceiptOrder(tx,auth.data,orderId);if(!order)return {code:'NOT_FOUND' as const,message:'Auftrag nicht verfügbar.'};
  const receipts=await tx.execute<ReceiptRow>(sql`SELECT ${receiptProjection} FROM public.goods_receipt WHERE tenant_id=${auth.data.tenantId} AND auftrag_id=${orderId} ORDER BY erstellt_am,id`);
  return {code:'OK' as const,order,receipts,canStartGalvanik:hasAuthorizationArea(auth.data,'auftraege')};
 });}
 catch(error){console.error('[GOODS_RECEIPT_READ_FAILED]',error);return {code:'UNAVAILABLE' as const,message:'Warenprüfung konnte nicht geladen werden. Fehlercode: GOODS_RECEIPT_READ_FAILED.'};}
}

/** Attach the same early receipt after the canonical quote/order event, in that transaction. */
export async function bindQuoteGoodsReceiptToCreatedOrder(tx:PrivilegedTenantTransaction,auth:AuthorizationSnapshot,input:{quoteId:string;receiptId:string;clientEventId:string;orderId:string;items:readonly {id:string;quantity:number}[]}){
 if(!hasAuthorizationArea(auth,'eingang')&&!await quoteHasCreatedOrder(tx,auth.tenantId,input.quoteId,input.orderId))fail('FORBIDDEN','Warenbindung benötigt den wirklichen KV-Auftrag.');
 const locked=await tx.execute<{id:string;cleared:unknown}>(sql`SELECT receipt.id::text,projection.abweichung_geklaert AS cleared FROM public.goods_receipt receipt JOIN public.v_quote_goods_receipt_v1 projection ON projection.tenant_id=receipt.tenant_id AND projection.id=receipt.id
 WHERE receipt.tenant_id=${auth.tenantId} AND receipt.kv_id=${input.quoteId}::uuid AND receipt.status='angenommen'
 AND NOT EXISTS(SELECT 1 FROM public.intake_event returned WHERE returned.tenant_id=receipt.tenant_id AND returned.art='ware' AND returned.nachher->>'action'='kv.ware_zurueckgegeben' AND returned.nachher->>'receiptId'=receipt.id::text)
 ORDER BY receipt.id FOR UPDATE OF receipt`);
 const before:ReceiptRow[]=[];
 for(const row of locked){const receipt=await readReceipt(tx,auth,row.id);if(!receipt||!receipt.item_id)fail('VALIDATION_ERROR','Angenommener KV-Warenbeleg fehlt.');before.push(receipt);}
 const primary=before.find(row=>row.id===input.receiptId);
 if(!primary)fail('VALIDATION_ERROR','Angenommener KV-Warenbeleg fehlt.');
 const order=await readGoodsReceiptOrder(tx,auth,input.orderId);
 if(!order)fail('NOT_FOUND','Neuer Auftrag ist nicht lesbar.');
 if(before.some(row=>row.auftrag_id&&row.auftrag_id!==order.id))fail('CONFLICT','Warenbeleg gehört bereits zu einem anderen Auftrag.');
 if(before.every(row=>row.auftrag_id===order.id))return {code:'OK' as const,receipt:primary,replayed:true};
 if(before.some(row=>(row.zustand!=='unauffaellig'||row.abweichung.length||row.packstuecke_da!==row.packstuecke_gesamt||row.verfahren_wie_kv!=='stimmt')&&!locked.find(original=>original.id===row.id)?.cleared))fail('VALIDATION_ERROR','Warenabweichung zuerst klären; der KV wird nicht still zum Auftrag.');
 const totals=new Map<number,number>();
 for(const row of before)for(const line of row.mengen){if(!Number.isSafeInteger(line.kv_position)||!Number.isSafeInteger(line.bestaetigt)||Number(line.bestaetigt)<0)fail('VALIDATION_ERROR','Mengenabweichung zwischen Ware und aktueller KV-Fassung; zuerst abgleichen.');const position=line.kv_position!;totals.set(position,(totals.get(position)??0)+Number(line.bestaetigt));}
 const arrived=[...totals].filter(([,amount])=>amount>0).sort(([a],[b])=>a-b);
 if(arrived.length!==input.items.length||arrived.length!==order.items.length||arrived.some(([,amount],index)=>!Number.isSafeInteger(amount)||amount!==input.items[index]?.quantity||!order.items.some(row=>row.id===input.items[index]?.id&&row.quantity===amount)))fail('VALIDATION_ERROR','Mengenabweichung zwischen Ware und aktuellem Auftrag; nichts gebunden.');
 const itemByPosition=new Map(arrived.map(([position],index)=>[position,input.items[index].id]));
 const after:ReceiptRow[]=[];
 for(const row of before){
  if(row.auftrag_id){after.push(row);continue;}
  const quantities=row.mengen.map(line=>Number(line.bestaetigt)>0?{...line,teil_id:itemByPosition.get(line.kv_position!)!}:line);
  const changed=await tx.execute(sql`UPDATE public.goods_receipt SET auftrag_id=${order.id},mengen=${JSON.stringify(quantities)}::jsonb,version=version+1,geaendert_am=statement_timestamp() WHERE tenant_id=${auth.tenantId} AND id=${row.id}::uuid AND version=${row.version} AND auftrag_id IS NULL RETURNING id`);
  if(changed.length!==1)throw Error('QUOTE_GOODS_ORDER_VERSION_CONFLICT');
  await bindIntakeOriginalToOrder(tx,auth,{itemId:row.item_id!,orderId:order.id,customerId:order.customerId,clientEventId:input.clientEventId,complete:true,quoteId:input.quoteId});
  const receipt=await readReceipt(tx,auth,row.id);if(!receipt||receipt.auftrag_id!==order.id||receipt.version!==row.version+1)throw Error('QUOTE_GOODS_ORDER_READBACK_INVALID');after.push(receipt);
 }
 await updateGoodsReceiptOrder(tx,auth,order,'da','creation');
 const originals=await tx.execute<{id:string}>(sql`SELECT id::text FROM public.intake_item WHERE tenant_id=${auth.tenantId} AND vorgang_art='kv' AND vorgang_id=${input.quoteId} ORDER BY id FOR UPDATE`);
 for(const original of originals)await bindIntakeOriginalToOrder(tx,auth,{itemId:original.id,orderId:order.id,customerId:order.customerId,clientEventId:input.clientEventId,complete:true,quoteId:input.quoteId});
 const receipt=after.find(row=>row.id===input.receiptId)!;
 await appendGoodsReceiptEvent(tx,auth,{clientEventId:input.clientEventId,orderId:order.id,receiptId:input.receiptId,version:order.version,intent:createHash('sha256').update(JSON.stringify(input)).digest('hex'),before:before.length===1?primary:before,after:after.length===1?receipt:{...receipt,boundReceipts:after}});
 return {code:'OK' as const,receipt,replayed:false};
}

/** Existing receipt writer participating in the canonical order transaction. */
export async function writeQuoteGoodsReceiptInTransaction(tx:PrivilegedTenantTransaction,auth:AuthorizationSnapshot,input:unknown){
 return saveQuoteGoodsReceipt(input,{transaction:tx,authorization:auth,allowAccepted:true});
}
