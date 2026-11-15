// @vitest-environment node
import {vi,it,expect} from 'vitest';
import {randomUUID} from 'node:crypto';
const tenant=vi.hoisted(()=>'TEST-ablauf-'+globalThis.crypto.randomUUID());
vi.mock('@/lib/tenant',()=>({KREILE_TENANT_SLUG:tenant}));
import {KREILE_TENANT_SLUG} from '@/lib/tenant';
import {sql,full,withSession,createFixture} from '../../../e2e/ablauf/replayHarness';
import {customerFixture,intakeOrderFixture} from '../../../e2e/ablauf/orderFixture';
import {storeOrderPhoto,storeIntakeGoodsPhoto} from '../../../e2e/ablauf/photoFixture';
if(!process.env.DATABASE_URL||process.env.DATABASE_URL!==process.env.H18_EXPECTED_DATABASE_URL
 ||new URL(process.env.DATABASE_URL).hostname!=='127.0.0.1')throw Error('S11_LOOPBACK_TEST_REQUIRED');

async function orderPhoto(){
 const customerId=await customerFixture('TEST S11 Kennzeichen');
 const order=await intakeOrderFixture('TEST S11 Kennzeichen',customerId);
 const orderId=order.receipt.orderId,photoId=await storeOrderPhoto(orderId);
 const {getGalvanikEvidenceByTargetAction}=await import('@/app/warendurchlauf/actions');
 const read=await withSession(full,()=>getGalvanikEvidenceByTargetAction({targetType:'ORDER',targetId:orderId}));
 if(read.code!=='OK')throw Error('TEST_S11_ORIGINAL_SOURCE');
 const photo=read.data.find(row=>row.sourceId===photoId);if(!photo)throw Error('TEST_S11_ORIGINAL_MISSING');
 return {orderId,photoId,evidenceKey:photo.evidenceKey,original:photo.original};
}

it('F11-4/5/6 real setter preserves original bytes, before/after and actor; concurrent clicks and fresh retries create one event',async()=>{
 const photo=await orderPhoto();
 const {setEvidenceVisibilityAction,getDomainAttachmentsAction}=await import('@/app/actions/domainAttachments.actions');
 const operator=await createFixture(['auftraege']),other=await createFixture(['auftraege']);
 const input={evidenceKey:photo.evidenceKey,customerVisible:true,expectedVersion:0,clientEventId:randomUUID()};
 const results=await Promise.all([withSession(operator,()=>setEvidenceVisibilityAction(input)),withSession(operator,()=>setEvidenceVisibilityAction(JSON.parse(JSON.stringify(input))))]);
 expect(results).toEqual(expect.arrayContaining([expect.objectContaining({code:'OK',replayed:false}),expect.objectContaining({code:'OK',replayed:true})]));
 const result=results.find(row=>row.code==='OK');if(!result||result.code!=='OK')throw Error('TEST_S11_CHANGED');
 expect(result.data).toMatchObject({customerVisible:true,version:1,actorId:operator.actorId});
 expect(await withSession(operator,()=>setEvidenceVisibilityAction(JSON.parse(JSON.stringify(input))))).toEqual({...result,replayed:true});
 expect(await withSession(other,()=>setEvidenceVisibilityAction(input))).toMatchObject({code:'CONFLICT'});
 expect(await withSession(other,()=>setEvidenceVisibilityAction({...input,clientEventId:randomUUID()}))).toMatchObject({code:'CONFLICT',current:{version:1,customerVisible:true}});
 expect(await withSession(operator,()=>setEvidenceVisibilityAction({...input,expectedVersion:1,clientEventId:randomUUID()}))).toMatchObject({code:'OK',data:{version:1}});
 const [event]=await sql`SELECT actor_id::text,previous_visible,customer_visible,version,occurred_at FROM private.evidence_visibility_events WHERE tenant_id=${KREILE_TENANT_SLUG} AND evidence_key=${photo.evidenceKey}`;
 expect(event).toMatchObject({actor_id:operator.actorId,previous_visible:false,customer_visible:true,version:1});
 expect(event.occurred_at).toBeTruthy();
 expect(await sql`SELECT id FROM private.evidence_visibility_events WHERE tenant_id=${KREILE_TENANT_SLUG} AND evidence_key=${photo.evidenceKey}`).toHaveLength(1);
 expect(await withSession(operator,()=>getDomainAttachmentsAction({targetType:'ORDER',targetId:photo.orderId}))).toMatchObject({code:'OK',data:[expect.objectContaining({attachmentId:photo.photoId,visibility:{...result.data}})]});
 const back={...input,customerVisible:false,expectedVersion:1,clientEventId:randomUUID()};
 expect(await withSession(operator,()=>setEvidenceVisibilityAction(back))).toMatchObject({code:'OK',data:{customerVisible:false,version:2,actorId:operator.actorId}});
 // A historical retry does not reapply an old flag over the newer event.
 expect(await withSession(operator,()=>setEvidenceVisibilityAction(input))).toEqual({...result,replayed:true});
 const {getGalvanikEvidenceByTargetAction}=await import('@/app/warendurchlauf/actions');
 const read=await withSession(operator,()=>getGalvanikEvidenceByTargetAction({targetType:'ORDER',targetId:photo.orderId}));
 if(read.code!=='OK')throw Error('TEST_S11_NEUREAD');
 expect(read.data.find(row=>row.sourceId===photo.photoId)).toMatchObject({original:photo.original,visibility:{version:2,customerVisible:false}});
});

