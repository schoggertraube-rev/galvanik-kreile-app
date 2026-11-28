// @vitest-environment node
import {createHash,randomUUID} from 'node:crypto';
import {expect,it,vi} from 'vitest';

const tenant=vi.hoisted(()=>'TEST-ablauf-'+globalThis.crypto.randomUUID());
vi.mock('@/lib/tenant',()=>({KREILE_TENANT_SLUG:tenant}));

import {full,nativeFetch,sql,withSession} from '../../../../../e2e/ablauf/replayHarness';
import {finishIntakeFileAction,getIntakeCaptureAction,prepareIntakeFileAction} from '@/app/actions/eingang.actions';
import {createAdminClient} from '@/lib/supabase/admin';
import {baueTaktLeser,TAKT_JOBS} from '../../jobs';
import {fuehreFaelligenJobAus} from '../lauf';

const image=Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+a3l8AAAAASUVORK5CYII=','base64');

async function secure(name:string) {
  const itemId=randomUUID(),fileId=randomUUID();
  const sha256=createHash('sha256').update(image).digest('hex');
  const grant=await withSession(full,()=>prepareIntakeFileAction({
    itemId,fileId,name,mime:'image/png',bytes:image.length,sha256,
  }));
  if(grant.code!=='OK')throw Error('TEST_I1C_ORIGINAL');
  if(grant.upload){
    const storage=createAdminClient().storage.from(grant.upload.bucket);
    expect((await storage.uploadToSignedUrl(grant.upload.path,grant.upload.token,image,{contentType:'image/png'})).error).toBeNull();
  }
  expect(await withSession(full,()=>finishIntakeFileAction(fileId))).toMatchObject({
    code:'OK',capture:{files:[{status:'wartet',secured:true}]},
  });
  return {itemId,fileId};
}

it('holt nur fällige Originale nach, begrenzt Versuche und achtet E04',async()=>{
  await sql`INSERT INTO public.tenant_features (tenant,feature_id,enabled) VALUES (${tenant},'E04',true)`;
  const job=TAKT_JOBS.find(candidate=>candidate.schluessel==='eingang_erkennung_nachholen');
  if(!job)throw Error('TEST_I1C_JOB_REQUIRED');
  const execute=(minute:number)=>fuehreFaelligenJobAus(tenant,{
    job,faelligFuer:job.faellig(new Date(Date.now()+minute*60_000)),
  },baueTaktLeser(tenant),async()=>true);
  const original=await secure('TEST I1c Erstes Original.png');
  expect(await execute(0)).toBe('nicht_reserviert');
  // A failed initial asynchronous attempt is represented explicitly in this isolated fixture.
  await sql`UPDATE public.intake_file SET erkennung_status='fehler' WHERE tenant_id=${tenant} AND id=${original.fileId}::uuid`;
  const endpoint='https://i1c-azure.example.invalid';
  vi.stubEnv('AZURE_DOCINTEL_ENDPOINT',endpoint);
  vi.stubEnv('AZURE_DOCINTEL_KEY','TEST-i1c-secret');
  let requests=0;
  const provider=vi.spyOn(globalThis,'fetch').mockImplementation(async(input,init)=>{
    const url=new URL(typeof input==='string'?input:input instanceof URL?input.href:input.url);
    if(url.origin!==endpoint)return nativeFetch(input,init);
    requests++;
    return new Response(null,{status:503});
  });
  try {
    for (const minute of [1,2,3]) expect(await execute(minute)).toBe('ok');
    expect(await execute(4)).toBe('nicht_reserviert');
    expect(requests).toBe(3);
    expect(await sql`SELECT von,nachher->>'fileId' AS file_id FROM public.intake_event
      WHERE tenant_id=${tenant} AND item_id=${original.itemId}::uuid AND art='erkannt'`).toEqual(
      Array.from({length:3},()=>({von:'system',file_id:original.fileId})),
    );
    expect(await withSession(full,()=>getIntakeCaptureAction(original.itemId))).toMatchObject({
      code:'OK',capture:{files:[{id:original.fileId,status:'fehler',secured:true}]},
    });
    await sql`UPDATE public.tenant_features SET enabled=false WHERE tenant=${tenant} AND feature_id='E04'`;
    const disabled=await secure('TEST I1c OCR ausgeschaltet.png');
    await sql`UPDATE public.intake_file SET erkennung_status='fehler' WHERE tenant_id=${tenant} AND id=${disabled.fileId}::uuid`;
    expect(await execute(5)).toBe('ok');
    expect(requests).toBe(3);
    expect(await withSession(full,()=>getIntakeCaptureAction(disabled.itemId))).toMatchObject({
      code:'OK',capture:{files:[{id:disabled.fileId,status:'fertig',readable:false,secured:true}]},
    });
    expect(await sql`SELECT von,nachher->>'code' AS code FROM public.intake_event
      WHERE tenant_id=${tenant} AND item_id=${disabled.itemId}::uuid AND art='erkannt'`).toEqual([{von:'system',code:'AUSGESCHALTET'}]);
  } finally {
    provider.mockRestore();
    vi.unstubAllEnvs();
  }
},30_000);
