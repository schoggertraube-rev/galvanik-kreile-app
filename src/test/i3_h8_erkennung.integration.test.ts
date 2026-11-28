// @vitest-environment node
import {createHash,randomUUID} from 'node:crypto';
import {readFileSync} from 'node:fs';
import {PDFDocument} from 'pdf-lib';
import {beforeAll,expect,it,vi} from 'vitest';

const tenant=vi.hoisted(()=>'TEST-ablauf-'+globalThis.crypto.randomUUID());
vi.mock('@/lib/tenant',()=>({KREILE_TENANT_SLUG:tenant}));

import {full,nativeFetch,sql,withSession} from '../../e2e/ablauf/replayHarness';
import {finishIntakeFileAction,prepareIntakeFileAction} from '@/app/actions/eingang.actions';
import {resolveAuthorization} from '@/lib/server/authorization';
import {withPrivilegedTenantTransaction} from '@/lib/server/privilegedDb';
import {createAdminClient} from '@/lib/supabase/admin';
import {leseLieferantenbelegFuerLagerInTransaction} from '@/modules/eingang/server-public';

beforeAll(async()=>{
 await sql`INSERT INTO public.tenant_features(tenant,feature_id,enabled) VALUES (${tenant},'E04',true)`;
 await sql`INSERT INTO public.company_settings(id,tenant_id,company_name,material_aufschlag_prozent,
  lager_regelversion,ki_sicherheitsschwelle) VALUES (${randomUUID()},${tenant},'TEST H8',0,'TEST-H8',0.95)`;
});

it.each([
 {name:'lieferschein',belegart:'lieferschein',belegnummer:'TEST-LS-03',einzelpreis:null},
 {name:'lieferantenrechnung',belegart:'lieferantenrechnung',belegnummer:'TEST-RE-03',einzelpreis:'24.80'},
])('liest den gesicherten TEST-$name bis zum Lagerport',async({name,belegart,belegnummer,einzelpreis})=>{
 const roh=readFileSync('e2e/fixtures/erkennung/TEST_'+name+'.json','utf8');
 const host='https://i3-h8.example.invalid';
 vi.stubEnv('AZURE_DOCINTEL_ENDPOINT',host);
 vi.stubEnv('AZURE_DOCINTEL_KEY','TEST-H8-Anbieter');
 const provider=vi.spyOn(globalThis,'fetch').mockImplementation(async(input,init)=>{
  const url=new URL(typeof input==='string'?input:input instanceof URL?input.href:input.url);
  if(url.origin!==host)return nativeFetch(input,init);
  return init?.method==='POST'?new Response(null,{status:202,headers:{'operation-location':
   host+'/documentintelligence/documentModels/prebuilt-layout/analyzeResults/TEST-H8'}}):new Response(roh);
 });
 try{
  const itemId=randomUUID(),fileId=randomUUID(),pdf=await PDFDocument.create();
  pdf.addPage().drawText('TEST '+name);
  const bytes=await pdf.save(),sha256=createHash('sha256').update(bytes).digest('hex');
  const grant=await withSession(full,()=>prepareIntakeFileAction({itemId,fileId,name:'TEST_'+name+'.pdf',
   mime:'application/pdf',bytes:bytes.length,sha256}));
  if(grant.code!=='OK'||!grant.upload)throw Error('TEST_I3_H8_UPLOAD');
  const original=await createAdminClient().storage.from(grant.upload.bucket).uploadToSignedUrl(grant.upload.path,grant.upload.token,
   bytes,{contentType:'application/pdf',upsert:false});
  expect(original.error).toBeNull();
  expect(await withSession(full,()=>finishIntakeFileAction(fileId),true)).toMatchObject({code:'OK'});
  const session=await withSession(full,resolveAuthorization);
  if(!session.ok)throw Error('TEST_I3_H8_AUTH');
  const auth=session.data;
  const gelesen=await withPrivilegedTenantTransaction(auth,tx=>leseLieferantenbelegFuerLagerInTransaction(tx,auth,itemId));
  expect(gelesen).toMatchObject({itemId,fileId,dokumentSha256:sha256,belegart,belegnummer,
    bezug:{bestellNummer:'TEST-BESTELLUNG-03',lieferscheinNummern:['TEST-LS-03']},
    positionen:[{positionKey:'p1',lieferantenArtikelNr:'TEST-FLANSCH-03',bezeichnung:'TEST Flansch',
      menge:'4.25',einheitText:'Stück',einzelpreis}]});
 }finally{
  provider.mockRestore();
  vi.unstubAllEnvs();
 }
});
