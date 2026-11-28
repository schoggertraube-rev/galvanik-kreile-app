// @vitest-environment node
import {createHash,randomUUID} from 'node:crypto';
import {expect,it,vi} from 'vitest';

const tenant=vi.hoisted(()=>'TEST-ablauf-'+globalThis.crypto.randomUUID());
vi.mock('@/lib/tenant',()=>({KREILE_TENANT_SLUG:tenant}));

import {createFixture,full,sql,withSession} from '../../../e2e/ablauf/replayHarness';
import {customerFixture,intakeOrderFixture} from '../../../e2e/ablauf/orderFixture';
import {finishIntakeFileAction,getIntakeCaptureAction,openIntakeOriginalAction,prepareIntakeFileAction} from '@/app/actions/eingang.actions';
import {createAdminClient} from '@/lib/supabase/admin';
import {getDomainAttachmentOriginalAction,getDomainAttachmentsAction} from '@/app/actions/domainAttachments.actions';
import {readSecuredOrderPhotoIds} from '@/lib/server/domainAttachment';
import {resolveAuthorization} from '@/lib/server/authorization';
import {withPrivilegedTenantTransaction} from '@/lib/server/privilegedDb';

import {reserveLegacyDocument,finishLegacyDocument} from '../../../e2e/ablauf/photoFixture';

const photo=Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aZ1EAAAAASUVORK5CYII=','base64');

it('speichert ein Teilefoto im vorhandenen Eingang mit belegtem Auftrag und derselben Originalquittung',async()=>{
 await sql`INSERT INTO public.tenant_features(tenant,feature_id,enabled) VALUES (${tenant},'E04',false)
  ON CONFLICT(tenant,feature_id) DO UPDATE SET enabled=false`;
 const kunde=await customerFixture('TEST S23a'),auftrag=await intakeOrderFixture('TEST S23a Upload',kunde);
 const auftragId=auftrag.receipt.orderId;
 const [teil]=await sql`SELECT id FROM public.items WHERE tenant_id=${tenant} AND order_id=${auftragId} ORDER BY id LIMIT 1`;
 const bytes=photo;
 const itemId=randomUUID(),fileId=randomUUID(),sha256=createHash('sha256').update(bytes).digest('hex');
 const input={itemId,fileId,name:'TEST-Teilefoto.png',mime:'image/png',bytes:bytes.length,sha256,
  kontext:{auftragId,teilId:teil.id,fotoArt:'teile',phase:'arbeit',fuerKunde:false}};
 const auftragsLogin=await createFixture(['auftraege']);
 const ohneAuftrag=await createFixture(['eingang']);
 expect(await withSession(ohneAuftrag,()=>prepareIntakeFileAction(input))).toMatchObject({code:'FORBIDDEN'});
 expect(await withSession(auftragsLogin,()=>prepareIntakeFileAction({...input,kontext:{...input.kontext,fuerKunde:true}})))
  .toMatchObject({code:'FORBIDDEN'});
 expect(await withSession(auftragsLogin,()=>prepareIntakeFileAction({...input,kontext:{...input.kontext,teilId:randomUUID()}})))
  .toMatchObject({code:'FORBIDDEN'});
 expect(await sql`SELECT id FROM public.intake_item WHERE tenant_id=${tenant} AND id=${itemId}::uuid`).toEqual([]);
 const grant=await withSession(auftragsLogin,()=>prepareIntakeFileAction(input));
 if(grant.code!=='OK'||!grant.upload)throw Error('TEST_S23A_KONTEXT_UPLOAD:'+grant.code);
 expect(await withSession(auftragsLogin,()=>prepareIntakeFileAction({...input,kontext:{...input.kontext,phase:'fertig'}})))
  .toMatchObject({code:'CONFLICT'});
 expect((await createAdminClient().storage.from(grant.upload.bucket).uploadToSignedUrl(grant.upload.path,grant.upload.token,bytes,
  {contentType:'image/png',upsert:false})).error).toBeNull();
 expect(await withSession(auftragsLogin,()=>finishIntakeFileAction(fileId),true)).toMatchObject({code:'OK',capture:{orderId:auftragId,
  assignment:'bestaetigt',files:[{id:fileId,secured:true}]}});
 expect(await withSession(auftragsLogin,()=>finishIntakeFileAction(fileId))).toMatchObject({code:'OK'});
 expect(await withSession(auftragsLogin,()=>getIntakeCaptureAction(itemId,{orderId:auftragId})))
  .toMatchObject({code:'OK',capture:{customerId:kunde,orderId:auftragId}});
 expect(await withSession(auftragsLogin,()=>openIntakeOriginalAction({fileId,orderId:auftragId,clientEventId:randomUUID()})))
  .toMatchObject({code:'OK',original:{id:fileId,sha256}});
 expect(await withSession(auftragsLogin,()=>getDomainAttachmentsAction({targetType:'ORDER',targetId:auftragId})))
  .toMatchObject({code:'OK',data:[{attachmentId:fileId,intakeOriginal:true,intakeSecured:true}]});
 const auth=await withSession(auftragsLogin,resolveAuthorization);
 if(!auth.ok)throw Error('TEST_S23A_KONTEXT_AUTH');
 expect(await withPrivilegedTenantTransaction(auth.data,tx=>readSecuredOrderPhotoIds(tx,auth.data,auftragId,[fileId])))
  .toEqual([fileId]);
 expect(await sql`SELECT file.foto_art,file.phase,item.zuordnung_regel,event.nachher->'kontext' AS kontext
  FROM public.intake_file file JOIN public.intake_item item ON item.tenant_id=file.tenant_id AND item.id=file.item_id
  JOIN public.intake_event event ON event.tenant_id=file.tenant_id AND event.item_id=file.item_id AND event.befehl_id=file.id
    AND event.art='zugeordnet' AND event.nachher->>'action'='original_kontext'
  WHERE file.tenant_id=${tenant} AND file.id=${fileId}::uuid`).toEqual([
   {foto_art:'teile',phase:'arbeit',zuordnung_regel:'kontext',kontext:{...input.kontext,kundeId:kunde}},
  ]);
 expect(await sql`SELECT id FROM public.scan_uploads WHERE tenant_id=${tenant} AND linked_order_id=${auftragId}`).toEqual([]);
 // The same live reader remains usable by the full operator.
 expect(await withSession(full,()=>getIntakeCaptureAction(itemId,{orderId:auftragId}))).toMatchObject({code:'OK'});
});

