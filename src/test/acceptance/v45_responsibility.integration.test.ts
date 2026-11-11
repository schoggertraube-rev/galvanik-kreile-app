// @vitest-environment node
import {it,expect,vi} from 'vitest';
import {randomUUID} from 'node:crypto';
const tenant=vi.hoisted(()=>'TEST-ablauf-'+globalThis.crypto.randomUUID());
vi.mock('@/lib/tenant',()=>({KREILE_TENANT_SLUG:tenant}));
import {KREILE_TENANT_SLUG} from '@/lib/tenant';
import {sql,full,withSession,createFixture} from '../../../e2e/ablauf/replayHarness';
import {customerFixture,intakeOrderFixture} from '../../../e2e/ablauf/orderFixture';
import {resolveAuthorization} from '@/lib/server/authorization';
import {readV45ResponsibilityText} from '@/lib/server/v45ResponsibilityRead';
import {assignOrderTaskAction} from '@/app/actions/orders.actions';
import {ROLE_LABELS} from '@/lib/auth/authorizationContract';
it('binds V45 responsibility to an actual assignment, unique effective login or existing unambiguous role label',async()=>{
 const auth=await withSession(full,()=>resolveAuthorization());if(!auth.ok)throw Error('TEST_AUTH');
 const input={textKey:'work.extra_note',requiredArea:'entscheiden' as const};
 const first=await createFixture(['entscheiden'],'meister');
 const [person]=await sql`SELECT full_name FROM public.app_users WHERE tenant_id=${KREILE_TENANT_SLUG} AND id=${first.actorId}::uuid`;
 expect(await readV45ResponsibilityText(auth.data,input)).toEqual({code:'OK',source:'login',textKey:input.textKey,text:'Was sollte '+person.full_name+' dazu wissen?'});
 await createFixture(['entscheiden'],'meister');
 expect(await readV45ResponsibilityText(auth.data,input)).toEqual({code:'OK',source:'role',textKey:input.textKey,text:'Was sollte '+ROLE_LABELS.meister+' dazu wissen?'});
 await createFixture(['entscheiden'],'admin');
 expect(await readV45ResponsibilityText(auth.data,input)).toMatchObject({code:'SOURCE_INCOMPLETE',missing:'MULTIPLE_ROLE_LABELS'});
 const customerId=await customerFixture('V45 Zustaendig'),order=await intakeOrderFixture('V45 Zustaendig',customerId);
 expect(await withSession(full,()=>assignOrderTaskAction({orderId:order.receipt.orderId,assigneeUserId:full.actorId,expectedVersion:1,clientEventId:randomUUID()}))).toMatchObject({code:'OK'});
 const [assigned]=await sql`SELECT full_name FROM public.app_users WHERE tenant_id=${KREILE_TENANT_SLUG} AND id=${full.actorId}::uuid`;
 expect(await readV45ResponsibilityText(auth.data,{...input,orderId:order.receipt.orderId})).toEqual({code:'OK',source:'assignment',textKey:input.textKey,text:'Was sollte '+assigned.full_name+' dazu wissen?'});
});
