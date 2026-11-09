import {randomUUID} from 'node:crypto';
import {expect,it} from 'vitest';
import {KREILE_TENANT_SLUG} from '@/lib/tenant';
import {sql,full,withSession} from './replayHarness';
import {readyInvoiceOrder} from './orderFixture';
import {installMailProvider} from './mailProvider';

it('H5 a genuine newly imported pickup request from the unique customer changes the single unlabeled shipping order',async()=>{
 const order=await readyInvoiceOrder('H5','shipping'),graphId='TEST-H5-'+randomUUID();
 installMailProvider(graphId,'TEST Ich hole die Teile selbst ab.','TEST-'+order.customerId+'@example.invalid');
 const {importOutlookMailAction}=await import('@/app/actions/communications.actions');
 const imported=await withSession(full,()=>importOutlookMailAction(graphId));
 expect(imported.code).toBe('OK');if(imported.code!=='OK')throw Error('H5_IMPORT:'+imported.code);
 const [mail]=await sql`SELECT id::text,version,text,anliegen_offen,kunde_id FROM public.intake_item WHERE tenant_id=${KREILE_TENANT_SLUG} AND graph_message_id=${graphId}`;
 expect(mail).toBeDefined();
 expect(await sql`SELECT count(*)::integer AS n FROM public.orders WHERE tenant_id=${KREILE_TENANT_SLUG} AND customer_id=${order.customerId}`).toEqual([{n:1}]);
 expect(await sql`SELECT count(*)::integer AS n FROM public.shipments WHERE tenant_id=${KREILE_TENANT_SLUG} AND order_id=${order.orderId}`).toEqual([{n:0}]);
 const {changeOrderPickupNoticeAction,getLiveOrderCardAction}=await import('@/app/actions/orders.actions');
 const result=await withSession(full,()=>changeOrderPickupNoticeAction({command:'handover_from_mail',sourceItemId:mail.id,sourceVersion:mail.version,clientEventId:randomUUID()}));
 const actual=await sql`SELECT handover_mode FROM public.orders WHERE tenant_id=${KREILE_TENANT_SLUG} AND id=${order.orderId}`;
 expect(result,'H5 actual command result: '+JSON.stringify(result)+'; DB: '+JSON.stringify(actual)).toMatchObject({code:'OK',receipt:{orderId:order.orderId,handoverMode:'pickup',outcome:'changed'}});
 expect(actual).toEqual([{handover_mode:'pickup'}]);
 expect(await withSession(full,()=>getLiveOrderCardAction({orderId:order.orderId}))).toMatchObject({code:'OK',data:{card:{id:order.orderId,handoverMode:'pickup'}}});
});
