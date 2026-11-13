// @vitest-environment node
// TEST fixtures only; actual intake/completion/photo Storage/complaint/rework actions.
import {it,expect,vi} from 'vitest';
import {randomUUID} from 'node:crypto';
const tenant=vi.hoisted(()=>'TEST-ablauf-'+globalThis.crypto.randomUUID());
vi.mock('@/lib/tenant',()=>({KREILE_TENANT_SLUG:tenant}));
import {sql,full,withSession,createFixture} from '../../../e2e/ablauf/replayHarness';
import {readyInvoiceOrder} from '../../../e2e/ablauf/orderFixture';
import {storeOrderPhoto,storeIntakeGoodsPhoto} from '../../../e2e/ablauf/photoFixture';
import {reklamationAusfuehrenAction,nacharbeitAnlegenAction,getByOrder} from '@/app/actions/complaints.actions';
import {getLiveOrderCardAction} from '@/app/actions/orders.actions';
import {getGoodsReceiptsAction,saveGoodsReceiptAction} from '@/app/actions/eingang.actions';

it.each([false,true])('S05K A5 withdraws only unstarted rework atomically, with fresh retry (started=%s)',async(started)=>{
 const decision=await createFixture(['eingang','auftraege','kunden','geld','entscheiden']);
 const source=await readyInvoiceOrder('S05K A5 '+started),photoId=await storeOrderPhoto(source.orderId);
 const complaint=await withSession(decision,()=>reklamationAusfuehrenAction({action:'aufnehmen',clientKey:randomUUID(),orderId:source.orderId,intakeItemId:null,intakeVersion:null,parts:[{position_id:source.items[0].id,menge:1}],defect:'Blasen',description:'TEST S05K Ruecknahme',photoIds:[photoId],goodsReturn:'ja'}));
 if(complaint.code!=='OK')throw Error('TEST_A5_COMPLAINT:'+complaint.code);
 const work=await withSession(decision,()=>nacharbeitAnlegenAction({reklamationId:complaint.receipt.complaintId,version:complaint.receipt.version,bewertung:'berechtigt',massnahme:'nacharbeit',liefertermin:'2027-05-18'}));
 if(work.code!=='OK')throw Error('TEST_A5_REWORK:'+work.code+':'+work.message);
 if(started){
  const photo=await storeIntakeGoodsPhoto(),waiting=await withSession(full,()=>getGoodsReceiptsAction(work.receipt.orderId));
  if(waiting.code!=='OK')throw Error('TEST_A5_GOODS_READ:'+waiting.code);
  const moved=await withSession(full,()=>saveGoodsReceiptAction({id:randomUUID(),clientKey:randomUUID(),clientEventId:randomUUID(),itemId:photo.itemId,orderId:work.receipt.orderId,expectedOrderVersion:waiting.order.version,expectedVersion:0,mode:'erwartet',command:'galvanik',card:0,packagesReceived:1,packagesTotal:1,condition:'unauffaellig',deviations:[],foundUnattended:false,foundAt:null,procedure:null,procedureNote:null,photos:[{fileId:photo.fileId,kind:'teile'}],quantities:waiting.order.items.map(item=>({itemId:item.id,expected:item.quantity,received:null,confirmed:true,note:null}))}));
  if(moved.code!=='OK')throw Error('TEST_A5_GOODS_START:'+moved.code+':'+moved.message);
 }
 const input={action:'abschliessen' as const,clientKey:randomUUID(),complaintId:complaint.receipt.complaintId,version:complaint.receipt.version+1,kind:'zurueckgezogen' as const,note:'TEST Kunde zieht zurueck',sentThreadId:null};
 const result=await withSession(decision,()=>reklamationAusfuehrenAction(input));
 if(started){expect(result).toEqual({code:'VALIDATION_ERROR',message:'Die Nacharbeit läuft schon in Auftrag '+work.receipt.orderNumber+'. Schließ sie zuerst ab.'});}
 else {expect(result).toMatchObject({code:'OK'});expect(await withSession(decision,()=>reklamationAusfuehrenAction(JSON.parse(JSON.stringify(input))))).toMatchObject({code:'OK',replayed:true});}
 const [order]=await sql`SELECT station,status,ware FROM public.orders WHERE tenant_id=${tenant} AND id=${work.receipt.orderId}`;
 expect(order).toMatchObject(started?{station:'galvanik'}:{status:'storniert',ware:'storniert'});
 const read=await withSession(full,()=>getByOrder(source.orderId));if(read.code!=='OK')throw Error('TEST_A5_READ');
 expect(read.complaints.find(row=>row.id===complaint.receipt.complaintId)).toMatchObject(started?{stand:'massnahme_nacharbeit',nacharbeitAuftragId:work.receipt.orderId}:{stand:'abgeschlossen',nacharbeitAuftragId:null});
 expect(await withSession(full,()=>getLiveOrderCardAction({orderId:work.receipt.orderId}))).toMatchObject({code:'OK'});
});
