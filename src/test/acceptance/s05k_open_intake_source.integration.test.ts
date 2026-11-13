// @vitest-environment node
// Synthetic stored mail states test read projections only, not physical mail import.
import {it,expect,vi} from 'vitest';
import {randomUUID} from 'node:crypto';
const tenant=vi.hoisted(()=>'TEST-ablauf-'+globalThis.crypto.randomUUID());
vi.mock('@/lib/tenant',()=>({KREILE_TENANT_SLUG:tenant}));
import {sql,full,withSession} from '../../../e2e/ablauf/replayHarness';
import {customerFixture} from '../../../e2e/ablauf/orderFixture';
import {saveIntakeNoteAction,getIntakeMessagesAction} from '@/app/actions/eingang.actions';
import {readOpenIntakeMails} from '@/modules/eingang/server-public';
import {readCustomerListSignals} from '@/lib/server/customerSummaryRead';
import {resolveAuthorization} from '@/lib/server/authorization';
import {readTodayDashboard} from '@/lib/server/todayDashboard';
import {getComplaints} from '@/app/actions/complaints.actions';
import {getQuoteFollowupsForTodayAction} from '@/app/actions/quotes.actions';

it('S05K A3 keeps one open predicate while the sorting selection additionally requires unassigned mail',async()=>{
 const customers:string[]=[],active:string[]=[];
 for(const [index,state] of [{usage:'offen',assignment:'offen',discard:null},{usage:'offen',assignment:'hand',discard:null},{usage:'info',assignment:'offen',discard:null},{usage:'erledigt',assignment:'offen',discard:null},{usage:'offen',assignment:'offen',discard:'junk'}].entries()){
  const customerId=await customerFixture('TEST A3 '+index),itemId=randomUUID();customers.push(customerId);
  expect(await withSession(full,()=>saveIntakeNoteAction({itemId,textstand:randomUUID(),text:'TEST A3 gespeicherte Lesefixture',concerns:[],context:{customerId}}))).toMatchObject({code:'OK'});
  await sql`UPDATE public.intake_item SET kanal='mail',richtung='rein',graph_message_id=${'TEST-A3-'+itemId},betreff='TEST A3',absender_name='TEST Absender',absender_adresse=${'TEST-'+itemId+'@example.invalid'},empfangen_am=statement_timestamp(),einsatz=${state.usage},zuordnung=${state.assignment},aussortiert=${state.discard} WHERE tenant_id=${tenant} AND id=${itemId}::uuid`;
  if(index<2)active.push(itemId);
 }
 const read=await withSession(full,()=>getIntakeMessagesAction('offen'));if(read.code!=='OK')throw Error('TEST_A3_MESSAGES:'+read.code);
 expect(read.messages.map(row=>row.id).sort()).toEqual([...active].sort());
 const mails=await withSession(full,()=>readOpenIntakeMails());if(mails.code!=='OK')throw Error('TEST_A3_MAILS:'+mails.code);
 // PL13.11.05:18: sorting is the unassigned subset; counts/messages stay open.
 expect(mails.mails.map(row=>row.id)).toEqual([active[0]]);
 const auth=await withSession(full,()=>resolveAuthorization());if(!auth.ok)throw Error('TEST_A3_AUTH');
 const signals=await readCustomerListSignals(auth.data,customers,(await import('@/modules/eingang/server-public')).openIntakePredicate());
 expect([...signals.values()].reduce((sum,row)=>sum+Number(row.openMessageCount),0)).toBe(2);
 const day=await withSession(full,()=>readTodayDashboard(auth.data,getComplaints,getQuoteFollowupsForTodayAction));
 expect(day.messageActions?.rows.map(row=>row.messageId).sort()).toEqual([...active].sort());
 expect(day.messageActions?.code).toBe('OK');
 expect((await withSession(full,()=>getIntakeMessagesAction('offen')))).toEqual(read);
});
