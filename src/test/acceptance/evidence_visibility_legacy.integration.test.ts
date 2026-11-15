// @vitest-environment node
// TEST-only migration boundary. A fresh isolated schema173 receives a real old
// original before the four S11 migrations; the shared working DB is never used.
import {it,expect,vi} from 'vitest';
import {randomUUID,createHash} from 'node:crypto';
import {readFileSync,readdirSync} from 'node:fs';
const tenant=vi.hoisted(()=>'TEST-ablauf-'+globalThis.crypto.randomUUID());
vi.mock('@/lib/tenant',()=>({KREILE_TENANT_SLUG:tenant}));
import {KREILE_TENANT_SLUG} from '@/lib/tenant';
import {sql,full,withSession} from '../../../e2e/ablauf/replayHarness';
import {customerFixture} from '../../../e2e/ablauf/orderFixture';
import {TEST_PHOTO_BYTES} from '../../../e2e/ablauf/photoFixture';
import {resolveAuthorization} from '@/lib/server/authorization';
import {reserveDomainAttachmentAction,getDomainAttachmentOriginalAction} from '@/app/actions/domainAttachments.actions';
import {finalizeDomainAttachment} from '@/lib/server/domainAttachment';

const dedicated=process.env.KREILE_S11_LEGACY_BOUNDARY==='true'&&!!process.env.DATABASE_URL&&new URL(process.env.DATABASE_URL).port==='54352';
it.skipIf(!dedicated)('F11-3 actual pre-S11 original is explicitly backfilled as internal by the fresh migration, without changing its stored bytes or inventing an actor',async()=>{
 const files=readdirSync('supabase/migrations').filter(file=>/^\d{14}_.+\.sql$/.test(file)).sort();
 expect(files).toHaveLength(177);
 expect(await sql`SELECT count(*)::integer AS n FROM supabase_migrations.schema_migrations`).toEqual([{n:173}]);
 const customerId=await customerFixture('TEST S11 echtes Altfoto'),hash=createHash('sha256').update(TEST_PHOTO_BYTES).digest('hex');
 const reserved=await withSession(full,()=>reserveDomainAttachmentAction({targetType:'CUSTOMER',targetId:customerId,clientRequestId:randomUUID(),mimeType:'image/png',fileBytes:TEST_PHOTO_BYTES.length,contentSha256:hash}));
 if(reserved.code!=='OK'||!reserved.data.upload)throw Error('TEST_S11_LEGACY_RESERVATION');
 const attachmentId=reserved.data.receipt.attachmentId,url=new URL('/storage/v1/object/upload/sign/scans/'+reserved.data.upload.path,process.env.NEXT_PUBLIC_SUPABASE_URL);
 expect(url.hostname).toBe('127.0.0.1');url.searchParams.set('token',reserved.data.upload.token);
 expect((await fetch(url,{method:'PUT',headers:{'content-type':'image/png','x-upsert':'false'},body:new Blob([new Uint8Array(TEST_PHOTO_BYTES).buffer],{type:'image/png'})})).ok).toBe(true);
 const auth=await withSession(full,()=>resolveAuthorization());if(!auth.ok)throw Error('TEST_S11_LEGACY_AUTH');
 // The pre-existing native writer, before S11 composition exists in the schema.
 expect(await finalizeDomainAttachment(auth.data,{attachmentId,fileBytes:TEST_PHOTO_BYTES.length,contentSha256:hash})).toMatchObject({code:'OK',data:{replayed:false}});
 const before=await sql`SELECT * FROM public.scan_uploads WHERE tenant_id=${KREILE_TENANT_SLUG} AND id=${attachmentId}`;
 expect(before).toHaveLength(1);expect(before[0]).toMatchObject({status:'secured',original_hash:hash});
 const original=await withSession(full,()=>getDomainAttachmentOriginalAction({attachmentId}));expect(original).toMatchObject({code:'OK'});
 for(const file of files.slice(173)){
  const source=readFileSync('supabase/migrations/'+file,'utf8');
  const rollback=new Error('TEST_S11_EXPECTED_DDL_ROLLBACK');
  try{await sql.begin(async tx=>{await tx.unsafe('SET search_path=public,extensions');await tx.unsafe(source);throw rollback;});}
  catch(error){if(error!==rollback)throw error;}
  await sql.unsafe('RESET ROLE; SET search_path=public,extensions');await sql.unsafe(source);
  await sql`INSERT INTO supabase_migrations.schema_migrations(version,name,statements) VALUES(${file.slice(0,14)},${file.slice(15,-4)},${[source]}::text[])`;
 }
 expect(await sql`SELECT * FROM public.scan_uploads WHERE tenant_id=${KREILE_TENANT_SLUG} AND id=${attachmentId}`).toEqual(before);
 const baseline=await sql.begin(async tx=>{await tx`SELECT set_config('app.tenant_id',${KREILE_TENANT_SLUG},true)`;return tx`SELECT customer_visible,visibility_version,visibility_actor_id,original_hash FROM private.v_evidence_records_v3 WHERE evidence_key=${'legacy-scan-upload:'+attachmentId}`;});
 expect(baseline).toEqual([{customer_visible:false,visibility_version:0,visibility_actor_id:null,original_hash:hash}]);
 expect(await sql`SELECT version,customer_visible,actor_id,client_event_id,record_kind FROM private.evidence_visibility_events WHERE tenant_id=${KREILE_TENANT_SLUG} AND evidence_key=${'legacy-scan-upload:'+attachmentId}`).toEqual([{version:0,customer_visible:false,actor_id:null,client_event_id:null,record_kind:'change'}]);
 expect(await withSession(full,()=>getDomainAttachmentOriginalAction({attachmentId}))).toEqual(original);
});
