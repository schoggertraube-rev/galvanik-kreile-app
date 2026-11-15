// @vitest-environment node
import {vi,it,expect} from 'vitest';
import {randomUUID} from 'node:crypto';
const tenant=vi.hoisted(()=>'TEST-ablauf-'+globalThis.crypto.randomUUID());
vi.mock('@/lib/tenant',()=>({KREILE_TENANT_SLUG:tenant}));
import {KREILE_TENANT_SLUG} from '@/lib/tenant';
import {sql,full,withSession} from '../../../e2e/ablauf/replayHarness';
import {runQuoteQuantityCase} from '../../../e2e/ablauf/quoteQuantityCase';
import {customerFixture,intakeOrderFixture} from '../../../e2e/ablauf/orderFixture';
import {storeOrderPhoto} from '../../../e2e/ablauf/photoFixture';
import {setEvidenceVisibilityAction} from '@/app/actions/domainAttachments.actions';
if(!process.env.DATABASE_URL||process.env.DATABASE_URL!==process.env.H18_EXPECTED_DATABASE_URL
 ||new URL(process.env.DATABASE_URL).hostname!=='127.0.0.1')throw Error('S11_LOOPBACK_TEST_REQUIRED');

it('KORR S11 1 actual quote-conversion reversal cancels the order: revoking photo release still works, a new customer release is blocked',async()=>{
 await runQuoteQuantityCase({name:'S11 Storno',quantity:1,received:1,total:10000,expected:10000,hours:null,operational:false,fixed:0,
  inspect:async({orderId,quoteId})=>{
   const photoId=await storeOrderPhoto(orderId),evidenceKey='legacy-scan-upload:'+photoId;
   const first={evidenceKey,customerVisible:true,expectedVersion:0,clientEventId:randomUUID()};
   expect(await withSession(full,()=>setEvidenceVisibilityAction(first))).toMatchObject({code:'OK',data:{customerVisible:true,version:1}});
   const {readQuoteAction,undoQuoteConversionAction}=await import('@/app/actions/quotes.actions');
   const quote=await withSession(full,()=>readQuoteAction({quoteId,purpose:'operations'}));
   expect(quote).toMatchObject({code:'OK',undo:{canUndo:true}});if(quote.code!=='OK')throw Error('TEST_S11_UNDO_SOURCE');
   expect(await withSession(full,()=>undoQuoteConversionAction({quoteId,expectedVersion:quote.quote.version,clientEventId:randomUUID(),reason:'TEST S11 falsche Auftragszuordnung'}))).toMatchObject({code:'OK'});
   expect(await sql`SELECT status FROM public.orders WHERE tenant_id=${KREILE_TENANT_SLUG} AND id=${orderId}`).toEqual([{status:'storniert'}]);
   const internal={evidenceKey,customerVisible:false,expectedVersion:1,clientEventId:randomUUID()};
   const saved=await withSession(full,()=>setEvidenceVisibilityAction(internal));
   expect(saved).toMatchObject({code:'OK',data:{customerVisible:false,version:2,actorId:full.actorId}});
   expect(await withSession(full,()=>setEvidenceVisibilityAction(JSON.parse(JSON.stringify(internal))))).toEqual({...saved,replayed:true});
   expect(await withSession(full,()=>setEvidenceVisibilityAction({evidenceKey,customerVisible:true,expectedVersion:2,clientEventId:randomUUID()}))).toMatchObject({code:'CONFLICT'});
   expect(await sql`SELECT version,customer_visible,actor_id::text FROM private.evidence_visibility_events WHERE tenant_id=${KREILE_TENANT_SLUG} AND evidence_key=${evidenceKey} AND record_kind='change' ORDER BY version`).toEqual([
    {version:1,customer_visible:true,actor_id:full.actorId},{version:2,customer_visible:false,actor_id:full.actorId},
   ]);
  }});
});

it('KORR S11 3 a successful N5 returns its stored receipt after a real source-integrity fault; new requests still fail until the source is repaired',async()=>{
 const customerId=await customerFixture('TEST S11 Replay'),otherCustomer=await customerFixture('TEST S11 Quellfehler');
 const created=await intakeOrderFixture('TEST S11 Replay',customerId),photoId=await storeOrderPhoto(created.receipt.orderId),evidenceKey='legacy-scan-upload:'+photoId;
 const first={evidenceKey,customerVisible:true,expectedVersion:0,clientEventId:randomUUID()};
 const saved=await withSession(full,()=>setEvidenceVisibilityAction(first));expect(saved).toMatchObject({code:'OK'});
 // Explicit isolated corruption boundary, not a product reassignment action.
 await sql`UPDATE public.scan_uploads SET linked_customer_id=${otherCustomer} WHERE tenant_id=${KREILE_TENANT_SLUG} AND id=${photoId}`;
 try{
  const rows=await sql.begin(async tx=>{await tx`SELECT set_config('app.tenant_id',${KREILE_TENANT_SLUG},true)`;return tx`SELECT integrity_ok FROM private.v_evidence_records_v3 WHERE tenant_id=${KREILE_TENANT_SLUG} AND evidence_key=${evidenceKey}`;});
  expect(rows).toEqual([{integrity_ok:false}]);
  expect(await withSession(full,()=>setEvidenceVisibilityAction(JSON.parse(JSON.stringify(first))))).toEqual({...saved,replayed:true});
  expect(await withSession(full,()=>setEvidenceVisibilityAction({evidenceKey,customerVisible:false,expectedVersion:1,clientEventId:randomUUID()}))).toMatchObject({code:'UNAVAILABLE'});
  expect(await sql`SELECT id FROM private.evidence_visibility_events WHERE tenant_id=${KREILE_TENANT_SLUG} AND evidence_key=${evidenceKey} AND record_kind='change'`).toHaveLength(1);
 }finally{await sql`UPDATE public.scan_uploads SET linked_customer_id=${customerId} WHERE tenant_id=${KREILE_TENANT_SLUG} AND id=${photoId}`;}
 expect(await withSession(full,()=>setEvidenceVisibilityAction({evidenceKey,customerVisible:false,expectedVersion:1,clientEventId:randomUUID()}))).toMatchObject({code:'OK',data:{version:2,customerVisible:false}});
});
