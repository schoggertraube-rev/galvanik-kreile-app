// @vitest-environment node
import {createHash,randomUUID} from 'node:crypto';
import {expect,it,vi} from 'vitest';

const tenant=vi.hoisted(()=>'TEST-ablauf-'+globalThis.crypto.randomUUID());
vi.mock('@/lib/tenant',()=>({KREILE_TENANT_SLUG:tenant}));

import {createFixture,full,sql,withSession} from '../../../e2e/ablauf/replayHarness';
import {customerFixture,intakeOrderFixture} from '../../../e2e/ablauf/orderFixture';
import {finishIntakeFileAction,getIntakeCaptureAction,openIntakeOriginalAction,prepareIntakeFileAction} from '@/app/actions/eingang.actions';
import {createAdminClient} from '@/lib/supabase/admin';

it('speichert ein Teilefoto im vorhandenen Eingang mit belegtem Auftrag und derselben Originalquittung',async()=>{
 await sql`INSERT INTO public.tenant_features(tenant,feature_id,enabled) VALUES (${tenant},'E04',false)
  ON CONFLICT(tenant,feature_id) DO UPDATE SET enabled=false`;
 const kunde=await customerFixture('TEST S23a'),auftrag=await intakeOrderFixture('TEST S23a Upload',kunde);
 const auftragId=auftrag.receipt.orderId;
 const [teil]=await sql`SELECT id FROM public.items WHERE tenant_id=${tenant} AND order_id=${auftragId} ORDER BY id LIMIT 1`;
 const bytes=Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aZ1EAAAAASUVORK5CYII=','base64');
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
