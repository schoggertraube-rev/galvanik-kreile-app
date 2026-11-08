import 'server-only';
import {createHash} from 'node:crypto';
import {sql} from 'drizzle-orm';
import {resolveAuthorization,hasAuthorizationArea,type AuthorizationSnapshot} from '@/lib/server/authorization';
import {withPrivilegedTenantTransaction,type PrivilegedTenantTransaction} from '@/lib/server/privilegedDb';
import {readQuoteGoodsContext} from '@/lib/server/quoteGoodsContextPort';
import {parseQuoteGoodsReceiptInput,type GoodsReceiptRecord} from '../goodsReceiptContract';
import type {GoodsReceiptResult} from './goodsReceipt';
import {recordIntakeQuoteEffect} from './intakeQuoteEffect';

/** The KV branch of the existing goods receipt writer; never creates a second store. */
export async function saveQuoteGoodsReceipt(raw:unknown,options:{transaction?:PrivilegedTenantTransaction;authorization?:AuthorizationSnapshot;allowAccepted?:boolean}={}):Promise<GoodsReceiptResult>{
 const input=parseQuoteGoodsReceiptInput(raw);
 if(!input)return {code:'VALIDATION_ERROR',message:'KV, Lagerort oder Warenprüfung fehlt.'};
 const authorization=options.authorization?{ok:true as const,data:options.authorization}:await resolveAuthorization();
 if(!authorization.ok)return {code:'UNAUTHENTICATED',message:authorization.message};
 const auth=authorization.data;
 if(!hasAuthorizationArea(auth,'eingang'))return {code:'FORBIDDEN',message:'Warenannahme erfordert Eingang.'};
 const intent=createHash('sha256').update(JSON.stringify(input)).digest('hex');
 try{const run=async(tx:PrivilegedTenantTransaction):Promise<GoodsReceiptResult>=>{
  await tx.execute(sql`SELECT pg_advisory_xact_lock(hashtextextended('goods-receipt:'||${auth.tenantId}||':'||${input.clientKey},0))`);
  const prior=await tx.execute<{nachher:{intent:string;after:GoodsReceiptRecord}}>(sql`SELECT nachher FROM public.intake_event event JOIN public.intake_item source ON source.tenant_id=event.tenant_id AND source.id=event.item_id WHERE event.tenant_id=${auth.tenantId} AND event.item_id=${input.itemId}::uuid AND event.art='ware' AND event.befehl_id=${input.clientEventId}::uuid AND (${hasAuthorizationArea(auth,'mails')} OR (source.kanal<>'mail' AND source.erstellt_von=${auth.userId}::uuid))`);
  if(prior.length)return prior.length===1&&prior[0].nachher.intent===intent&&prior[0].nachher.after?.id===input.id
   ?{code:'OK',receipt:prior[0].nachher.after,replayed:true}:{code:'CONFLICT',message:'Diese Warenbuchung wurde bereits anders verwendet.'};
  const quote=await readQuoteGoodsContext(tx,auth,input.quoteId);
  if(!quote)return {code:'NOT_FOUND',message:'KV ist nicht verfügbar.'};
  if(quote.version!==input.expectedQuoteVersion||quote.linkedOrderId)return {code:'CONFLICT',message:'KV wurde geändert oder bereits zum Auftrag. Neu lesen und abgleichen.'};
  if(quote.accepted&&!options.allowAccepted)return {code:'VALIDATION_ERROR',message:'Aktuelle KV-Zusage liegt vor. Ware und Auftrag müssen gemeinsam gebucht werden.'};
  if(input.expectedVersion!==0)return {code:'CONFLICT',message:'Gespeicherte Warenannahme erneut lesen; keinen zweiten Beleg anlegen.'};
  const existing=await tx.execute(sql`SELECT id FROM public.goods_receipt WHERE tenant_id=${auth.tenantId} AND (id=${input.id}::uuid OR client_key=${input.clientKey}::uuid) FOR UPDATE`);
  if(existing.length)return {code:'CONFLICT',message:'Diese Prüfkennung gehört bereits zu einem Warenbeleg.'};
  if(!input.condition||!input.packagesReceived||!input.packagesTotal||input.packagesReceived!==input.packagesTotal||input.procedure!=='stimmt')return {code:'VALIDATION_ERROR',message:'Zustand, Packstücke und Abgleich zum KV vollständig bestätigen; Abweichungen zuerst klären.'};
  if(input.quantities.length!==quote.positions.length||input.quantities.some(row=>{const expected=quote.positions.find(position=>position.id===row.itemId);return !expected||expected.quantity!==row.expected||(!row.confirmed&&(row.received===null||!row.note?.trim()));}))return {code:'VALIDATION_ERROR',message:'Mengenabweichung konkret angeben und erläutern; alle KV-Positionen prüfen.'};
  if(!input.photos.some(photo=>photo.kind==='uebersicht')||!input.photos.some(photo=>photo.kind==='teile'))return {code:'VALIDATION_ERROR',message:'Etikett-/Übersichtsfoto und Inhaltsfoto fehlen.'};
  const secured=await tx.execute(sql`SELECT file.id FROM public.intake_file file WHERE file.tenant_id=${auth.tenantId} AND file.item_id=${input.itemId}::uuid AND file.id=ANY(ARRAY[${sql.join(input.photos.map(photo=>sql`${photo.fileId}`),sql`, `)}]::uuid[]) AND file.mime LIKE 'image/%'
   AND EXISTS(SELECT 1 FROM public.intake_event event WHERE event.tenant_id=file.tenant_id AND event.item_id=file.item_id AND event.art='original_gespeichert' AND event.nachher->>'fileId'=file.id::text) FOR SHARE`);
  if(secured.length!==input.photos.length)return {code:'VALIDATION_ERROR',message:'Ein Pflichtfoto ist noch nicht sicher gespeichert.'};
  const binding=await recordIntakeQuoteEffect(tx,auth,{source:{itemId:input.itemId!,version:input.sourceVersion,message:false},quoteId:quote.id,customerId:quote.customerId,clientEventId:input.clientEventId,effect:'ware'});
  if(binding)return binding;
  const quantities=input.quantities.map(row=>({teil_id:row.itemId,kv_position:quote.positions.find(position=>position.id===row.itemId)!.position,erwartet:row.expected,bestaetigt:row.confirmed?row.expected:row.received,geaendert:!row.confirmed,hinweis:row.note}));
  await tx.execute(sql`INSERT INTO public.goods_receipt(id,tenant_id,client_key,item_id,auftrag_id,kv_id,kv_fassung,lagerort,modus,status,karte,packstuecke_da,packstuecke_gesamt,zustand,abweichung,abgestellt,fund_zeit,verfahren_wie_kv,verfahren_abweichung,fotos,mengen,offen,bestaetigt_von,bestaetigt_am)
   VALUES(${input.id}::uuid,${auth.tenantId},${input.clientKey}::uuid,${input.itemId}::uuid,NULL,${quote.id}::uuid,${quote.edition},${input.location},${input.mode},'angenommen',${input.card},${input.packagesReceived},${input.packagesTotal},${input.condition},ARRAY[${sql.join(input.deviations.map(value=>sql`${value}`),sql`, `)}]::text[],${input.foundUnattended},${input.foundAt}::timestamptz,${input.procedure},${input.procedureNote},${JSON.stringify(input.photos)}::jsonb,${JSON.stringify(quantities)}::jsonb,'{}'::text[],${auth.userId}::uuid,statement_timestamp())`);
  const rows=await tx.execute<GoodsReceiptRecord>(sql`SELECT * FROM public.v_quote_goods_receipt_v1 WHERE tenant_id=${auth.tenantId} AND id=${input.id}::uuid`);
  if(rows.length!==1||rows[0].auftrag_id!==null||rows[0].gesperrt!==!quote.accepted)throw Error('QUOTE_GOODS_READBACK_INVALID');
  await tx.execute(sql`INSERT INTO public.intake_event(tenant_id,item_id,art,befehl_id,von,vorher,nachher) VALUES(${auth.tenantId},${input.itemId}::uuid,'ware',${input.clientEventId}::uuid,${auth.userId},NULL,${JSON.stringify({action:'kv.ware_angenommen',receiptId:input.id,intent,after:rows[0]})}::jsonb)`);
  return {code:'OK',receipt:rows[0],replayed:false};
 };return options.transaction?await run(options.transaction):await withPrivilegedTenantTransaction(auth,run);}catch(error){console.error('[QUOTE_GOODS_RECEIPT_FAILED]',error);return {code:'UNAVAILABLE',message:'KV-Warenannahme konnte nicht sicher bestätigt werden. Eingaben und Kennung behalten.'};}
}
