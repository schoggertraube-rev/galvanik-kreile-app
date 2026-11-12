// @vitest-environment node
import {it,expect,vi} from 'vitest';
const tenant=vi.hoisted(()=>'TEST-ablauf-'+globalThis.crypto.randomUUID());
vi.mock('@/lib/tenant',()=>({KREILE_TENANT_SLUG:tenant}));
import {full,withSession,createFixture,sql} from '../../../e2e/ablauf/replayHarness';
import {getAuthBootstrapState} from '@/lib/server/authBootstrap';
import {logout} from '@/app/actions/auth';
import {readAppSession,setAppSession} from '@/lib/server/appSession';
import {cookies} from 'next/headers';
import {CACHE_SCOPE_COOKIE} from '@/lib/offline/cacheScopeMarker';
import {resolveAuthorization} from '@/lib/server/authorization';

it('resolves the existing offline flag beside real rights and projects only its boolean',async()=>{
 const [original]=await sql`SELECT enabled,roles_allowed FROM public.feature_flags WHERE id='offline_24h'`;
 if(!original)throw Error('TEST_EXISTING_FLAG_REQUIRED');
 try{await withSession(full,async()=>{
  await sql`UPDATE public.feature_flags SET enabled=false,roles_allowed=ARRAY[]::text[] WHERE id='offline_24h'`;
  const before=await resolveAuthorization();if(!before.ok)throw Error('TEST_AUTH');
  expect(before.data.offline24h).toBe(false);
  await sql`UPDATE public.feature_flags SET enabled=true WHERE id='offline_24h'`;
  const enabled=await resolveAuthorization();if(!enabled.ok)throw Error('TEST_AUTH');
  expect(enabled.data.offline24h).toBe(true);expect(enabled.data.permissions).toEqual(before.data.permissions);
  expect(await getAuthBootstrapState()).toMatchObject({status:'authenticated',user:{offline24h:true}});
  await sql`UPDATE public.feature_flags SET roles_allowed=ARRAY[${enabled.data.role}]::text[] WHERE id='offline_24h'`;
  expect(await resolveAuthorization()).toMatchObject({ok:true,data:{offline24h:true}});
  await sql`UPDATE public.feature_flags SET roles_allowed=ARRAY['TEST-other-role']::text[] WHERE id='offline_24h'`;
  expect(await getAuthBootstrapState()).toMatchObject({status:'authenticated',user:{offline24h:false}});
 });}finally{await sql`UPDATE public.feature_flags SET enabled=${original.enabled},roles_allowed=${original.roles_allowed} WHERE id='offline_24h'`;}
 expect(await sql`SELECT enabled,roles_allowed FROM public.feature_flags WHERE id='offline_24h'`).toEqual([original]);
});

it('the real logout clears the actual session before any browser-cache work',async()=>{
 await withSession(full,async()=>{
  const session=await readAppSession();expect(session.ok).toBe(true);if(!session.ok)throw Error('TEST_SESSION');
  await setAppSession(session.session);
  const bootstrap=await getAuthBootstrapState();if(bootstrap.status!=='authenticated')throw Error('TEST_AUTH');
  expect((await cookies()).get(CACHE_SCOPE_COOKIE)?.value).toBe(bootstrap.user.offlineLoginScope);
  expect((await logout()).ok).toBe(true);
  expect(await readAppSession()).toEqual({ok:false,reason:'NO_COOKIE'});
  // Next's mutable response jar retains the expired empty tombstone until HTTP delivery.
  expect((await cookies()).get(CACHE_SCOPE_COOKIE)?.value??'').toBe('');
  (await cookies()).set(CACHE_SCOPE_COOKIE,'a'.repeat(64));
  expect(await getAuthBootstrapState()).toEqual({status:'unauthenticated'});
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
