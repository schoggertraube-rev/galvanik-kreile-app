// @vitest-environment node
import {vi,it,expect} from 'vitest';
import {randomUUID} from 'node:crypto';
const tenant=vi.hoisted(()=>'TEST-ablauf-'+globalThis.crypto.randomUUID());
vi.mock('@/lib/tenant',()=>({KREILE_TENANT_SLUG:tenant}));
import {KREILE_TENANT_SLUG} from '@/lib/tenant';
import {sql,full,withSession,createFixture} from '../../../e2e/ablauf/replayHarness';
import {customerFixture,intakeOrderFixture} from '../../../e2e/ablauf/orderFixture';
import {storeItemPhoto,storeOrderPhoto,storeIntakeGoodsPhoto} from '../../../e2e/ablauf/photoFixture';
if(!process.env.DATABASE_URL||process.env.DATABASE_URL!==process.env.H18_EXPECTED_DATABASE_URL
 ||new URL(process.env.DATABASE_URL).hostname!=='127.0.0.1')throw Error('S11_LOOPBACK_TEST_REQUIRED');

it('F11-1/12 real part and order photo actions retain their secured originals and project internal visibility through the existing readers',async()=>{
 const customerId=await customerFixture('S11 Sichtbarkeit');
 const created=await intakeOrderFixture('S11 Sichtbarkeit',customerId);
 const orderId=created.receipt.orderId,itemId=created.receipt.items[0].id;
 const {transitionWareneingangToGalvanikAction}=await import('@/app/actions/orders.actions');
 expect(await withSession(full,()=>transitionWareneingangToGalvanikAction({orderId,expectedVersion:1,clientEventId:randomUUID()}))).toMatchObject({code:'OK'});
 const partId=await storeItemPhoto(orderId,itemId),orderPhoto=await storeOrderPhoto(orderId);
 const {getGalvanikEvidenceByTargetAction}=await import('@/app/warendurchlauf/actions');
 const {getDomainAttachmentsAction,getDomainAttachmentOriginalAction}=await import('@/app/actions/domainAttachments.actions');
 const target={targetType:'ORDER' as const,targetId:orderId};
 const read=await withSession(full,()=>getGalvanikEvidenceByTargetAction(target));
 expect(read,JSON.stringify(read)).toMatchObject({code:'OK'});if(read.code!=='OK')throw Error('S11_EVIDENCE_READ');
 expect(read.data).toEqual(expect.arrayContaining([
  expect.objectContaining({sourceId:partId,visibility:{customerVisible:false,version:0,eventId:null,actorId:null,occurredAt:null}}),
  expect.objectContaining({sourceId:orderPhoto,visibility:{customerVisible:false,version:0,eventId:null,actorId:null,occurredAt:null}}),
 ]));
 expect(read.data.every(photo=>photo.original.hash&&photo.original.sizeBytes)).toBe(true);
 expect(await withSession(full,()=>getDomainAttachmentsAction(target))).toMatchObject({code:'OK',data:[expect.objectContaining({attachmentId:orderPhoto,visibility:{customerVisible:false,version:0,eventId:null,actorId:null,occurredAt:null}})]});
 expect(await withSession(full,()=>getDomainAttachmentOriginalAction({attachmentId:orderPhoto}))).toMatchObject({code:'OK'});
 expect(await withSession(full,()=>getGalvanikEvidenceByTargetAction(JSON.parse(JSON.stringify(target))))).toEqual(read);
 const denied=await createFixture(['kunden']);
 expect(await withSession(denied,()=>getGalvanikEvidenceByTargetAction(target))).toMatchObject({code:'FORBIDDEN'});
});

it('F11-12 actual current intake original shares the single visibility projection without copying bytes or inventing an order target',async()=>{
 const photo=await storeIntakeGoodsPhoto();
 const rows=await sql.begin(async tx=>{
  await tx`SELECT set_config('app.tenant_id',${KREILE_TENANT_SLUG},true)`;
  return tx`SELECT evidence_key,source_kind,original_hash,original_size_bytes,customer_visible,visibility_version,integrity_ok
   FROM private.v_evidence_records_v3 WHERE evidence_key=${'intake-file:'+photo.fileId}`;
 });
 expect(rows).toHaveLength(1);expect(rows[0]).toMatchObject({evidence_key:'intake-file:'+photo.fileId,source_kind:'INTAKE_FILE',customer_visible:false,visibility_version:0,integrity_ok:true});
 const original=await sql`SELECT sha256,bytes FROM public.intake_file WHERE tenant_id=${KREILE_TENANT_SLUG} AND id=${photo.fileId}::uuid`;
 expect(rows[0].original_hash).toBe(original[0].sha256);expect(Number(rows[0].original_size_bytes)).toBe(Number(original[0].bytes));
 expect(await sql`SELECT count(*)::integer AS n FROM private.evidence_visibility_events WHERE tenant_id=${KREILE_TENANT_SLUG}`).toEqual([{n:0}]);
});
