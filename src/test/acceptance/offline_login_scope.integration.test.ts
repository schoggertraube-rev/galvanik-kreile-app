// @vitest-environment node
import {it,expect,vi} from 'vitest';
const tenant=vi.hoisted(()=>'TEST-ablauf-'+globalThis.crypto.randomUUID());
vi.mock('@/lib/tenant',()=>({KREILE_TENANT_SLUG:tenant}));
import {full,withSession,createFixture} from '../../../e2e/ablauf/replayHarness';
import {getAuthBootstrapState} from '@/lib/server/authBootstrap';

it('projects a non-authoritative cache scope from the real validated credential while keeping the original queue bound to its actor',async()=>{
 const first=await withSession(full,async()=>{
  const a=await getAuthBootstrapState(),b=await getAuthBootstrapState();
  expect(a).toEqual(b);return a;
 });
 expect(first.status).toBe('authenticated');if(first.status!=='authenticated')throw Error('TEST_REAL_AUTH');
 expect(first.user.offlineScope).toMatch(/^[0-9a-f]{64}$/);
 expect(first.user.offlineLoginScope).toMatch(/^[0-9a-f]{64}$/);
 expect(first.user.offlineLoginScope).not.toBe(first.user.offlineScope);
 // The harness issues another actual signed fixture credential, not an auth mock.
 await new Promise(resolve=>setTimeout(resolve,3));
 const renewed=await withSession(full,()=>getAuthBootstrapState());
 if(renewed.status!=='authenticated')throw Error('TEST_REAL_REAUTH');
 expect(renewed.user.offlineScope).toBe(first.user.offlineScope);
 expect(renewed.user.offlineLoginScope).not.toBe(first.user.offlineLoginScope);
 expect(renewed.user.permissions).toEqual(first.user.permissions);
 const other=await createFixture(['auftraege'],'werkstatt');
 const switched=await withSession(other,()=>getAuthBootstrapState());
 if(switched.status!=='authenticated')throw Error('TEST_OTHER_AUTH');
 expect(switched.user.offlineScope).not.toBe(first.user.offlineScope);
 expect(switched.user.offlineLoginScope).not.toBe(first.user.offlineLoginScope);
 expect(JSON.stringify([first,renewed,switched])).not.toContain(full.actorId);
 expect(JSON.stringify([first,renewed,switched])).not.toContain('TEST-ein34-local-only');
});
