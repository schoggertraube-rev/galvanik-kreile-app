// @vitest-environment node
import {createHash,randomUUID} from 'node:crypto';
import {PDFDocument} from 'pdf-lib';
import {beforeAll,expect,it,vi} from 'vitest';

const tenant=vi.hoisted(()=>'TEST-ablauf-'+globalThis.crypto.randomUUID());
vi.mock('@/lib/tenant',()=>({KREILE_TENANT_SLUG:tenant}));

import {full,sql,withSession} from '../../e2e/ablauf/replayHarness';
import {createCustomerAction} from '@/app/actions/customers.actions';
import {finishIntakeFileAction,prepareIntakeFileAction} from '@/app/actions/eingang.actions';
import {resolveAuthorization} from '@/lib/server/authorization';
import {withPrivilegedTenantTransaction} from '@/lib/server/privilegedDb';
import {createAdminClient} from '@/lib/supabase/admin';
import {leseLieferantenbelegFuerLagerInTransaction} from '@/modules/eingang/server-public';

let lieferantId:string;

beforeAll(async()=>{
 await sql`INSERT INTO public.tenant_features(tenant,feature_id,enabled) VALUES (${tenant},'E04',false)
  ON CONFLICT (tenant,feature_id) DO UPDATE SET enabled=false`;
 const lieferant=await withSession(full,()=>createCustomerAction({clientEventId:randomUUID(),customerType:'lieferant',
  companyName:'TEST I3 Lieferant',vatId:'DE900000093',country:'DE'}));
 if(lieferant.code!=='OK')throw Error('TEST_I3_LIEFERANT:'+lieferant.code);
 lieferantId=lieferant.customer.id;
});

it.each([0,1,200])('liest %i gespeicherte Lieferpositionen und den berichtigten Kopf in Originalreihenfolge',async(anzahl)=>{
 await sql`UPDATE public.tenant_features SET enabled=false WHERE tenant=${tenant} AND feature_id='E04'`;
 const itemId=randomUUID(),fileId=randomUUID(),pdf=await PDFDocument.create();
 pdf.addPage().drawText('TEST Lieferschein '+anzahl);
 const bytes=await pdf.save(),sha256=createHash('sha256').update(bytes).digest('hex');
 const grant=await withSession(full,()=>prepareIntakeFileAction({itemId,fileId,
  name:'TEST_I3_Lieferschein.pdf',mime:'application/pdf',bytes:bytes.length,sha256}));
 if(grant.code!=='OK'||!grant.upload)throw Error('TEST_I3_UPLOAD');
 expect((await createAdminClient().storage.from(grant.upload.bucket)
  .uploadToSignedUrl(grant.upload.path,grant.upload.token,bytes,{contentType:'application/pdf',upsert:false})).error).toBeNull();
 expect(await withSession(full,()=>finishIntakeFileAction(fileId),true)).toMatchObject({code:'OK'});

 // Isolierte TEST-Erkennungswerte zur Lesegrenze. Upload, Originalbeleg und Leser bleiben echt.
 await sql`UPDATE public.intake_item SET anliegen=ARRAY['lieferschein'],kunde_id=${lieferantId},zuordnung='hand'
  WHERE tenant_id=${tenant} AND id=${itemId}`;
 await sql`INSERT INTO public.intake_suggestion(tenant_id,item_id,file_id,feld,wert,sicherheit,sicherheit_wert,status)
  VALUES (${tenant},${itemId},${fileId},'beleg.nummer',to_jsonb('TEST zuerst'::text),'sicher',0.98,'offen'),
   (${tenant},${itemId},${fileId},'beleg.nummer',to_jsonb('TEST berichtigt'::text),'vorschlag',NULL,'uebernommen'),
   (${tenant},${itemId},${fileId},'beleg.datum',to_jsonb('2026-11-28'::text),'sicher',1,'offen')`;
 await sql`INSERT INTO public.intake_suggestion(tenant_id,item_id,file_id,feld,wert,sicherheit,sicherheit_wert,status)
  SELECT ${tenant},${itemId}::uuid,${fileId}::uuid,'position',jsonb_build_object('positionKey','p'||nummer,
   'bezeichnung','TEST Teil '||nummer,'menge','2.5','ean','ungültig'),'sicher',0.98,'offen'
  FROM generate_series(${anzahl}::integer,1,-1) nummer`;
 await sql`UPDATE public.tenant_features SET enabled=true WHERE tenant=${tenant} AND feature_id='E04'`;

 const session=await withSession(full,resolveAuthorization);
 if(!session.ok)throw Error('TEST_I3_AUTH');
 const auth=session.data;
 const read=()=>withPrivilegedTenantTransaction(auth,tx=>leseLieferantenbelegFuerLagerInTransaction(tx,auth,itemId));
 const beleg=await read();
 expect(beleg).toMatchObject({itemId,fileId,dokumentSha256:sha256,belegart:'lieferschein',belegnummer:'TEST berichtigt',
  belegdatum:'2026-11-28',lieferantId,lieferantSicherheit:1,erkennungFertig:true,gueltig:true});
 expect(beleg?.positionen.map(position=>position.positionKey)).toEqual(Array.from({length:anzahl},(_,i)=>'p'+(i+1)));
 if(anzahl>0)expect(beleg?.positionen[0]).toMatchObject({bezeichnung:'TEST Teil 1',menge:'2.5',ean:null,sicherheit:0.98});
 if(anzahl===1){
  await sql`UPDATE public.intake_file SET erkennung_status='laeuft' WHERE tenant_id=${tenant} AND id=${fileId}`;
  await sql`UPDATE public.intake_item SET einsatz_aktion='kein_gv' WHERE tenant_id=${tenant} AND id=${itemId}`;
  expect(await read()).toMatchObject({fileId,erkennungFertig:false,gueltig:false});
  await sql`UPDATE public.intake_item SET anliegen=ARRAY['kontakt'] WHERE tenant_id=${tenant} AND id=${itemId}`;
  expect(await read()).toBeNull();
 }
});
