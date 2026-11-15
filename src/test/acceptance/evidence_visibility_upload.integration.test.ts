// @vitest-environment node
import {vi,it,expect} from 'vitest';
import {randomUUID,createHash} from 'node:crypto';
const tenant=vi.hoisted(()=>'TEST-ablauf-'+globalThis.crypto.randomUUID());
vi.mock('@/lib/tenant',()=>({KREILE_TENANT_SLUG:tenant}));
import {KREILE_TENANT_SLUG} from '@/lib/tenant';
import {sql,full,withSession,createFixture} from '../../../e2e/ablauf/replayHarness';
import {customerFixture,intakeOrderFixture} from '../../../e2e/ablauf/orderFixture';
import {finalizeDomainAttachmentAction} from '@/app/actions/domainAttachments.actions';
import {TEST_PHOTO_BYTES} from '../../../e2e/ablauf/photoFixture';
if(!process.env.DATABASE_URL||process.env.DATABASE_URL!==process.env.H18_EXPECTED_DATABASE_URL
 ||new URL(process.env.DATABASE_URL).hostname!=='127.0.0.1')throw Error('S11_LOOPBACK_TEST_REQUIRED');

async function prepare(){
 const customerId=await customerFixture('TEST S11 Upload');
 const order=await intakeOrderFixture('TEST S11 Upload',customerId),orderId=order.receipt.orderId;
 const actions=await import('@/app/actions/domainAttachments.actions');
 const contentSha256=createHash('sha256').update(TEST_PHOTO_BYTES).digest('hex');
 const reserved=await withSession(full,()=>actions.reserveDomainAttachmentAction({targetType:'ORDER',targetId:orderId,clientRequestId:randomUUID(),mimeType:'image/png',fileBytes:TEST_PHOTO_BYTES.length,contentSha256}));
 if(reserved.code!=='OK'||!reserved.data.upload)throw Error('TEST_S11_RESERVE');
 const url=new URL('/storage/v1/object/upload/sign/scans/'+reserved.data.upload.path,process.env.NEXT_PUBLIC_SUPABASE_URL);
 if(url.hostname!=='127.0.0.1')throw Error('TEST_S11_STORAGE_LOOPBACK');url.searchParams.set('token',reserved.data.upload.token);
 expect((await fetch(url,{method:'PUT',headers:{'content-type':'image/png','x-upsert':'false'},body:new Blob([new Uint8Array(TEST_PHOTO_BYTES).buffer],{type:'image/png'})})).ok).toBe(true);
 const attachmentId=reserved.data.receipt.attachmentId;
 return {orderId,attachmentId,evidenceKey:'legacy-scan-upload:'+attachmentId,actions,input:{attachmentId,fileBytes:TEST_PHOTO_BYTES.length,contentSha256,customerVisible:true}};
}

async function faultFor(photo:{evidenceKey:string},history=false){
 const fault='test_s11_'+randomUUID().replaceAll('-','');
 await sql.unsafe(`CREATE FUNCTION private.${fault}() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN IF NEW.tenant_id='${KREILE_TENANT_SLUG}' AND ${history?"NEW.nachher->>'action'='aufgabe.angelegt'":`NEW.evidence_key='${photo.evidenceKey}' AND NEW.record_kind='change' AND NEW.version>0`} THEN RAISE EXCEPTION 'TEST_S11_${history?'TASK_HISTORY':'FLAG_SQL'}_FAILURE'; END IF; RETURN NEW; END $$`);
 const table=history?'public.intake_event':'private.evidence_visibility_events';
 await sql.unsafe(`CREATE TRIGGER ${fault} BEFORE INSERT ON ${table} FOR EACH ROW EXECUTE FUNCTION private.${fault}()`);
 return async()=>{await sql.unsafe(`DROP TRIGGER IF EXISTS ${fault} ON ${table}`);await sql.unsafe(`DROP FUNCTION IF EXISTS private.${fault}()`);};
}

