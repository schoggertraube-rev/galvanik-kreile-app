// @vitest-environment node
import {it,expect,vi} from 'vitest';
const tenant=vi.hoisted(()=>'TEST-ablauf-'+globalThis.crypto.randomUUID());
vi.mock('@/lib/tenant',()=>({KREILE_TENANT_SLUG:tenant}));
import {full,withSession,createFixture} from '../../../e2e/ablauf/replayHarness';
import {getAuthBootstrapState} from '@/lib/server/authBootstrap';
import {resolveAuthorization} from '@/lib/server/authorization';
import {withPrivilegedTenantTransaction} from '@/lib/server/privilegedDb';
import {readOffline24hFlag} from '@/lib/server/offlineFeatureFlag';
import {sql} from 'drizzle-orm';
import {logout} from '@/app/actions/auth';
import {readAppSession} from '@/lib/server/appSession';

it('the real logout clears the actual session before any browser-cache work',async()=>{
 await withSession(full,async()=>{
  expect((await readAppSession()).ok).toBe(true);
  expect((await logout()).ok).toBe(true);
  expect(await readAppSession()).toEqual({ok:false,reason:'NO_COOKIE'});
 });
});

it('reads the real offline DB flag and role filter without persisting TEST configuration',async()=>{
 await withSession(full,async()=>{
  const resolved=await resolveAuthorization();if(!resolved.ok)throw Error('TEST_REAL_AUTH');
  const rollback=Error('TEST_ROLLBACK_FLAG');
  await expect(withPrivilegedTenantTransaction(resolved.data,async tx=>{
   await tx.execute(sql`UPDATE public.feature_flags SET enabled=false,roles_allowed=ARRAY[]::text[] WHERE id='offline_24h'`);
   expect(await readOffline24hFlag(tx,resolved.data)).toBe(false);
   await tx.execute(sql`UPDATE public.feature_flags SET enabled=true WHERE id='offline_24h'`);
   expect(await readOffline24hFlag(tx,resolved.data)).toBe(true);
   await tx.execute(sql`UPDATE public.feature_flags SET roles_allowed=ARRAY[${resolved.data.role}]::text[] WHERE id='offline_24h'`);
   expect(await readOffline24hFlag(tx,resolved.data)).toBe(true);
   await tx.execute(sql`UPDATE public.feature_flags SET roles_allowed=ARRAY['TEST-other-role']::text[] WHERE id='offline_24h'`);
   expect(await readOffline24hFlag(tx,resolved.data)).toBe(false);
   throw rollback;
  })).rejects.toBe(rollback);
  const boot=await getAuthBootstrapState();if(boot.status!=='authenticated')throw Error('TEST_REAL_BOOT');
  expect(boot.user.offline24hEnabled).toBe(false);
 });
});

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