it('liest auf der Kundenkarte den neuen Eingang und den bisherigen Anhang und öffnet nur Originale des gewählten Kunden',async()=>{
 const kunde=await customerFixture('TEST S23a Kundenkarte');
 const anderer=await customerFixture('TEST S23a anderer Kunde');
 const kundenLogin=await createFixture(['kunden']);
 const fotoLogin=await createFixture(['kunden','auftraege']);
 const itemId=randomUUID(),fileId=randomUUID(),sha256=createHash('sha256').update(photo).digest('hex');
 const deviceRead=await withSession(fotoLogin,async()=>{
  const auth=await resolveAuthorization();if(!auth.ok)throw Error('TEST_S23A_KUNDEN_AUTH');
  const {offlinePartition}=await import('@/lib/server/offlinePartition');return offlinePartition(auth.data);
 });
 const input={itemId,fileId,name:'TEST-Kundenfoto.png',mime:'image/png',bytes:photo.length,sha256,deviceId:randomUUID(),
  deviceCapturedAt:new Date().toISOString(),kontext:{kundeId:kunde}};
 expect(await withSession(kundenLogin,()=>prepareIntakeFileAction(input))).toMatchObject({code:'FORBIDDEN'});
 const grant=await withSession(fotoLogin,()=>prepareIntakeFileAction(input,deviceRead));
 if(grant.code!=='OK')throw Error('TEST_S23A_KUNDE_UPLOAD:'+grant.code);
 if(grant.upload)expect((await createAdminClient().storage.from(grant.upload.bucket).uploadToSignedUrl(grant.upload.path,
  grant.upload.token,photo,{contentType:'image/png',upsert:false})).error).toBeNull();
 expect(await withSession(fotoLogin,()=>finishIntakeFileAction(fileId,deviceRead),true)).toMatchObject({code:'OK',capture:{customerId:kunde}});
 const target={targetType:'CUSTOMER' as const,targetId:kunde};
 const historisch=await withSession(full,()=>reserveLegacyDocument({...target,clientRequestId:randomUUID(),
  mimeType:'image/png',fileBytes:photo.length,contentSha256:sha256}));
 if(historisch.code!=='OK'||!historisch.data.upload)throw Error('TEST_S23A_ALT_UPLOAD:'+historisch.code);
 const altId=historisch.data.receipt.attachmentId,altUpload=historisch.data.upload;
 expect((await createAdminClient().storage.from('scans').uploadToSignedUrl(altUpload.path,altUpload.token,photo,
  {contentType:'image/png',upsert:false})).error).toBeNull();
 expect(await withSession(full,()=>finishLegacyDocument({attachmentId:altId,fileBytes:photo.length,contentSha256:sha256})))
  .toMatchObject({code:'OK'});
 expect(await withSession(kundenLogin,()=>getDomainAttachmentsAction(target))).toMatchObject({code:'FORBIDDEN'});
 const liste=await withSession(fotoLogin,()=>getDomainAttachmentsAction(target));
 expect(liste).toMatchObject({code:'OK',data:expect.arrayContaining([
  expect.objectContaining({attachmentId:fileId,intakeOriginal:true,intakeSecured:true}),expect.objectContaining({attachmentId:altId}),
 ])});
 expect(await withSession(fotoLogin,()=>openIntakeOriginalAction({fileId,customerId:kunde,clientEventId:randomUUID()})))
  .toMatchObject({code:'OK',original:{id:fileId,sha256}});
 expect(await withSession(fotoLogin,()=>openIntakeOriginalAction({fileId,customerId:anderer,clientEventId:randomUUID()})))
  .toMatchObject({code:'FORBIDDEN'});
 expect(await withSession(full,()=>getDomainAttachmentOriginalAction({attachmentId:altId}))).toMatchObject({code:'OK'});
});

