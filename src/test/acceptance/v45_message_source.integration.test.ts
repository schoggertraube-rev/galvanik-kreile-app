// @vitest-environment node
import {it,expect,vi} from 'vitest';
import {randomUUID} from 'node:crypto';
const tenant=vi.hoisted(()=>'TEST-ablauf-'+globalThis.crypto.randomUUID());
vi.mock('@/lib/tenant',()=>({KREILE_TENANT_SLUG:tenant}));
import {KREILE_TENANT_SLUG} from '@/lib/tenant';
import {sql,full,withSession,createFixture} from '../../../e2e/ablauf/replayHarness';
import {customerFixture} from '../../../e2e/ablauf/orderFixture';
import {saveIntakeNoteAction,getIntakeMessagesAction} from '@/app/actions/eingang.actions';

it('reads the stored send state and actor for U2 without inferring an unclear dispatch from message text',async()=>{
 const customerId=await customerFixture('V45 Nachrichten'),itemId=randomUUID();
 expect(await withSession(full,()=>saveIntakeNoteAction({itemId,textstand:randomUUID(),text:'TEST normale Nachricht, kein Status aus Text',concerns:[],context:{customerId}}))).toMatchObject({code:'OK'});
 // Explicitly synthetic projection fixture, not a physical-mail/write proof.
 // Dispatch/reconciliation itself is covered by the existing N5 real round trips.
 await sql`UPDATE public.intake_item SET kanal='mail',richtung='raus',sendestatus='unklar',einsatz='offen' WHERE tenant_id=${KREILE_TENANT_SLUG} AND id=${itemId}::uuid`;
 const read=await withSession(full,()=>getIntakeMessagesAction('alle'));if(read.code!=='OK')throw Error('TEST_MESSAGE_READ');
 expect(read.messages.find(row=>row.id===itemId)).toMatchObject({sendState:'unklar',direction:'raus',createdBy:full.actorId,text:'TEST normale Nachricht, kein Status aus Text'});
 expect(await withSession(full,()=>getIntakeMessagesAction('alle'))).toEqual(read);
 await sql`UPDATE public.intake_item SET sendestatus='gesendet' WHERE tenant_id=${KREILE_TENANT_SLUG} AND id=${itemId}::uuid`;
 const after=await withSession(full,()=>getIntakeMessagesAction('alle'));if(after.code!=='OK')throw Error('TEST_MESSAGE_REREAD');
 expect(after.messages.find(row=>row.id===itemId)).toMatchObject({sendState:'gesendet',createdBy:full.actorId});
 const restricted=await createFixture(['eingang'],'werkstatt');expect(await withSession(restricted,()=>getIntakeMessagesAction('alle'))).toMatchObject({code:'FORBIDDEN'});
});
