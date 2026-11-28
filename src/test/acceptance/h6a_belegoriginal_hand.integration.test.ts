// @vitest-environment node
import {createHash,randomUUID} from 'node:crypto';
import {PDFDocument} from 'pdf-lib';
import {expect,it,vi} from 'vitest';

const tenant=vi.hoisted(()=>'TEST-ablauf-'+globalThis.crypto.randomUUID());
vi.mock('@/lib/tenant',()=>({KREILE_TENANT_SLUG:tenant}));

import {createFixture,full,withSession} from '../../../e2e/ablauf/replayHarness';
import {finishIntakeFileAction,prepareIntakeFileAction} from '@/app/actions/eingang.actions';
import {resolveAuthorization} from '@/lib/server/authorization';
import {withPrivilegedTenantTransaction} from '@/lib/server/privilegedDb';
import {createAdminClient} from '@/lib/supabase/admin';
import {leseLieferantenbelegFuerLagerInTransaction} from '@/modules/eingang/server-public';

it('liefert der Handanlage nur ein gesichertes, eindeutig ausgewähltes Dokument ohne Anliegen',async()=>{
  const itemId=randomUUID();
  const session=await withSession(full,resolveAuthorization);
  if(!session.ok)throw Error('TEST_H6A_AUTH');
  const auth=session.data;
  const read=(fileId?:string,id=itemId)=>withPrivilegedTenantTransaction(auth,tx=>
    leseLieferantenbelegFuerLagerInTransaction(tx,auth,id,{modus:'original',fileId}));
  const prepare=async (label:string)=>{
    const fileId=randomUUID();
    const pdf=await PDFDocument.create();
    pdf.addPage().drawText('TEST H6a '+label);
    const bytes=await pdf.save();
    const dokumentSha256=createHash('sha256').update(bytes).digest('hex');
    const grant=await withSession(full,()=>prepareIntakeFileAction({
      itemId,fileId,name:'TEST H6a '+label+'.pdf',mime:'application/pdf',bytes:bytes.length,sha256:dokumentSha256,
    }));
    if(grant.code!=='OK'||!grant.upload)throw Error('TEST_H6A_SIGNED_UPLOAD');
    const {bucket,path,token}=grant.upload;
    return {original:{fileId,dokumentSha256},secure:async()=>{
      expect((await createAdminClient().storage.from(bucket).uploadToSignedUrl(path,token,bytes,{contentType:'application/pdf'})).error).toBeNull();
      expect(await withSession(full,()=>finishIntakeFileAction(fileId))).toMatchObject({code:'OK'});
    }};
  };

  expect(await read()).toBeNull();
  const first=await prepare('erstes Original');
  expect(await read(first.original.fileId)).toBeNull();
  await first.secure();
  expect(await read()).toEqual(first.original);
  expect(await withPrivilegedTenantTransaction(auth,tx=>leseLieferantenbelegFuerLagerInTransaction(tx,auth,itemId))).toBeNull();
  const second=await prepare('zweites Original');
  await second.secure();
  expect(await read()).toBeNull();
  expect(await read(second.original.fileId)).toEqual(second.original);
  expect(await read(second.original.fileId,randomUUID())).toBeNull();

  const denied=await createFixture(['eingang'],'readonly');
  const deniedSession=await withSession(denied,resolveAuthorization);
  if(!deniedSession.ok)throw Error('TEST_H6A_DENIED_AUTH');
  const deniedAuth=deniedSession.data;
  expect(await withPrivilegedTenantTransaction(deniedAuth,tx=>
    leseLieferantenbelegFuerLagerInTransaction(tx,deniedAuth,itemId,{modus:'original',fileId:second.original.fileId}))).toBeNull();
});