it('speichert das Werkstattfoto einmal im Eingang und liest es am tatsächlich übergebenen Teil',async()=>{
 const kunde=await customerFixture('TEST S23a Werkstatt'),auftrag=await intakeOrderFixture('TEST S23a Übergabe',kunde);
 const orderId=auftrag.receipt.orderId,teilId=auftrag.receipt.items[0].id;
 const itemId=randomUUID(),fileId=randomUUID(),sha256=createHash('sha256').update(photo).digest('hex');
 const input={itemId,fileId,name:'TEST-Werkstatt.png',mime:'image/png',bytes:photo.length,sha256,
  kontext:{auftragId:orderId,teilId,fotoArt:'teile' as const,phase:'arbeit' as const,uebergabeVersion:1}};
 const {freezeOrderAction,setExtraWorkHourlyRateAction,transitionWareneingangToGalvanikAction}=await import('@/app/actions/orders.actions');
 const {getGalvanikHandoffAttachmentsAction,reserveGalvanikHandoffAttachmentAction}=await import('@/app/warendurchlauf/actions');
 const transition=await withSession(full,()=>transitionWareneingangToGalvanikAction({orderId,expectedVersion:1,clientEventId:randomUUID()}));
 expect(transition).toMatchObject({code:'OK'});
 expect(await withSession(full,()=>prepareIntakeFileAction(input))).toMatchObject({code:'CONFLICT'});
 expect(await sql`SELECT id FROM public.intake_item WHERE tenant_id=${tenant} AND id=${itemId}::uuid`).toEqual([]);
 const [order]=await sql`SELECT version FROM public.orders WHERE tenant_id=${tenant} AND id=${orderId}`;
 expect(await withSession(full,()=>setExtraWorkHourlyRateAction({rateId:randomUUID(),expectedVersion:0,hourlyRateCents:14000,clientEventId:randomUUID()})))
  .toMatchObject({code:'OK'});
 const freeze={orderId,expectedVersion:Number(order.version),freezeId:randomUUID(),clientEventId:randomUUID()};
 expect(await withSession(full,()=>freezeOrderAction(freeze))).toMatchObject({code:'VALIDATION_ERROR'});
 const request={...input,kontext:{...input.kontext,uebergabeVersion:Number(order.version)}};
 expect(await withSession(full,()=>reserveGalvanikHandoffAttachmentAction({orderId,itemId:teilId,expectedVersion:Number(order.version),
  clientRequestId:randomUUID(),mimeType:'image/png',fileBytes:photo.length,contentSha256:sha256}))).toMatchObject({code:'FORBIDDEN'});
 const grant=await withSession(full,()=>prepareIntakeFileAction(request));
 if(grant.code!=='OK')throw Error('TEST_S23A_WERKSTATT_UPLOAD:'+grant.code);
 if(grant.upload)expect((await createAdminClient().storage.from(grant.upload.bucket).uploadToSignedUrl(grant.upload.path,grant.upload.token,photo,
  {contentType:'image/png',upsert:false})).error).toBeNull();
 expect(await withSession(full,()=>finishIntakeFileAction(fileId),true)).toMatchObject({code:'OK',capture:{orderId,files:[{id:fileId,secured:true}]}});
 expect(await withSession(full,()=>finishIntakeFileAction(fileId))).toMatchObject({code:'OK'});
 expect(await withSession(full,()=>getGalvanikHandoffAttachmentsAction({orderId,itemId:teilId})))
  .toMatchObject({code:'OK',data:{receipts:[],intakeFiles:[{id:fileId,name:input.name,mime:input.mime,bytes:photo.length}]}});
 expect(await withSession(full,()=>openIntakeOriginalAction({orderId,fileId,clientEventId:randomUUID()})))
  .toMatchObject({code:'OK',original:{id:fileId,sha256}});
 expect(await withSession(full,()=>openIntakeOriginalAction({fileId,clientEventId:randomUUID()}))).toMatchObject({code:'FORBIDDEN'});
 const auth=await withSession(full,resolveAuthorization);
 if(!auth.ok)throw Error('TEST_S23A_WERKSTATT_AUTH');
 const {readOrderEvidenceBatch}=await import('@/lib/server/evidenceRead');
 expect((await readOrderEvidenceBatch(auth.data,[orderId])).get(orderId))
  .toMatchObject({code:'OK',intakePhotoParts:[teilId]});
 expect(await withSession(full,()=>freezeOrderAction(freeze))).toMatchObject({code:'OK'});
 expect(await sql`SELECT count(*)::int AS count FROM public.intake_event WHERE tenant_id=${tenant} AND item_id=${itemId}::uuid
  AND art='zugeordnet' AND nachher->>'action'='original_kontext' AND nachher->>'uebergabeEreignisId' IS NOT NULL`).toEqual([{count:1}]);
});