it('F11-7 current intake and order originals use the existing source-specific edit rights without an additional viewer or money right',async()=>{
 const intake=await storeIntakeGoodsPhoto(),photo=await orderPhoto();
 const {setEvidenceVisibilityAction}=await import('@/app/actions/domainAttachments.actions');
 const intakeActor=await createFixture(['eingang']),orderActor=await createFixture(['auftraege']),denied=await createFixture(['kunden']);
 const input={evidenceKey:'intake-file:'+intake.fileId,customerVisible:true,expectedVersion:0,clientEventId:randomUUID()};
 expect(await withSession(denied,()=>setEvidenceVisibilityAction(input))).toMatchObject({code:'FORBIDDEN'});
 expect(await withSession(orderActor,()=>setEvidenceVisibilityAction(input))).toMatchObject({code:'FORBIDDEN'});
 expect(await withSession(intakeActor,()=>setEvidenceVisibilityAction(input))).toMatchObject({code:'OK',data:{actorId:intakeActor.actorId,customerVisible:true,version:1}});
 expect(await withSession(intakeActor,()=>setEvidenceVisibilityAction({...input,evidenceKey:photo.evidenceKey,clientEventId:randomUUID()}))).toMatchObject({code:'FORBIDDEN'});
 expect(await withSession(orderActor,()=>setEvidenceVisibilityAction({...input,evidenceKey:photo.evidenceKey,clientEventId:randomUUID()}))).toMatchObject({code:'OK'});
});

it('F11-8 a real SQL save failure keeps the current flag unchanged and the same request succeeds after repair',async()=>{
 const photo=await orderPhoto();
 const {setEvidenceVisibilityAction}=await import('@/app/actions/domainAttachments.actions');
 const input={evidenceKey:photo.evidenceKey,customerVisible:true,expectedVersion:0,clientEventId:randomUUID()};
 const fault='test_s11_'+randomUUID().replaceAll('-','');
 await sql.unsafe(`CREATE FUNCTION private.${fault}() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN IF NEW.tenant_id='${KREILE_TENANT_SLUG}' THEN RAISE EXCEPTION 'TEST_S11_REAL_SQL_SAVE_FAILURE'; END IF; RETURN NEW; END $$`);
 await sql.unsafe(`CREATE TRIGGER ${fault} BEFORE INSERT ON private.evidence_visibility_events FOR EACH ROW EXECUTE FUNCTION private.${fault}()`);
 try{
  expect(await withSession(full,()=>setEvidenceVisibilityAction(input))).toMatchObject({code:'UNAVAILABLE'});
  expect(await sql`SELECT id FROM private.evidence_visibility_events WHERE tenant_id=${KREILE_TENANT_SLUG} AND evidence_key=${photo.evidenceKey}`).toHaveLength(0);
 }finally{await sql.unsafe(`DROP TRIGGER IF EXISTS ${fault} ON private.evidence_visibility_events`);await sql.unsafe(`DROP FUNCTION IF EXISTS private.${fault}()`);}
 expect(await withSession(full,()=>setEvidenceVisibilityAction(JSON.parse(JSON.stringify(input))))).toMatchObject({code:'OK',data:{customerVisible:true,version:1}});
});