it('F11-2 actual upload sets the customer flag once with original actor and secured bytes; a fresh finalization retry does not duplicate either effect',async()=>{
 const photo=await prepare();
 const result=await withSession(full,()=>finalizeDomainAttachmentAction(photo.input));
 expect(result,JSON.stringify(result)).toMatchObject({code:'OK',data:{receipt:{attachmentId:photo.attachmentId,state:'FINALIZED'},visibilityPending:false,visibility:{customerVisible:true,version:1,actorId:full.actorId}}});
 const retry=await withSession(full,()=>finalizeDomainAttachmentAction(JSON.parse(JSON.stringify(photo.input))));
 expect(retry).toMatchObject({code:'OK',data:{replayed:true,visibilityPending:false,visibility:{customerVisible:true,version:1}}});
 expect(await sql`SELECT record_kind,version,customer_visible,requested_visible,actor_id::text FROM private.evidence_visibility_events WHERE tenant_id=${KREILE_TENANT_SLUG} AND evidence_key=${photo.evidenceKey} ORDER BY record_kind`).toEqual([
  {record_kind:'change',version:1,customer_visible:true,requested_visible:null,actor_id:full.actorId},
  {record_kind:'upload_intent',version:0,customer_visible:false,requested_visible:true,actor_id:full.actorId},
 ]);
 expect(await sql`SELECT original_hash,status FROM public.scan_uploads WHERE tenant_id=${KREILE_TENANT_SLUG} AND id=${photo.attachmentId}`).toEqual([{original_hash:photo.input.contentSha256,status:'secured'}]);
 // K13K-3: the existing server reader still opens the secured original through
 // its signed URL; repeat reading never regenerates or replaces its bytes.
 const originalInput={attachmentId:photo.attachmentId};
 for(let attempt=0;attempt<2;attempt++){
  const original=await withSession(full,()=>photo.actions.getDomainAttachmentOriginalAction(JSON.parse(JSON.stringify(originalInput))));
  expect(original).toMatchObject({code:'OK',data:{mimeType:'image/png',expiresInSeconds:60}});
  if(original.code!=='OK')throw Error('TEST_S13K_ORIGINAL_READ');
  expect(new URL(original.data.downloadUrl).hostname).toBe('127.0.0.1');
  const response=await fetch(original.data.downloadUrl);expect(response.ok).toBe(true);
  const bytes=new Uint8Array(await response.arrayBuffer());
  expect(bytes).toEqual(new Uint8Array(TEST_PHOTO_BYTES));
  expect(createHash('sha256').update(bytes).digest('hex')).toBe(photo.input.contentSha256);
 }
 const denied=await createFixture([]);
 expect(await withSession(denied,()=>photo.actions.getDomainAttachmentOriginalAction(originalInput))).toMatchObject({code:'FORBIDDEN'});
 expect(await sql`SELECT id FROM public.tasks WHERE tenant_id=${KREILE_TENANT_SLUG} AND bezug_id=${photo.orderId}`).toHaveLength(0);
});

it('F11-10 closing an unfinalized reservation creates neither evidence nor visibility; the same real reservation can be finalized once after resuming',async()=>{
 const photo=await prepare();
 expect(await sql`SELECT status FROM public.scan_uploads WHERE tenant_id=${KREILE_TENANT_SLUG} AND id=${photo.attachmentId}`).toEqual([{status:'upload_reserved'}]);
 expect(await sql`SELECT id FROM private.evidence_visibility_events WHERE tenant_id=${KREILE_TENANT_SLUG} AND evidence_key=${photo.evidenceKey}`).toHaveLength(0);
 const before=await withSession(full,()=>photo.actions.getDomainAttachmentsAction({targetType:'ORDER',targetId:photo.orderId}));
 expect(before).toMatchObject({code:'OK',data:[]});
 const result=await withSession(full,()=>finalizeDomainAttachmentAction(JSON.parse(JSON.stringify(photo.input))));
 expect(result).toMatchObject({code:'OK',data:{receipt:{attachmentId:photo.attachmentId},visibility:{customerVisible:true,version:1}}});
 const after=await withSession(full,()=>photo.actions.getDomainAttachmentsAction({targetType:'ORDER',targetId:photo.orderId}));
 expect(after).toMatchObject({code:'OK',data:[{attachmentId:photo.attachmentId,visibility:{customerVisible:true,version:1}}]});
 expect(await withSession(full,()=>finalizeDomainAttachmentAction(JSON.parse(JSON.stringify(photo.input))))).toMatchObject({code:'OK',data:{replayed:true,visibility:{version:1}}});
});

