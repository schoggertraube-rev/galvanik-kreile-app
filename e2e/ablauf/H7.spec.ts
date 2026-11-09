import {randomUUID} from 'node:crypto';
import {expect,it} from 'vitest';
import {KREILE_TENANT_SLUG} from '@/lib/tenant';
import {sql,full,withSession} from './replayHarness';
import {readyInvoiceOrder} from './orderFixture';
import {installMailProvider} from './mailProvider';
import {storeOrderPhoto} from './photoFixture';

// No-photo boundary only: requesting photos and the subsequent rework chain
// remain explicit missing coverage, not an implied complete H7 PASS.
it('H7 an actual complaint mail without photos cannot create a complaint or rework order and retains its original',async()=>{
 const order=await readyInvoiceOrder('H7');
 const {recordGoodsOutAction}=await import('@/app/actions/goodsOut.actions');
 const out=await withSession(full,()=>recordGoodsOutAction({orderId:order.orderId,mode:'abholung',expectedVersion:order.version,clientEventId:randomUUID()}));
 expect(out.code).toBe('OK');
 const graphId='TEST-H7-'+randomUUID();
 installMailProvider(graphId,'TEST Reklamation: Die Beschichtung blättert ab. Ich habe noch keine Fotos.','TEST-'+order.customerId+'@example.invalid','TEST Reklamation');
 const {importOutlookMailAction}=await import('@/app/actions/communications.actions');
 expect(await withSession(full,()=>importOutlookMailAction(graphId))).toMatchObject({code:'OK'});
 const [mail]=await sql`SELECT id::text,version FROM public.intake_item WHERE tenant_id=${KREILE_TENANT_SLUG} AND graph_message_id=${graphId}`;
 const {reklamationAusfuehrenAction,getByOrder,getComplaintDialogAction}=await import('@/app/actions/complaints.actions');
 const result=await withSession(full,()=>reklamationAusfuehrenAction({action:'aufnehmen',clientKey:randomUUID(),orderId:order.orderId,intakeItemId:mail.id,intakeVersion:mail.version,parts:[{position_id:order.items[0].id,menge:1}],defect:'Abplatzung',description:'TEST H7 Beschichtung blättert ab',photoIds:[],goodsReturn:'offen'}));
 expect(result.code).toBe('VALIDATION_ERROR');
 expect(await sql`SELECT count(*)::integer AS n FROM public.complaints WHERE tenant_id=${KREILE_TENANT_SLUG} AND order_id=${order.orderId}`).toEqual([{n:0}]);
 expect(await withSession(full,()=>getByOrder(order.orderId))).toMatchObject({code:'OK',complaints:[]});
 expect(await sql`SELECT count(*)::integer AS n FROM public.intake_file WHERE tenant_id=${KREILE_TENANT_SLUG} AND item_id=${mail.id}::uuid AND mime='message/rfc822'`).toEqual([{n:1}]);
 expect(await sql`SELECT count(*)::integer AS n FROM public.orders WHERE tenant_id=${KREILE_TENANT_SLUG} AND customer_id=${order.customerId}`).toEqual([{n:1}]);
 const photoId=await storeOrderPhoto(order.orderId);
 const prepared=await withSession(full,()=>getComplaintDialogAction({orderId:order.orderId,sourceItemId:mail.id}));
 expect(prepared.code).toBe('OK');
 if(prepared.code!=='OK'||!('data'in prepared))throw Error('H7_DIALOG:'+prepared.code);
 const created=await withSession(full,()=>reklamationAusfuehrenAction({action:'aufnehmen',clientKey:randomUUID(),orderId:order.orderId,intakeItemId:prepared.data.initial.intakeItemId,intakeVersion:prepared.data.initial.intakeVersion,parts:[{position_id:prepared.data.source.items[0].id,menge:1}],defect:'Abplatzung',description:'TEST H7 Foto ist jetzt da',photoIds:[photoId],goodsReturn:'offen'}));
 const rows=await sql`SELECT id,stand FROM public.complaints WHERE tenant_id=${KREILE_TENANT_SLUG} AND order_id=${order.orderId}`;
 expect(created,'H7 after real secured photo; actual '+JSON.stringify(created)+'; DB '+JSON.stringify(rows)).toMatchObject({code:'OK',receipt:{state:'aufgenommen',version:1}});
 expect(rows).toHaveLength(1);
});
