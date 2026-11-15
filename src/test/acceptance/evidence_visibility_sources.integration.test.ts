// @vitest-environment node
import {vi,it,expect} from 'vitest';
import {randomUUID,createHash} from 'node:crypto';
const tenant=vi.hoisted(()=>'TEST-ablauf-'+globalThis.crypto.randomUUID());
vi.mock('@/lib/tenant',()=>({KREILE_TENANT_SLUG:tenant}));
import {KREILE_TENANT_SLUG} from '@/lib/tenant';
import {sql,full,withSession} from '../../../e2e/ablauf/replayHarness';
import {customerFixture,intakeOrderFixture} from '../../../e2e/ablauf/orderFixture';
import {storeItemPhoto,storeIntakeGoodsPhoto,TEST_PHOTO_BYTES} from '../../../e2e/ablauf/photoFixture';
import {finalizeGalvanikHandoffAttachmentAction} from '@/app/warendurchlauf/actions';
import {finishIntakeFileAction} from '@/app/actions/eingang.actions';
if(!process.env.DATABASE_URL||process.env.DATABASE_URL!==process.env.H18_EXPECTED_DATABASE_URL
 ||new URL(process.env.DATABASE_URL).hostname!=='127.0.0.1')throw Error('S11_LOOPBACK_TEST_REQUIRED');

it('F11-2/12 actual galvanic-part and current intake uploads share one customer flag projection and original-bound retries',async()=>{
 const customerId=await customerFixture('TEST S11 Quellen');
 const created=await intakeOrderFixture('TEST S11 Quellen',customerId),orderId=created.receipt.orderId,itemId=created.receipt.items[0].id;
 const {getGalvanikEvidenceByTargetAction}=await import('@/app/warendurchlauf/actions');
 const contentSha256=createHash('sha256').update(TEST_PHOTO_BYTES).digest('hex');
 const {transitionWareneingangToGalvanikAction,getLiveOrderCardAction}=await import('@/app/actions/orders.actions');
 expect(await withSession(full,()=>transitionWareneingangToGalvanikAction({orderId,expectedVersion:1,clientEventId:randomUUID()}))).toMatchObject({code:'OK'});
 const before=await withSession(full,()=>getLiveOrderCardAction({orderId}));
 expect(before).toMatchObject({code:'OK',data:{nextActionRule:{hauptaktion:{elementId:'order.photo'}}}});
 const part=await storeItemPhoto(orderId,itemId,true);
 const after=await withSession(full,()=>getLiveOrderCardAction({orderId}));
 expect(after).toMatchObject({code:'OK'});if(after.code!=='OK')throw Error('TEST_S11_CARD_AFTER_PHOTO');
 expect(after.data.nextActionRule?.hauptaktion?.elementId).not.toBe('order.photo');
 expect(after.data.evidence).toEqual(expect.arrayContaining([expect.objectContaining({sourceId:part,visibility:expect.objectContaining({customerVisible:true,version:1})})]));
 const partReceipt=await sql`SELECT reservation_id::text FROM private.order_station_evidence WHERE tenant_id=${KREILE_TENANT_SLUG} AND id=${part}::uuid`;
 expect(await withSession(full,()=>finalizeGalvanikHandoffAttachmentAction({reservationId:partReceipt[0].reservation_id,customerVisible:true}))).toMatchObject({code:'OK',data:{replayed:true,visibilityPending:false,visibility:{version:1}}});
 const intake=await storeIntakeGoodsPhoto(undefined,full,true);
 expect(await withSession(full,()=>finishIntakeFileAction(intake.fileId,undefined,true))).toMatchObject({code:'OK',visibilityPending:false,visibility:{customerVisible:true,version:1,actorId:full.actorId}});
 const read=await withSession(full,()=>getGalvanikEvidenceByTargetAction({targetType:'ORDER',targetId:orderId}));
 expect(read).toMatchObject({code:'OK'});if(read.code!=='OK')throw Error('TEST_S11_EVIDENCE_READ');
 for(const id of [part])expect(read.data.find(row=>row.sourceId===id)).toMatchObject({visibility:{customerVisible:true,version:1,actorId:full.actorId},original:{hash:contentSha256,sizeBytes:TEST_PHOTO_BYTES.length}});
 const events=await sql`SELECT evidence_key,count(*)::integer AS n FROM private.evidence_visibility_events WHERE tenant_id=${KREILE_TENANT_SLUG} AND record_kind='change' AND version>0 GROUP BY evidence_key`;
 expect(events).toHaveLength(2);expect(events.every(row=>row.n===1)).toBe(true);
});

it('F11-11 current intake original survives a real flag SQL fault with a source-bound existing intake task and repairs from the original file ID',async()=>{
 const fault='test_s11_intake_'+randomUUID().replaceAll('-','');
 await sql.unsafe(`CREATE FUNCTION private.${fault}() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN IF NEW.tenant_id='${KREILE_TENANT_SLUG}' AND NEW.evidence_key LIKE 'intake-file:%' AND NEW.record_kind='change' AND NEW.version>0 THEN RAISE EXCEPTION 'TEST_S11_INTAKE_FLAG_FAILURE'; END IF; RETURN NEW; END $$`);
 await sql.unsafe(`CREATE TRIGGER ${fault} BEFORE INSERT ON private.evidence_visibility_events FOR EACH ROW EXECUTE FUNCTION private.${fault}()`);
 let active=true;
 try{
  const capturedAt=new Date(Date.now()-3600000).toISOString(); // Explicit device-time boundary, stored by the actual capture action.
  const intake=await storeIntakeGoodsPhoto(undefined,full,true,capturedAt);
  expect(await withSession(full,()=>finishIntakeFileAction(intake.fileId,undefined,true))).toMatchObject({code:'OK',visibilityPending:true,visibility:{customerVisible:false,version:0}});
  const [task]=await sql`SELECT id::text,status,version,erstellt_von::text,bezug_typ,bezug_id FROM public.tasks WHERE tenant_id=${KREILE_TENANT_SLUG} AND bezug_typ='eingang' AND bezug_id=${intake.itemId}`;
  expect(task).toMatchObject({status:'offen',erstellt_von:full.actorId,bezug_typ:'eingang',bezug_id:intake.itemId});
  await sql.unsafe(`DROP TRIGGER ${fault} ON private.evidence_visibility_events`);await sql.unsafe(`DROP FUNCTION private.${fault}()`);active=false;
  const {completeIntakeTaskAction}=await import('@/app/actions/eingang.actions');
  expect(await withSession(full,()=>completeIntakeTaskAction({taskId:task.id,version:task.version,note:null}))).toMatchObject({code:'OK',task:{status:'erledigt'}});
  expect(await withSession(full,()=>finishIntakeFileAction(intake.fileId,undefined,true))).toMatchObject({code:'OK',visibilityPending:false,visibility:{customerVisible:true,version:1,occurredAt:capturedAt}});
  expect(await sql`SELECT id::text,status FROM public.tasks WHERE tenant_id=${KREILE_TENANT_SLUG} AND bezug_typ='eingang' AND bezug_id=${intake.itemId}`).toEqual([{id:task.id,status:'erledigt'}]);
 }finally{if(active){await sql.unsafe(`DROP TRIGGER IF EXISTS ${fault} ON private.evidence_visibility_events`);await sql.unsafe(`DROP FUNCTION IF EXISTS private.${fault}()`);}}
});