it('F11-11 real flag and task SQL failures retain the photo and immutable marker without ACK; same original repairs one normal task and one flag event',async()=>{
 const photo=await prepare(),dropFlag=await faultFor(photo),dropHistory=await faultFor(photo,true);
 let historyActive=true,flagActive=true;
 try{
  expect(await withSession(full,()=>finalizeDomainAttachmentAction(photo.input))).toMatchObject({code:'UNAVAILABLE'});
  expect(await sql`SELECT status,original_hash FROM public.scan_uploads WHERE tenant_id=${KREILE_TENANT_SLUG} AND id=${photo.attachmentId}`).toEqual([{status:'secured',original_hash:photo.input.contentSha256}]);
  const [marker]=await sql`SELECT id::text,actor_id::text FROM private.evidence_visibility_events WHERE tenant_id=${KREILE_TENANT_SLUG} AND evidence_key=${photo.evidenceKey} AND record_kind='upload_intent'`;
  expect(marker).toMatchObject({actor_id:full.actorId});
  await expect(sql`UPDATE private.evidence_visibility_events SET requested_visible=false WHERE id=${marker.id}::uuid`).rejects.toMatchObject({code:'P0001'});
  expect(await sql`SELECT id FROM public.tasks WHERE tenant_id=${KREILE_TENANT_SLUG} AND client_key=${marker.id}::uuid`).toHaveLength(0);
  await dropHistory();historyActive=false;
  expect(await withSession(full,()=>finalizeDomainAttachmentAction(JSON.parse(JSON.stringify(photo.input))))).toMatchObject({code:'OK',data:{replayed:true,visibilityPending:true,visibility:{customerVisible:false,version:0}}});
  const [task]=await sql`SELECT id::text,status,version,erstellt_von::text,fuer_bereich FROM public.tasks WHERE tenant_id=${KREILE_TENANT_SLUG} AND client_key=${marker.id}::uuid`;
  expect(task).toMatchObject({status:'offen',erstellt_von:full.actorId,fuer_bereich:'geld'});
  const {getIntakeTaskAction,completeIntakeTaskAction}=await import('@/app/actions/eingang.actions');
  expect(await withSession(full,()=>getIntakeTaskAction({taskId:task.id}))).toMatchObject({code:'OK',task:{id:task.id,status:'offen'}});
  expect(await withSession(full,()=>completeIntakeTaskAction({taskId:task.id,version:task.version,note:null}))).toMatchObject({code:'UNAVAILABLE'});
  await dropFlag();flagActive=false;
  expect(await withSession(full,()=>finalizeDomainAttachmentAction(JSON.parse(JSON.stringify(photo.input))))).toMatchObject({code:'OK',data:{replayed:true,visibilityPending:false,visibility:{customerVisible:true,version:1}}});
  expect(await sql`SELECT id::text,status FROM public.tasks WHERE tenant_id=${KREILE_TENANT_SLUG} AND client_key=${marker.id}::uuid`).toEqual([{id:task.id,status:'erledigt'}]);
  expect(await sql`SELECT id FROM private.evidence_visibility_events WHERE tenant_id=${KREILE_TENANT_SLUG} AND evidence_key=${photo.evidenceKey} AND record_kind='change'`).toHaveLength(1);
 }finally{if(historyActive)await dropHistory();if(flagActive)await dropFlag();}
});

it('F11-11 the existing task completion action repairs with the real authorized completing actor, while the upload actor remains immutable',async()=>{
 const decider=await createFixture(['entscheiden','auftraege']),photo=await prepare(),dropFlag=await faultFor(photo);
 let active=true;
 try{
  expect(await withSession(full,()=>finalizeDomainAttachmentAction(photo.input))).toMatchObject({code:'OK',data:{visibilityPending:true}});
  const [task]=await sql`SELECT id::text,version,client_key::text,fuer_bereich FROM public.tasks WHERE tenant_id=${KREILE_TENANT_SLUG} AND bezug_id=${photo.orderId}`;
  expect(task.fuer_bereich).toBe('entscheiden');await dropFlag();active=false;
  const {completeIntakeTaskAction}=await import('@/app/actions/eingang.actions');
  expect(await withSession(decider,()=>completeIntakeTaskAction({taskId:task.id,version:task.version,note:null}))).toMatchObject({code:'OK',task:{status:'erledigt',erledigt_von:decider.actorId}});
  expect(await sql`SELECT actor_id::text FROM private.evidence_visibility_events WHERE tenant_id=${KREILE_TENANT_SLUG} AND evidence_key=${photo.evidenceKey} AND record_kind='change'`).toEqual([{actor_id:decider.actorId}]);
  expect(await sql`SELECT actor_id::text FROM private.evidence_visibility_events WHERE id=${task.client_key}::uuid`).toEqual([{actor_id:full.actorId}]);
  expect(await withSession(full,()=>finalizeDomainAttachmentAction(JSON.parse(JSON.stringify(photo.input))))).toMatchObject({code:'OK',data:{visibilityPending:false,visibility:{customerVisible:true,version:1}}});
 }finally{if(active)await dropFlag();}
});
